"use client";

import { useState, useEffect, useRef } from "react";
import { api, BrregSearchResult, VendorStatus } from "@/lib/api";

interface VendorFormProps {
  projectId: string;
  existingVendor?: {
    id: string;
    name: string;
    organizationNumber: string | null;
    emailDomain: string | null;
  };
  onSubmit: (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export default function VendorForm({
  projectId: _projectId,
  existingVendor,
  onSubmit,
  onCancel,
  onDelete,
}: VendorFormProps) {
  const [companyName, setCompanyName] = useState(existingVendor?.name || "");
  const [searchResults, setSearchResults] = useState<BrregSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [formData, setFormData] = useState({
    organizationNumber: existingVendor?.organizationNumber || "",
    emailDomain: existingVendor?.emailDomain || "",
  });
  const [additionalData, setAdditionalData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [companySelected, setCompanySelected] = useState(!!existingVendor);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lookingUpOrgNumber, setLookingUpOrgNumber] = useState(false);
  const [brregName, setBrregName] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orgNumberLookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search brreg.no when user types
  useEffect(() => {
    if (companySelected || companyName.length < 2) {
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
        setShowResults(true);
      } catch (err: any) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [companyName, companySelected]);

  // Lookup organization number in brreg when it's entered
  useEffect(() => {
    const cleanOrgNumber = formData.organizationNumber.replace(/\D/g, "");
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

        if (existingVendor && companyName !== details.name) {
          setCompanyName(details.name);
          setCompanySelected(true);
        }

        setAdditionalData(details.rawData);

        if (details.website) {
          try {
            const url = new URL(
              details.website.startsWith("http")
                ? details.website
                : `https://${details.website}`
            );
            setFormData((prev) => ({
              ...prev,
              emailDomain: url.hostname.replace("www.", ""),
            }));
          } catch {
            // Invalid URL, ignore
          }
        }
      } catch (err: any) {
        if (
          err.message?.includes("not found") ||
          err.message?.includes("404")
        ) {
          setBrregName(null);
        } else {
          console.error("Error looking up organization number:", err);
          setBrregName(null);
        }
      } finally {
        setLookingUpOrgNumber(false);
      }
    }, 500);

    return () => {
      if (orgNumberLookupTimeoutRef.current) {
        clearTimeout(orgNumberLookupTimeoutRef.current);
      }
    };
  }, [formData.organizationNumber, existingVendor, companyName]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCompany = async (result: BrregSearchResult) => {
    setCompanyName(result.name);
    setFormData({
      ...formData,
      organizationNumber: result.organizationNumber,
    });
    setCompanySelected(true);
    setShowResults(false);

    try {
      const details = await api.vendors.getBrregData(result.organizationNumber);
      setAdditionalData(details.rawData);

      if (details.website) {
        try {
          const url = new URL(
            details.website.startsWith("http")
              ? details.website
              : `https://${details.website}`
          );
          setFormData((prev) => ({
            ...prev,
            emailDomain: url.hostname.replace("www.", ""),
          }));
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
    if (error) {
      setError("");
    }
    if (companySelected) {
      setCompanySelected(false);
      setFormData((prev) => ({
        ...prev,
        organizationNumber: "",
      }));
      setAdditionalData(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    const cleanOrgNumber = formData.organizationNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length > 0 && cleanOrgNumber.length !== 9) {
      setError("Organization number must be exactly 9 digits");
      return;
    }

    if (cleanOrgNumber.length === 9 && !brregName && !lookingUpOrgNumber) {
      setError(
        "Organization number not found in brreg.no. Please enter a valid Norwegian organization number or remove it."
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: companyName.trim(),
        organizationNumber:
          cleanOrgNumber.length === 9 ? cleanOrgNumber : undefined,
        emailDomain: formData.emailDomain || undefined,
        additionalData: additionalData || undefined,
        status: "Pending",
      });
    } catch (err: any) {
      setError(err.message || "Failed to save vendor");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-background-secondary p-4 rounded-lg border border-border-primary"
    >
      {/* Company Name with Search */}
      <div className="relative" ref={resultsRef}>
        <label
          htmlFor="companyName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Company Name *
        </label>
        <div className="relative">
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => handleCompanyNameChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0 && !companySelected) {
                setShowResults(true);
              }
            }}
            required
            placeholder="Type company name (searches Norwegian companies automatically)"
            className="w-full px-3 py-2 border border-border-primary bg-background-tertiary text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-text-tertiary"
          />
          {searching && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            </div>
          )}
        </div>

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
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {result.name}
                </div>
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

      <div>
        <label
          htmlFor="organizationNumber"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Organization Number
        </label>
        <div className="relative">
          <input
            id="organizationNumber"
            type="text"
            value={formData.organizationNumber}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, "").slice(0, 9);
              setFormData({ ...formData, organizationNumber: cleaned });
              setBrregName(null);
              setError("");
            }}
            onBlur={(e) => {
              const cleaned = e.target.value.replace(/\D/g, "");
              if (cleaned.length > 0 && cleaned.length !== 9) {
                setFormData((prev) => ({ ...prev, organizationNumber: "" }));
                setError("Organization number must be exactly 9 digits");
              }
            }}
            placeholder="9 digits (for Norwegian companies)"
            maxLength={9}
            className="w-full px-3 py-2 border border-border-primary bg-background-tertiary text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-text-tertiary"
          />
          {lookingUpOrgNumber && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            </div>
          )}
        </div>
        {brregName && (
          <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
            ✓ Found in brreg.no: "{brregName}" - Name will be set automatically
          </p>
        )}
        {formData.organizationNumber.length > 0 &&
          formData.organizationNumber.length < 9 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Organization number must be exactly 9 digits
            </p>
          )}
        {formData.organizationNumber.length === 9 &&
          !lookingUpOrgNumber &&
          !brregName && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              ⚠ Organization number not found in brreg.no. Please verify the
              number or remove it before saving.
            </p>
          )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optional - 9 digits for Norwegian companies (must exist in brreg.no)
        </p>
      </div>

      <div>
        <label
          htmlFor="emailDomain"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email Domain
        </label>
        <input
          id="emailDomain"
          type="text"
          value={formData.emailDomain}
          onChange={(e) =>
            setFormData({ ...formData, emailDomain: e.target.value })
          }
          placeholder="company.com"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optional - The email domain for this company
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p className="text-sm text-red-800 dark:text-red-300 font-medium">
            {error}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting
            ? existingVendor
              ? "Updating..."
              : "Adding..."
            : existingVendor
              ? "Update Vendor"
              : "Add Vendor"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium border border-border-primary text-text-primary rounded-md hover:bg-background-primary"
        >
          Cancel
        </button>
        {existingVendor && onDelete && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 ml-auto"
          >
            Remove Vendor
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background-tertiary rounded-lg shadow-lg p-6 max-w-md w-full mx-4 border border-border-primary">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Remove Vendor
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to remove "{existingVendor?.name}" from this
              project? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium border border-border-primary text-text-primary rounded-md hover:bg-background-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!onDelete) return;
                  setDeleting(true);
                  try {
                    await onDelete();
                    setShowDeleteConfirm(false);
                  } catch (err: any) {
                    setError(err.message || "Failed to remove vendor");
                    setDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
