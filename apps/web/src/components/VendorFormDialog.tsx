"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "./ui/SlideOver";
import { FormField, Input, Button } from "./ui/FormField";
import { ConfirmDialog } from "./ui/Dialog";
import { api, BrregSearchResult, VendorStatus } from "@/lib/api";

interface VendorFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Project ID */
  projectId: string;
  /** Existing vendor data for edit mode */
  existingVendor?: {
    id: string;
    name: string;
    organizationNumber: string | null;
    emailDomain: string | null;
  };
  /** Callback when vendor is saved */
  onSave: (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => Promise<void>;
  /** Callback when vendor is deleted */
  onDelete?: () => Promise<void>;
}

export function VendorFormDialog({
  open,
  onClose,
  projectId: _projectId,
  existingVendor,
  onSave,
  onDelete,
}: VendorFormDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [organizationNumber, setOrganizationNumber] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [searchResults, setSearchResults] = useState<BrregSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [additionalData, setAdditionalData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [companySelected, setCompanySelected] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lookingUpOrgNumber, setLookingUpOrgNumber] = useState(false);
  const [brregName, setBrregName] = useState<string | null>(null);
  const [originalCompanyName, setOriginalCompanyName] = useState<string>("");
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orgNumberLookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!existingVendor;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingVendor) {
        setCompanyName(existingVendor.name);
        setOriginalCompanyName(existingVendor.name);
        setOrganizationNumber(existingVendor.organizationNumber || "");
        setEmailDomain(existingVendor.emailDomain || "");
        setCompanySelected(true);
      } else {
        setCompanyName("");
        setOriginalCompanyName("");
        setOrganizationNumber("");
        setEmailDomain("");
        setCompanySelected(false);
      }
      setSearchResults([]);
      setShowResults(false);
      setAdditionalData(null);
      setError("");
      setBrregName(null);
      
      // Focus the company name input
      setTimeout(() => {
        companyInputRef.current?.focus();
      }, 100);
    }
  }, [open, existingVendor]);

  // Search brreg.no when user types
  useEffect(() => {
    if (!open) return;
    
    // Don't search if name is too short
    if (companyName.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Check if name has changed from original (when editing)
    const nameChanged = originalCompanyName && companyName !== originalCompanyName;
    
    // Search should trigger if:
    // 1. Company is not selected (new vendor or user cleared selection), OR
    // 2. Name has changed from original (when editing - allows search even if companySelected is still true)
    // This ensures search works in edit mode when user changes the name
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
        const response = await api.vendors.search(companyName);
        setSearchResults(response.results);
        // Show results if we should be searching
        // (company not selected OR name changed from original)
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
  }, [companyName, companySelected, open, originalCompanyName]);

  // Lookup organization number in brreg
  useEffect(() => {
    if (!open) return;
    
    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length !== 9) {
      setBrregName(null);
      return;
    }

    if (orgNumberLookupTimeoutRef.current) {
      clearTimeout(orgNumberLookupTimeoutRef.current);
    }

    orgNumberLookupTimeoutRef.current = setTimeout(async () => {
      setLookingUpOrgNumber(true);
      try {
        const details = await api.vendors.getBrregData(cleanOrgNumber);
        setBrregName(details.name);
        
        // Always update company name to match brreg when org number is found
        if (companyName !== details.name) {
          setCompanyName(details.name);
          setCompanySelected(true);
        }
        
        setAdditionalData(details.rawData);

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
      } catch {
        setBrregName(null);
      } finally {
        setLookingUpOrgNumber(false);
      }
    }, 500);

    return () => {
      if (orgNumberLookupTimeoutRef.current) {
        clearTimeout(orgNumberLookupTimeoutRef.current);
      }
    };
  }, [organizationNumber, existingVendor, companyName, open]);

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
    setCompanyName(result.name);
    setOrganizationNumber(result.organizationNumber);
    setCompanySelected(true);
    setShowResults(false);

    try {
      const details = await api.vendors.getBrregData(result.organizationNumber);
      setAdditionalData(details.rawData);

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
    setCompanyName(value);
    if (error) setError("");
    if (companySelected) {
      setCompanySelected(false);
      // Only clear org number if we're not editing (new vendor)
      // When editing, keep the org number so we can validate against it
      if (!existingVendor) {
        setOrganizationNumber("");
        setAdditionalData(null);
      }
    }
  };

  const handleCompanyNameBlur = async () => {
    // When blurring, if there's an org number, validate the name against it
    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length === 9 && companyName.trim()) {
      try {
        const details = await api.vendors.getBrregData(cleanOrgNumber);
        // If the name doesn't match brreg, update it
        if (companyName.trim() !== details.name) {
          setCompanyName(details.name);
          setBrregName(details.name);
          setCompanySelected(true);
        }
      } catch (err: any) {
        // Org number not found or other error - that's okay, user can continue
        console.error("Error validating name against org number:", err);
      }
    }
    // Hide search results when blurring (unless clicking on a result)
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length > 0 && cleanOrgNumber.length !== 9) {
      setError("Organization number must be exactly 9 digits");
      return;
    }

    if (cleanOrgNumber.length === 9 && !brregName && !lookingUpOrgNumber) {
      setError("Organization number not found in brreg.no");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: companyName.trim(),
        organizationNumber: cleanOrgNumber.length === 9 ? cleanOrgNumber : undefined,
        emailDomain: emailDomain || undefined,
        additionalData: additionalData || undefined,
        status: "Pending",
      });
      onClose();
    } catch (err: any) {
      // Handle brreg validation errors - if backend returns brregName, update the name automatically
      const brregName = err.response?.brregName;
      if (brregName) {
        setCompanyName(brregName);
        setBrregName(brregName);
        setCompanySelected(true);
        setError(
          `Company name automatically updated to match brreg.no: "${brregName}". Please review and save again.`
        );
      } else {
        setError(err.message || "Failed to save vendor");
      }
    } finally {
      setSubmitting(false);
    }
  }, [companyName, organizationNumber, emailDomain, additionalData, brregName, lookingUpOrgNumber, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete vendor");
    } finally {
      setDeleting(false);
    }
  }, [onDelete, onClose]);

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit Vendor" : "Add Vendor"}
        description={isEditing ? "Update vendor information" : "Add a new vendor to your project"}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between w-full gap-2">
            {isEditing && onDelete && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || submitting}
              >
                Remove Vendor
              </Button>
            )}
            
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={deleting}
              >
                {isEditing ? "Update" : "Add"} Vendor
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Company Name with Search */}
          <div className="relative" ref={resultsRef}>
            <FormField label="Company Name" required error={!companyName.trim() && error ? error : undefined}>
              <div className="relative">
                <Input
                  ref={companyInputRef}
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0 && !companySelected) {
                      setShowResults(true);
                    }
                  }}
                  onBlur={handleCompanyNameBlur}
                  placeholder="Type company name (searches Norwegian companies)"
                  hasError={!companyName.trim() && !!error}
                />
                {searching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                  </div>
                )}
              </div>
            </FormField>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && !companySelected && (
              <div className="absolute z-10 w-full mt-1 bg-background-tertiary border border-border-primary rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.organizationNumber}
                    type="button"
                    onClick={() => handleSelectCompany(result)}
                    className="w-full text-left px-4 py-3 hover:bg-background-primary border-b border-border-primary last:border-b-0"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{result.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Org. nr: {result.organizationNumber}
                      {result.organizationForm && ` • ${result.organizationForm}`}
                    </div>
                    {result.address && result.address.city && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {result.address.city}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <FormField
            label="Organization Number"
            helperText="Optional - 9 digits for Norwegian companies"
          >
            <div className="relative">
              <Input
                type="text"
                value={organizationNumber}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setOrganizationNumber(cleaned);
                  setBrregName(null);
                  setError("");
                }}
                placeholder="9 digits (for Norwegian companies)"
                maxLength={9}
              />
              {lookingUpOrgNumber && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                </div>
              )}
            </div>
            {brregName && (
              <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                Found in brreg.no: "{brregName}"
              </p>
            )}
            {organizationNumber.length === 9 && !lookingUpOrgNumber && !brregName && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Organization number not found in brreg.no
              </p>
            )}
          </FormField>

          <FormField
            label="Email Domain"
            helperText="Optional - The email domain for this company"
          >
            <Input
              type="text"
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              placeholder="company.com"
            />
          </FormField>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Remove Vendor"
        message={`Are you sure you want to remove "${existingVendor?.name}" from this project? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
