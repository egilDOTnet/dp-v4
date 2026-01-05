"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "../ui/SlideOver";
import { FormField, Input, Button, Select } from "../ui/FormField";
import { useOrgNumberLookup } from "@/hooks/useOrgNumberLookup";
import { api, BrregSearchResult } from "@/lib/api";

export type SubscriptionStatus = "Trial" | "Active" | "Expired";
export type SubscriptionTier = "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null;

interface Company {
  id: string;
  name: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string | null;
  trialStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    User: number;
    Project: number;
  };
}

interface CompanyFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Existing company data for edit mode */
  existingCompany?: Company;
  /** Callback when company is saved */
  onSave: (data: {
    name: string;
    organizationNumber?: string | null;
    emailDomain?: string | null;
    subscriptionStatus: SubscriptionStatus;
    subscriptionTier?: SubscriptionTier;
    subscriptionExpiresAt?: string | null;
  }) => Promise<void>;
  /** Callback when company is deleted */
  onDelete?: () => Promise<void>;
}

export function CompanyFormDialog({
  open,
  onClose,
  existingCompany,
  onSave,
  onDelete: _onDelete,
}: CompanyFormDialogProps) {
  const [name, setName] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("Trial");
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<BrregSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [companySelected, setCompanySelected] = useState(false);
  const [originalCompanyName, setOriginalCompanyName] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isEditing = !!existingCompany;

  // Use the orgnumber lookup hook (only when org number is manually entered, not from search)
  const { brregName, lookingUp: lookingUpOrgNumber, error: lookupError } = useOrgNumberLookup(organizationNumber, {
    enabled: open && !companySelected,
    onNameUpdate: (brregName) => {
      // Auto-update name from brreg if it's different and company is not selected
      if (!companySelected && name !== brregName) {
        setName(brregName);
      }
    },
    onEmailDomainUpdate: (domain) => {
      setEmailDomain(domain);
    },
  });

  // Format date for input
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingCompany) {
        setName(existingCompany.name);
        setOriginalCompanyName(existingCompany.name);
        setOrganizationNumber(existingCompany.organizationNumber || "");
        setEmailDomain(existingCompany.emailDomain || "");
        setSubscriptionStatus(existingCompany.subscriptionStatus);
        setSubscriptionTier(existingCompany.subscriptionTier || null);
        setSubscriptionExpiresAt(formatDateForInput(existingCompany.subscriptionExpiresAt));
        setCompanySelected(true);
      } else {
        setName("");
        setOriginalCompanyName("");
        setOrganizationNumber("");
        setEmailDomain("");
        setSubscriptionStatus("Trial");
        setSubscriptionTier(null);
        setSubscriptionExpiresAt("");
        setCompanySelected(false);
      }
      setError("");
      setSearchResults([]);
      setShowResults(false);

      // Focus the name input
      setTimeout(() => {
        nameRef.current?.focus();
      }, 100);
    }
  }, [open, existingCompany]);

  // Search brreg.no when user types company name
  useEffect(() => {
    if (!open) return;
    
    // Don't search if name is too short
    if (name.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Check if name has changed from original (when editing)
    const nameChanged = originalCompanyName && name !== originalCompanyName;
    
    // Search should trigger if:
    // 1. Company is not selected (new company or user cleared selection), OR
    // 2. Name has changed from original (when editing - allows search even if companySelected is still true)
    const shouldSearch = !companySelected || nameChanged;
    
    if (!shouldSearch) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.vendors.search(name);
        setSearchResults(response.results);
        setShowResults(true);
      } catch (err: any) {
        console.error("Search error:", err);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [name, companySelected, open, originalCompanyName]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCompany = async (result: BrregSearchResult) => {
    setName(result.name);
    setOrganizationNumber(result.organizationNumber);
    setCompanySelected(true);
    setShowResults(false);

    try {
      const details = await api.vendors.getBrregData(result.organizationNumber);
      if (details.website) {
        try {
          const url = new URL(
            details.website.startsWith("http") ? details.website : `https://${details.website}`
          );
          setEmailDomain(url.hostname.replace("www.", ""));
        } catch {
          // Invalid URL, ignore
        }
      }
    } catch (err: any) {
      console.error("Error fetching company details:", err);
    }
  };

  const handleCompanyNameChange = (value: string) => {
    setName(value);
    if (error) setError("");
    if (companySelected) {
      setCompanySelected(false);
      if (!existingCompany) {
        setOrganizationNumber("");
      }
    }
  };

  const handleCompanyNameBlur = async () => {
    // Hide search results when blurring (unless clicking on a result)
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!name.trim()) {
      setError("Company name is required");
      return;
    }

    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length > 0 && cleanOrgNumber.length !== 9) {
      setError("Organization number must be exactly 9 digits");
      return;
    }

    // Note: We don't validate that the org number exists in brreg.no here
    // because: 1) org number is optional, 2) when selected from search we know it's valid,
    // 3) the backend can validate if needed. The lookup is just for auto-filling data.

    // Validate subscription tier is only set when status is Active
    if (subscriptionTier && subscriptionStatus !== "Active") {
      setError("Subscription tier can only be set when subscription status is Active");
      return;
    }

    // Validate expiration date is only set when status is Active
    if (subscriptionExpiresAt && subscriptionStatus !== "Active") {
      setError("Subscription expiration date can only be set when subscription status is Active");
      return;
    }

    // Validate expiration date is not in the past when status is Active
    if (subscriptionExpiresAt && subscriptionStatus === "Active") {
      const expirationDate = new Date(subscriptionExpiresAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expirationDate < today) {
        setError("Subscription expiration date cannot be in the past");
        return;
      }
    }

    setSubmitting(true);
    try {
      const saveData: {
        name: string;
        organizationNumber?: string | null;
        emailDomain?: string | null;
        subscriptionStatus: SubscriptionStatus;
        subscriptionTier?: SubscriptionTier;
        subscriptionExpiresAt?: string | null;
      } = {
        name: name.trim(),
        organizationNumber: cleanOrgNumber.length === 9 ? cleanOrgNumber : null,
        emailDomain: emailDomain.trim() || null,
        subscriptionStatus,
        subscriptionExpiresAt: subscriptionStatus === "Active" && subscriptionExpiresAt ? subscriptionExpiresAt : null,
      };
      
      // Only include subscriptionTier if status is Active and tier is set
      if (subscriptionStatus === "Active" && subscriptionTier) {
        saveData.subscriptionTier = subscriptionTier;
      }
      
      await onSave(saveData);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save company");
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    organizationNumber,
    emailDomain,
    subscriptionStatus,
    subscriptionTier,
    subscriptionExpiresAt,
    onSave,
    onClose,
  ]);


  const subscriptionStatusOptions = [
    { value: "Trial", label: "Trial" },
    { value: "Active", label: "Active" },
    { value: "Expired", label: "Expired" },
  ];

  const subscriptionTierOptions = [
    { value: "", label: "None" },
    { value: "Projects1", label: "1 Project" },
    { value: "Projects2", label: "2 Projects" },
    { value: "Projects5", label: "5 Projects" },
    { value: "Unlimited", label: "Unlimited" },
  ];

  const isActive = subscriptionStatus === "Active";

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit Company" : "Create Company"}
        description={
          isEditing
            ? "Update company information and subscription settings"
            : "Create a new company tenant"
        }
        size="xl"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
            >
              {isEditing ? "Save Changes" : "Create Company"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Company Information */}
          <div className="space-y-4">
            <FormField 
              label="Company Name" 
              required 
              helperText="Type company name (searches Norwegian companies)"
              error={!name.trim() && error ? error : undefined}
            >
              <div className="relative" ref={resultsRef}>
                <Input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  onBlur={handleCompanyNameBlur}
                  placeholder="Enter company name"
                  hasError={!name.trim() && !!error}
                />
                {searching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background-secondary border border-border-primary rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.organizationNumber}
                        type="button"
                        onClick={() => handleSelectCompany(result)}
                        className="w-full text-left px-4 py-2 hover:bg-background-tertiary border-b border-border-primary last:border-b-0"
                      >
                        <div className="font-medium text-text-primary">{result.name}</div>
                        <div className="text-sm text-text-secondary">
                          {result.organizationNumber}
                          {result.organizationForm && ` • ${result.organizationForm}`}
                        </div>
                        {result.address && result.address.city && (
                          <div className="text-xs text-text-tertiary mt-1">
                            {result.address.city}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            <FormField
              label="Organization Number"
              helperText="9-digit Norwegian organization number (optional)"
            >
              <div className="relative">
                <Input
                  type="text"
                  value={organizationNumber}
                  onChange={(e) => setOrganizationNumber(e.target.value)}
                  placeholder="123456789"
                  maxLength={9}
                  hasError={!!lookupError && organizationNumber.length === 9}
                />
                {lookingUpOrgNumber && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
                {brregName && organizationNumber.length === 9 && !lookingUpOrgNumber && (
                  <div className="absolute right-3 top-2.5">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {brregName && organizationNumber.length === 9 && !lookingUpOrgNumber && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Found: {brregName}
                </p>
              )}
              {lookupError && organizationNumber.length === 9 && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {lookupError}
                </p>
              )}
            </FormField>

            <FormField
              label="Email Domain"
              helperText="Email domain for the company (optional, auto-populated from brreg.no)"
            >
              <Input
                type="text"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                placeholder="example.com"
              />
            </FormField>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Subscription Settings */}
          <div className="space-y-4">
            <div className="border-t border-border-primary pt-4 lg:border-t-0 lg:pt-0">
              <div className="space-y-4">
                <FormField label="Subscription Status" required>
                  <Select
                    value={subscriptionStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value as SubscriptionStatus;
                      setSubscriptionStatus(newStatus);
                      // Clear tier and expiration when status changes from Active
                      if (newStatus !== "Active") {
                        setSubscriptionTier(null);
                        setSubscriptionExpiresAt("");
                      }
                    }}
                    options={subscriptionStatusOptions}
                  />
                  {subscriptionStatus === "Trial" && (
                    <p className="text-sm text-text-secondary mt-1">
                      New tenants start with a 14-day trial period
                    </p>
                  )}
                </FormField>

                <FormField
                  label="Subscription Tier"
                  helperText={
                    isActive
                      ? "Maximum number of projects allowed"
                      : "Only available when subscription status is Active"
                  }
                >
                  <Select
                    value={subscriptionTier || ""}
                    onChange={(e) =>
                      setSubscriptionTier(
                        e.target.value ? (e.target.value as SubscriptionTier) : null
                      )
                    }
                    options={subscriptionTierOptions}
                    disabled={!isActive}
                  />
                </FormField>

                <FormField
                  label="Subscription Expires At"
                  helperText={
                    isActive
                      ? "When the subscription expires (optional, leave empty for unlimited)"
                      : "Only available when subscription status is Active"
                  }
                >
                  <Input
                    type="date"
                    value={subscriptionExpiresAt}
                    onChange={(e) => setSubscriptionExpiresAt(e.target.value)}
                    disabled={!isActive}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </SlideOver>

    </>
  );
}
