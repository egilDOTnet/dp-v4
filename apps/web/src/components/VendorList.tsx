"use client";

import { useState, useEffect, Fragment, useRef } from "react";
import { ProjectVendor, VendorStatus, api, BrregSearchResult } from "@/lib/api";
import VendorForm from "./VendorForm";

interface VendorListProps {
  projectId: string;
  vendors: ProjectVendor[];
  onStatusChange: (vendorId: string, status: VendorStatus) => Promise<void>;
  onAddVendor: (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    shallReceiveRFI?: boolean;
    shallReceiveRFP?: boolean;
    shallReceiveShortlist?: boolean;
    additionalData?: any;
    status?: VendorStatus;
  }) => Promise<void>;
  onUpdateVendor: (
    vendorId: string,
    data: {
      name?: string;
      organizationNumber?: string;
      emailDomain?: string;
      shallReceiveRFI?: boolean;
      shallReceiveRFP?: boolean;
      shallReceiveShortlist?: boolean;
      additionalData?: any;
      status?: VendorStatus;
    }
  ) => Promise<void>;
  onDeleteVendor: (vendorId: string) => Promise<void>;
  onAddContact: (
    vendorId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => Promise<void>;
  onEditContact: (
    vendorId: string,
    contactId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => Promise<void>;
  onDeleteContact: (vendorId: string, contactId: string) => Promise<void>;
  showAddVendorForm?: boolean;
  onAddVendorFormChange?: (show: boolean) => void;
}

const STATUS_OPTIONS: { value: VendorStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "RFI_Received", label: "RFI Received" },
  { value: "RFI_Started", label: "RFI Started" },
  { value: "RFI_Answered", label: "RFI Answered" },
  { value: "RFP_Received", label: "RFP Received" },
  { value: "RFP_Delivered", label: "RFP Delivered" },
  { value: "RFP_Rejected", label: "RFP Rejected" },
  { value: "Shortlisted", label: "Shortlisted" },
  { value: "Lost", label: "Lost" },
  { value: "Won", label: "Won" },
];

export default function VendorList({
  projectId,
  vendors = [],
  onStatusChange,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onAddContact,
  onEditContact,
  onDeleteContact,
  showAddVendorForm = false,
  onAddVendorFormChange,
}: VendorListProps) {
  // Ensure vendors is always an array
  const safeVendors = vendors ?? [];
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingContactFields, setEditingContactFields] = useState<
    Record<string, Set<string>>
  >({});
  const [contactFormData, setContactFormData] = useState<
    Record<string, { firstName: string; lastName: string; email: string; isMainContact: boolean }>
  >({});
  const [addingContactVendorId, setAddingContactVendorId] = useState<
    string | null
  >(null);
  const [addingContactFormData, setAddingContactFormData] = useState<
    Record<string, { firstName: string; lastName: string; email: string; isMainContact: boolean }>
  >({});
  const [addingVendor, setAddingVendor] = useState(showAddVendorForm);
  const [editingVendorFields, setEditingVendorFields] = useState<
    Record<string, Set<string>>
  >({});
  const [vendorFormData, setVendorFormData] = useState<
    Record<string, { name: string; organizationNumber: string; emailDomain: string }>
  >({});
  const [isContactFormAnimating, setIsContactFormAnimating] = useState<
    Record<string, boolean>
  >({});
  const [isVendorExpandedAnimating, setIsVendorExpandedAnimating] = useState<
    Record<string, boolean>
  >({});
  // Optimistic updates for checkboxes
  const [checkboxUpdates, setCheckboxUpdates] = useState<
    Record<string, { shallReceiveRFI?: boolean; shallReceiveRFP?: boolean; shallReceiveShortlist?: boolean }>
  >({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const vendorRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const contactSaveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  // Search state for inline editing
  const [searchResults, setSearchResults] = useState<Record<string, BrregSearchResult[]>>({});
  const [showSearchResults, setShowSearchResults] = useState<Record<string, boolean>>({});
  const [searching, setSearching] = useState<Record<string, boolean>>({});
  const searchTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const nameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchResultsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Org number lookup state
  const [brregNames, setBrregNames] = useState<Record<string, string | null>>({});
  const [lookingUpOrgNumber, setLookingUpOrgNumber] = useState<Record<string, boolean>>({});
  const orgNumberLookupTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Sync external showAddVendorForm prop and trigger animation
  useEffect(() => {
    if (showAddVendorForm && !addingVendor) {
      setExpandedVendorId(null);
      setEditingContactId(null);
      setAddingContactVendorId(null);
      setEditingVendorFields({});
      setAddingVendor(true);
    } else if (!showAddVendorForm && addingVendor) {
      setAddingVendor(false);
    }
  }, [showAddVendorForm, addingVendor]);

  // Handle click outside to exit edit mode (similar to Tasks)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Check if click is within any vendor row that's being edited
      let clickedInsideVendor = false;
      Object.keys(editingVendorFields).forEach((vendorId) => {
        const vendorContainer = vendorRefs.current[vendorId];
        // Check if target is within the vendor container (first row)
        if (vendorContainer && vendorContainer.contains(target)) {
          clickedInsideVendor = true;
          return;
        }
        // Also check if target is within any row with the same data-vendor-id (includes second edit row)
        const vendorRow = target.closest('[data-vendor-id]');
        if (vendorRow && vendorRow.getAttribute('data-vendor-id') === vendorId) {
          clickedInsideVendor = true;
        }
        // Check if click is on search results
        const searchResultsContainer = searchResultsRefs.current[vendorId];
        if (searchResultsContainer && searchResultsContainer.contains(target)) {
          clickedInsideVendor = true;
        }
      });

      if (!clickedInsideVendor && Object.keys(editingVendorFields).length > 0) {
        // Save any pending changes before exiting edit mode
        Object.entries(editingVendorFields).forEach(([vendorId, fields]) => {
          const data = vendorFormData[vendorId];
          const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
          
          if (data && vendor) {
            fields.forEach((field) => {
              if (field === "name" && data.name !== vendor.vendor.name) {
                handleVendorFieldSave(vendorId, "name", data.name.trim());
              } else if (field === "organizationNumber") {
                const cleanValue = data.organizationNumber.replace(/\D/g, "");
                const currentValue = vendor.vendor.organizationNumber || "";
                if (cleanValue !== currentValue) {
                  handleVendorFieldSave(vendorId, "organizationNumber", cleanValue || undefined);
                }
              } else if (field === "emailDomain" && data.emailDomain !== (vendor.vendor.emailDomain || "")) {
                handleVendorFieldSave(vendorId, "emailDomain", data.emailDomain.trim() || undefined);
              }
            });
          }
        });

        // Exit all edit modes and clear search results
        setEditingVendorFields({});
        setShowSearchResults({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingVendorFields, vendorFormData, safeVendors]);

  // Cleanup search timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeouts.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      Object.values(orgNumberLookupTimeouts.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Sync vendorFormData with vendors prop when vendors change
  // This ensures form data is cleared when vendors are reloaded from the server
  useEffect(() => {
    // Clear form data for vendors that are no longer in the list or have been updated
    setVendorFormData((prev) => {
      const newData = { ...prev };
      let hasChanges = false;

      // Remove form data for vendors that no longer exist
      Object.keys(newData).forEach((vendorId) => {
        const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
        if (!vendor) {
          delete newData[vendorId];
          hasChanges = true;
        } else {
          // If vendor exists and we're not editing, clear stale form data
          // This ensures we use the fresh vendor prop data
          const isEditing = editingVendorFields[vendorId]?.size > 0;
          if (!isEditing) {
            delete newData[vendorId];
            hasChanges = true;
          }
        }
      });

      return hasChanges ? newData : prev;
    });
  }, [vendors, editingVendorFields, safeVendors]);

  const handleStatusChange = async (vendorId: string, status: VendorStatus) => {
    setUpdatingStatus(vendorId);
    try {
      await onStatusChange(vendorId, status);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateVendorFormField = (
    vendorId: string,
    field: "name" | "organizationNumber" | "emailDomain",
    value: string
  ) => {
    setVendorFormData((prev) => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        [field]: value,
      },
    }));

    // Trigger search when name field changes
    if (field === "name" && value.length >= 2) {
      // Clear existing timeout
      if (searchTimeouts.current[vendorId]) {
        clearTimeout(searchTimeouts.current[vendorId]);
      }

      // Set new timeout for search
      searchTimeouts.current[vendorId] = setTimeout(async () => {
        setSearching((prev) => ({ ...prev, [vendorId]: true }));
        try {
          const response = await api.vendors.search(value);
          setSearchResults((prev) => ({ ...prev, [vendorId]: response.results }));
          setShowSearchResults((prev) => ({ ...prev, [vendorId]: true }));
        } catch (err: any) {
          console.error("Search error:", err);
          setSearchResults((prev) => ({ ...prev, [vendorId]: [] }));
          setShowSearchResults((prev) => ({ ...prev, [vendorId]: false }));
        } finally {
          setSearching((prev) => ({ ...prev, [vendorId]: false }));
        }
      }, 300);
    } else if (field === "name" && value.length < 2) {
      // Clear search if name is too short
      setSearchResults((prev) => ({ ...prev, [vendorId]: [] }));
      setShowSearchResults((prev) => ({ ...prev, [vendorId]: false }));
    }

    // Trigger org number lookup when organizationNumber field changes
    if (field === "organizationNumber") {
      const cleanOrgNumber = value.replace(/\D/g, "");
      // Clear brreg name when org number changes (set to undefined, not null, so default text shows)
      setBrregNames((prev) => {
        const newState = { ...prev };
        delete newState[vendorId];
        return newState;
      });
      
      if (cleanOrgNumber.length !== 9) {
        return;
      }

      // Clear existing timeout
      if (orgNumberLookupTimeouts.current[vendorId]) {
        clearTimeout(orgNumberLookupTimeouts.current[vendorId]);
      }

      // Set new timeout for lookup
      orgNumberLookupTimeouts.current[vendorId] = setTimeout(async () => {
        setLookingUpOrgNumber((prev) => ({ ...prev, [vendorId]: true }));
        try {
          const details = await api.vendors.getBrregData(cleanOrgNumber);
          setBrregNames((prev) => ({ ...prev, [vendorId]: details.name }));
          
          // Update company name to match brreg when org number is found
          const currentName = vendorFormData[vendorId]?.name;
          if (currentName && currentName !== details.name) {
            setVendorFormData((prev) => ({
              ...prev,
              [vendorId]: {
                ...prev[vendorId],
                name: details.name,
              },
            }));
          }

          // Update email domain if website is available
          if (details.website) {
            try {
              const url = new URL(
                details.website.startsWith("http") ? details.website : `https://${details.website}`
              );
              setVendorFormData((prev) => ({
                ...prev,
                [vendorId]: {
                  ...prev[vendorId],
                  emailDomain: url.hostname.replace("www.", ""),
                },
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
            setBrregNames((prev) => ({ ...prev, [vendorId]: null }));
          } else {
            console.error("Error looking up organization number:", err);
            setBrregNames((prev) => ({ ...prev, [vendorId]: null }));
          }
        } finally {
          setLookingUpOrgNumber((prev) => ({ ...prev, [vendorId]: false }));
        }
      }, 500);
    }
  };

  const handleSelectCompany = async (vendorId: string, result: BrregSearchResult) => {
    // Update vendor form data with selected company
    setVendorFormData((prev) => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        name: result.name,
        organizationNumber: result.organizationNumber,
      },
    }));
    setShowSearchResults((prev) => ({ ...prev, [vendorId]: false }));

    // Fetch additional details
    try {
      const details = await api.vendors.getBrregData(result.organizationNumber);
      if (details.website) {
        try {
          const url = new URL(
            details.website.startsWith("http") ? details.website : `https://${details.website}`
          );
          setVendorFormData((prev) => ({
            ...prev,
            [vendorId]: {
              ...prev[vendorId],
              emailDomain: url.hostname.replace("www.", ""),
            },
          }));
        } catch {
          // Invalid URL, ignore
        }
      }
    } catch (err: any) {
      console.error("Error fetching company details:", err);
    }
  };

  const isWithinSameVendor = (vendorId: string, element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Node)) return false;
    
    // Check if element is within a vendor row with the same vendorId
    if (element instanceof HTMLElement) {
      const vendorRow = element.closest('[data-vendor-id]');
      if (vendorRow && vendorRow.getAttribute('data-vendor-id') === vendorId) {
        return true;
      }
    }
    
    // Also check if it's within the vendor container (for other interactive elements)
    const vendorContainer = vendorRefs.current[vendorId];
    if (vendorContainer && vendorContainer.contains(element)) {
      return true;
    }
    
    return false;
  };

  const handleVendorFieldBlur = (
    vendorId: string,
    field: "name" | "organizationNumber" | "emailDomain"
  ) => {
    const timeoutKey = `${vendorId}-${field}`;
    
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
    }

    const delayedSaveTimeout = setTimeout(() => {
      const activeElement = document.activeElement;
      if (isWithinSameVendor(vendorId, activeElement)) {
        return;
      }

      const data = vendorFormData[vendorId];
      if (!data) return;

      const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
      if (!vendor) return;

      let hasChanged = false;
      let value: string | undefined;

      if (field === "name" && data.name !== vendor.vendor.name) {
        hasChanged = true;
        value = data.name.trim();
      } else if (field === "organizationNumber") {
        const cleanValue = data.organizationNumber.replace(/\D/g, "");
        const currentValue = vendor.vendor.organizationNumber || "";
        if (cleanValue !== currentValue) {
          hasChanged = true;
          value = cleanValue || undefined;
        }
      } else if (field === "emailDomain" && data.emailDomain !== (vendor.vendor.emailDomain || "")) {
        hasChanged = true;
        value = data.emailDomain.trim() || undefined;
      }

      if (hasChanged && value !== undefined) {
        handleVendorFieldSave(vendorId, field, value);
      } else {
        // No changes, just exit edit mode for this field
        setEditingVendorFields((prev) => {
          const newFields = { ...prev };
          if (newFields[vendorId]) {
            const fields = new Set(newFields[vendorId]);
            fields.delete(field);
            if (fields.size === 0) {
              delete newFields[vendorId];
            } else {
              newFields[vendorId] = fields;
            }
          }
          return newFields;
        });
      }
    }, 150);

    saveTimeouts.current[timeoutKey] = delayedSaveTimeout;
  };

  const handleVendorFieldSave = async (
    vendorId: string,
    field: "name" | "organizationNumber" | "emailDomain",
    value: string | undefined
  ) => {
    const updatePayload: {
      name?: string;
      organizationNumber?: string;
      emailDomain?: string;
    } = {};

    if (field === "name" && value) {
      updatePayload.name = value;
    } else if (field === "organizationNumber") {
      if (value && value.length === 9) {
        updatePayload.organizationNumber = value;
      } else if (value === undefined || value === "") {
        updatePayload.organizationNumber = undefined;
      }
    } else if (field === "emailDomain") {
      updatePayload.emailDomain = value;
    }

    try {
      await onUpdateVendor(vendorId, updatePayload);
      
      // Exit edit mode for this field
      setEditingVendorFields((prev) => {
        const newFields = { ...prev };
        if (newFields[vendorId]) {
          const fields = new Set(newFields[vendorId]);
          fields.delete(field);
          if (fields.size === 0) {
            delete newFields[vendorId];
          } else {
            newFields[vendorId] = fields;
          }
        }
        return newFields;
      });

      // Clear form data for this vendor so it uses the updated vendor prop data
      // This ensures the displayed name updates immediately after save
      setVendorFormData((prev) => {
        const newData = { ...prev };
        delete newData[vendorId];
        return newData;
      });
    } catch (error) {
      console.error("Failed to update vendor field:", error);
    }
  };

  const handleVendorNameClick = (vendorId: string) => {
    // Close other edit modes
    setEditingContactId(null);
    setAddingContactVendorId(null);
    
    const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
    if (!vendor) return;

    // Initialize form data if not exists
    if (!vendorFormData[vendorId]) {
      setVendorFormData((prev) => ({
        ...prev,
        [vendorId]: {
          name: vendor.vendor.name,
          organizationNumber: vendor.vendor.organizationNumber || "",
          emailDomain: vendor.vendor.emailDomain || "",
        },
      }));
    }

    // Toggle edit mode for name field
    setEditingVendorFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[vendorId]) {
        newFields[vendorId] = new Set();
      }
      if (newFields[vendorId].has("name")) {
        newFields[vendorId].delete("name");
        if (newFields[vendorId].size === 0) {
          delete newFields[vendorId];
        }
      } else {
        newFields[vendorId].add("name");
        // Also enable org number and email domain when editing name
        newFields[vendorId].add("organizationNumber");
        newFields[vendorId].add("emailDomain");
      }
      return newFields;
    });
  };

  const handleCheckboxChange = async (
    vendorId: string,
    field: "shallReceiveRFI" | "shallReceiveRFP" | "shallReceiveShortlist",
    value: boolean
  ) => {
    // Optimistic update
    setCheckboxUpdates((prev) => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        [field]: value,
      },
    }));
    
    try {
      await onUpdateVendor(vendorId, { [field]: value });
      // Don't clear optimistic update here - let useEffect handle it when vendor data updates
    } catch (error) {
      // Revert optimistic update on error
      setCheckboxUpdates((prev) => {
        const newState = { ...prev };
        if (newState[vendorId]) {
          delete newState[vendorId][field];
          if (Object.keys(newState[vendorId]).length === 0) {
            delete newState[vendorId];
          }
        }
        return newState;
      });
    }
  };

  // Clear optimistic checkbox updates when vendor data matches
  useEffect(() => {
    setCheckboxUpdates((prev) => {
      const newState = { ...prev };
      let hasChanges = false;

      Object.keys(newState).forEach((vendorId) => {
        const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
        if (!vendor) {
          delete newState[vendorId];
          hasChanges = true;
          return;
        }

        const updates = newState[vendorId];
        const updatedFields: string[] = [];

        if (updates.shallReceiveRFI !== undefined) {
          if (vendor.vendor.shallReceiveRFI === updates.shallReceiveRFI) {
            updatedFields.push("shallReceiveRFI");
          }
        }
        if (updates.shallReceiveRFP !== undefined) {
          if (vendor.vendor.shallReceiveRFP === updates.shallReceiveRFP) {
            updatedFields.push("shallReceiveRFP");
          }
        }
        if (updates.shallReceiveShortlist !== undefined) {
          if (vendor.vendor.shallReceiveShortlist === updates.shallReceiveShortlist) {
            updatedFields.push("shallReceiveShortlist");
          }
        }

        if (updatedFields.length > 0) {
          updatedFields.forEach((field) => {
            delete updates[field as keyof typeof updates];
          });
          if (Object.keys(updates).length === 0) {
            delete newState[vendorId];
          }
          hasChanges = true;
        }
      });

      return hasChanges ? newState : prev;
    });
  }, [safeVendors]);

  const handleDeleteContact = async (vendorId: string, contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }
    try {
      await onDeleteContact(vendorId, contactId);
    } catch {
      // Error handling
    }
  };

  const toggleExpand = (vendorId: string) => {
    if (expandedVendorId === vendorId) {
      // Closing the same vendor - animate out first
      setIsVendorExpandedAnimating((prev) => ({
        ...prev,
        [vendorId]: false,
      }));
      setTimeout(() => {
        setExpandedVendorId(null);
        setEditingContactId(null);
        setAddingContactVendorId(null);
        setIsVendorExpandedAnimating((prev) => {
          const newState = { ...prev };
          delete newState[vendorId];
          return newState;
        });
        setEditingVendorFields((prev) => {
          const newFields = { ...prev };
          delete newFields[vendorId];
          return newFields;
        });
      }, 300);
    } else {
      // Opening a different vendor (or opening when none is open)
      const previousVendorId = expandedVendorId;
      
      if (previousVendorId) {
        // Start closing the previous vendor and opening the new one simultaneously
        setIsVendorExpandedAnimating((prev) => ({
          ...prev,
          [previousVendorId]: false,
          [vendorId]: false,
        }));
        
        // Switch to new vendor immediately
        setExpandedVendorId(vendorId);
        setEditingContactId(null);
        setAddingContactVendorId(null);
        setEditingVendorFields((prev) => {
          const newFields = { ...prev };
          delete newFields[vendorId];
          return newFields;
        });
        
        // Animate in the new vendor
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVendorExpandedAnimating((prev) => ({
              ...prev,
              [vendorId]: true,
            }));
          });
        });
        
        // Clean up the previous vendor after animation completes
        setTimeout(() => {
          setIsVendorExpandedAnimating((prev) => {
            const newState = { ...prev };
            delete newState[previousVendorId];
            return newState;
          });
        }, 300);
      } else {
        // No previous vendor - just open the new one
        setExpandedVendorId(vendorId);
        setEditingContactId(null);
        setAddingContactVendorId(null);
        setEditingVendorFields((prev) => {
          const newFields = { ...prev };
          delete newFields[vendorId];
          return newFields;
        });
        setIsVendorExpandedAnimating((prev) => ({
          ...prev,
          [vendorId]: false,
        }));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVendorExpandedAnimating((prev) => ({
              ...prev,
              [vendorId]: true,
            }));
          });
        });
      }
    }
  };

  const handleVendorSubmit = async (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    shallReceiveRFI?: boolean;
    shallReceiveRFP?: boolean;
    shallReceiveShortlist?: boolean;
    additionalData?: any;
    status?: VendorStatus;
  }) => {
    if (addingVendor) {
      await onAddVendor(data);
      setAddingVendor(false);
      if (onAddVendorFormChange) {
        onAddVendorFormChange(false);
      }
    }
  };

  const handleVendorCancel = () => {
    if (addingVendor) {
      setAddingVendor(false);
      if (onAddVendorFormChange) {
        onAddVendorFormChange(false);
      }
    }
  };

  const handleAddContactClick = (vendorId: string) => {
    // Close vendor edit mode if open
    setEditingVendorFields((prev) => {
      const newFields = { ...prev };
      delete newFields[vendorId];
      return newFields;
    });
    
    const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
    const isFirstContact = !vendor?.vendor.contacts || vendor.vendor.contacts.length === 0;
    
    // Initialize form data
    setAddingContactFormData((prev) => ({
      ...prev,
      [vendorId]: {
        firstName: "",
        lastName: "",
        email: "",
        isMainContact: isFirstContact,
      },
    }));
    
    if (editingContactId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
        setAddingContactVendorId(vendorId);
        setIsContactFormAnimating((prev) => ({
          ...prev,
          [`add-${vendorId}`]: false,
        }));
        if (expandedVendorId !== vendorId) {
          setExpandedVendorId(vendorId);
          setIsVendorExpandedAnimating((prev) => ({
            ...prev,
            [vendorId]: false,
          }));
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setIsVendorExpandedAnimating((prev) => ({
                ...prev,
                [vendorId]: true,
              }));
            });
          });
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsContactFormAnimating((prev) => ({
              ...prev,
              [`add-${vendorId}`]: true,
            }));
          });
        });
      }, 300);
    } else {
      setAddingContactVendorId(vendorId);
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${vendorId}`]: false,
      }));
      if (expandedVendorId !== vendorId) {
        setExpandedVendorId(vendorId);
        setIsVendorExpandedAnimating((prev) => ({
          ...prev,
          [vendorId]: false,
        }));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVendorExpandedAnimating((prev) => ({
              ...prev,
              [vendorId]: true,
            }));
          });
        });
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsContactFormAnimating((prev) => ({
            ...prev,
            [`add-${vendorId}`]: true,
          }));
        });
      });
    }
  };

  const updateContactFormField = (
    contactId: string,
    field: "firstName" | "lastName" | "email" | "isMainContact",
    value: string | boolean
  ) => {
    setContactFormData((prev) => ({
      ...prev,
      [contactId]: {
        ...prev[contactId],
        [field]: value,
      },
    }));
  };

  const isWithinSameContact = (vendorId: string, contactId: string, element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Node)) return false;
    
    // Check if element is within a contact row with the same contactId
    if (element instanceof HTMLElement) {
      const contactRow = element.closest('[data-contact-id]');
      if (contactRow && contactRow.getAttribute('data-contact-id') === contactId) {
        return true;
      }
    }
    
    // Also check if it's within the vendor container (for other interactive elements)
    const vendorContainer = vendorRefs.current[vendorId];
    if (vendorContainer && vendorContainer.contains(element)) {
      return true;
    }
    
    return false;
  };

  const handleContactFieldBlur = (
    vendorId: string,
    contactId: string,
    field: "firstName" | "lastName" | "email" | "isMainContact"
  ) => {
    const timeoutKey = `${contactId}-${field}`;
    
    if (contactSaveTimeouts.current[timeoutKey]) {
      clearTimeout(contactSaveTimeouts.current[timeoutKey]);
    }

    const delayedSaveTimeout = setTimeout(() => {
      const activeElement = document.activeElement;
      if (isWithinSameContact(vendorId, contactId, activeElement)) {
        return;
      }

      const data = contactFormData[contactId];
      if (!data) return;

      const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
      if (!vendor) return;
      const contact = vendor.vendor.contacts?.find((c) => c.id === contactId);
      if (!contact) return;

      let hasChanged = false;
      let value: string | boolean | undefined;

      if (field === "firstName" && data.firstName !== contact.firstName) {
        hasChanged = true;
        value = data.firstName.trim();
      } else if (field === "lastName" && data.lastName !== contact.lastName) {
        hasChanged = true;
        value = data.lastName.trim();
      } else if (field === "email" && data.email !== contact.email) {
        hasChanged = true;
        value = data.email.trim().toLowerCase();
      } else if (field === "isMainContact" && data.isMainContact !== contact.isMainContact) {
        hasChanged = true;
        value = data.isMainContact;
      }

      if (hasChanged && value !== undefined) {
        handleContactFieldSave(vendorId, contactId, field, value);
      } else {
        // No changes, just exit edit mode for this field
        setEditingContactFields((prev) => {
          const newFields = { ...prev };
          if (newFields[contactId]) {
            const fields = new Set(newFields[contactId]);
            fields.delete(field);
            if (fields.size === 0) {
              delete newFields[contactId];
              setEditingContactId(null);
            } else {
              newFields[contactId] = fields;
            }
          }
          return newFields;
        });
      }
    }, 150);

    contactSaveTimeouts.current[timeoutKey] = delayedSaveTimeout;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContactFieldSave = async (
    vendorId: string,
    contactId: string,
    field: "firstName" | "lastName" | "email" | "isMainContact",
    value: string | boolean
  ) => {
    const data = contactFormData[contactId];
    if (!data) return;

    // Validation
    if (field === "firstName" && typeof value === "string" && !value.trim()) {
      return; // Don't save empty first name
    }
    if (field === "lastName" && typeof value === "string" && !value.trim()) {
      return; // Don't save empty last name
    }
    if (field === "email" && typeof value === "string") {
      if (!value.trim()) {
        return; // Don't save empty email
      }
      if (!validateEmail(value)) {
        return; // Don't save invalid email
      }
    }

    const updatePayload: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isMainContact?: boolean;
    } = {};

    if (field === "firstName" && typeof value === "string") {
      updatePayload.firstName = value.trim();
      updatePayload.lastName = data.lastName;
      updatePayload.email = data.email;
      updatePayload.isMainContact = data.isMainContact;
    } else if (field === "lastName" && typeof value === "string") {
      updatePayload.firstName = data.firstName;
      updatePayload.lastName = value.trim();
      updatePayload.email = data.email;
      updatePayload.isMainContact = data.isMainContact;
    } else if (field === "email" && typeof value === "string") {
      updatePayload.firstName = data.firstName;
      updatePayload.lastName = data.lastName;
      updatePayload.email = value.trim().toLowerCase();
      updatePayload.isMainContact = data.isMainContact;
    } else if (field === "isMainContact" && typeof value === "boolean") {
      // Only allow setting to true, not unsetting
      if (!value) {
        return; // Don't allow unchecking main contact
      }
      
      updatePayload.firstName = data.firstName;
      updatePayload.lastName = data.lastName;
      updatePayload.email = data.email;
      updatePayload.isMainContact = true;

      // If setting this contact as main, unset main contact for all other contacts
      const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
      if (vendor && vendor.vendor.contacts) {
        const otherContacts = vendor.vendor.contacts.filter((c) => c.id !== contactId && c.isMainContact);
        // Update other contacts to remove main contact status
        for (const otherContact of otherContacts) {
          try {
            await onEditContact(vendorId, otherContact.id, {
              firstName: otherContact.firstName,
              lastName: otherContact.lastName,
              email: otherContact.email,
              isMainContact: false,
            });
          } catch (err) {
            console.error("Failed to unset main contact for other contact:", err);
          }
        }
      }
    }

    try {
      await onEditContact(vendorId, contactId, updatePayload);
      
      // Exit edit mode for this field
      setEditingContactFields((prev) => {
        const newFields = { ...prev };
        if (newFields[contactId]) {
          const fields = new Set(newFields[contactId]);
          fields.delete(field);
          if (fields.size === 0) {
            delete newFields[contactId];
            setEditingContactId(null);
          } else {
            newFields[contactId] = fields;
          }
        }
        return newFields;
      });
    } catch (error) {
      console.error("Failed to update contact field:", error);
    }
  };

  const handleContactNameClick = (vendorId: string, contactId: string) => {
    // Close vendor edit mode if open
    setEditingVendorFields((prev) => {
      const newFields = { ...prev };
      delete newFields[vendorId];
      return newFields;
    });
    
    const vendor = safeVendors.find((pv) => pv.vendor.id === vendorId);
    if (!vendor) return;
    const contact = vendor.vendor.contacts?.find((c) => c.id === contactId);
    if (!contact) return;

    // Close add contact form if open
    if (addingContactVendorId) {
      setAddingContactVendorId(null);
    }

    // Initialize form data if not exists
    if (!contactFormData[contactId]) {
      setContactFormData((prev) => ({
        ...prev,
        [contactId]: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          isMainContact: contact.isMainContact,
        },
      }));
    }

    // Toggle edit mode for contact fields
    setEditingContactFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[contactId]) {
        newFields[contactId] = new Set();
      }
      if (newFields[contactId].has("firstName")) {
        newFields[contactId].delete("firstName");
        newFields[contactId].delete("lastName");
        newFields[contactId].delete("email");
        newFields[contactId].delete("isMainContact");
        if (newFields[contactId].size === 0) {
          delete newFields[contactId];
          setEditingContactId(null);
        }
      } else {
        newFields[contactId].add("firstName");
        newFields[contactId].add("lastName");
        newFields[contactId].add("email");
        newFields[contactId].add("isMainContact");
        setEditingContactId(contactId);
      }
      return newFields;
    });

    if (expandedVendorId !== vendorId) {
      setExpandedVendorId(vendorId);
      setIsVendorExpandedAnimating((prev) => ({
        ...prev,
        [vendorId]: false,
      }));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVendorExpandedAnimating((prev) => ({
            ...prev,
            [vendorId]: true,
          }));
        });
      });
    }
  };

  const handleContactSubmit = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => {
    if (editingContactId && expandedVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      await onEditContact(expandedVendorId, editingContactId, data);
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
      }, 300);
    } else if (addingContactVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${addingContactVendorId}`]: false,
      }));
      await onAddContact(addingContactVendorId, data);
      setTimeout(() => {
        setAddingContactVendorId(null);
        setAddingContactFormData((prev) => {
          const newState = { ...prev };
          delete newState[addingContactVendorId];
          return newState;
        });
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`add-${addingContactVendorId}`];
          return newState;
        });
      }, 300);
    }
  };

  const updateAddingContactFormField = (
    vendorId: string,
    field: "firstName" | "lastName" | "email" | "isMainContact",
    value: string | boolean
  ) => {
    setAddingContactFormData((prev) => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        [field]: value,
      },
    }));
  };

  const handleAddingContactBlur = (vendorId: string) => {
    // Use setTimeout to check activeElement after blur event completes
    setTimeout(() => {
      const activeElement = document.activeElement;
      // Don't submit if user clicked Cancel button
      if (activeElement && activeElement.closest('button')?.textContent === 'Cancel') {
        return;
      }

      const data = addingContactFormData[vendorId];
      if (!data) return;

      // Validate and submit if all fields are filled
      if (data.firstName.trim() && data.lastName.trim() && data.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(data.email.trim())) {
          handleContactSubmit({
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email: data.email.trim().toLowerCase(),
            isMainContact: data.isMainContact,
          });
        }
      }
    }, 150);
  };

  const handleContactCancel = () => {
    if (editingContactId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`edit-${editingContactId}`]: false,
      }));
      setTimeout(() => {
        setEditingContactId(null);
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`edit-${editingContactId}`];
          return newState;
        });
      }, 300);
    }
    if (addingContactVendorId) {
      setIsContactFormAnimating((prev) => ({
        ...prev,
        [`add-${addingContactVendorId}`]: false,
      }));
      setTimeout(() => {
        setAddingContactVendorId(null);
        setAddingContactFormData((prev) => {
          const newState = { ...prev };
          delete newState[addingContactVendorId];
          return newState;
        });
        setIsContactFormAnimating((prev) => {
          const newState = { ...prev };
          delete newState[`add-${addingContactVendorId}`];
          return newState;
        });
      }, 300);
    }
  };

  return (
    <div className="bg-background-secondary rounded-lg shadow-md overflow-hidden border border-border-primary">
      {/* Empty state message */}
      {!addingVendor && safeVendors.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-text-secondary">No vendors added yet</p>
        </div>
      )}

      {(safeVendors.length > 0 || addingVendor) && (
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-border-primary">
            <thead className="bg-background-tertiary">
              <tr>
                <th className="px-0 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider align-top" style={{ width: '25%' }}>
                  <div className="flex items-center pl-[3.5rem]">
                    Name
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '25%' }}>
                  Main contact
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '8.33%' }}>
                  RFI?
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '8.33%' }}>
                  RFP?
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '8.33%' }}>
                  Short?
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '16.67%' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider" style={{ width: '8.33%' }}>
                  Contacts
                </th>
              </tr>
            </thead>
            <tbody className="bg-background-secondary divide-y divide-border-primary">
              {safeVendors.map((projectVendor) => {
                const vendor = projectVendor.vendor;
                const isExpanded = expandedVendorId === vendor.id;
                const contactCount = vendor.contacts?.length || 0;
                const mainContact = vendor.contacts?.find(
                  (c) => c.isMainContact
                );
                // Apply optimistic checkbox updates
                const optimisticUpdates = checkboxUpdates[vendor.id] || {};
                const shallReceiveRFI = optimisticUpdates.shallReceiveRFI !== undefined 
                  ? optimisticUpdates.shallReceiveRFI 
                  : vendor.shallReceiveRFI;
                const shallReceiveRFP = optimisticUpdates.shallReceiveRFP !== undefined 
                  ? optimisticUpdates.shallReceiveRFP 
                  : vendor.shallReceiveRFP;
                const shallReceiveShortlist = optimisticUpdates.shallReceiveShortlist !== undefined 
                  ? optimisticUpdates.shallReceiveShortlist 
                  : vendor.shallReceiveShortlist;
                
                // Get form data or use vendor data as fallback
                const currentFormData = vendorFormData[vendor.id] || {
                  name: vendor.name,
                  organizationNumber: vendor.organizationNumber || "",
                  emailDomain: vendor.emailDomain || "",
                };

                const isEditing = editingVendorFields[vendor.id]?.has("name");

                return (
                  <Fragment key={projectVendor.id}>
                    <tr 
                      ref={(el) => {
                        vendorRefs.current[vendor.id] = el;
                      }}
                      data-vendor-id={vendor.id}
                      className={`hover:bg-background-tertiary ${isEditing ? 'border-b-0' : ''}`}
                      style={{ position: 'relative', zIndex: isEditing ? 100 : 'auto' }}
                    >
                      <td 
                        className="px-0 py-0 align-top"
                        colSpan={isEditing ? 2 : 1}
                        style={{ position: 'relative' }}
                      >
                        <div className="flex items-stretch">
                          {/* Green panel - similar to Tasks */}
                          <button
                            onClick={() => toggleExpand(vendor.id)}
                            className="bg-primary-500 text-white flex items-center justify-center w-[3.5rem] px-2 cursor-pointer hover:bg-primary-600 transition-colors"
                            style={{ minHeight: '1.75rem' }}
                          >
                            {isExpanded ? (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            )}
                          </button>
                          {/* Name column content */}
                          <div className="px-4 py-4 flex-1 min-w-0 flex items-center relative" style={{ zIndex: isEditing ? 101 : 'auto' }}>
                            {isEditing ? (
                              <div className="relative w-full" ref={(el) => { searchResultsRefs.current[vendor.id] = el; }}>
                                <input
                                  ref={(el) => { nameInputRefs.current[vendor.id] = el; }}
                                  type="text"
                                  placeholder="Company Name"
                                  value={currentFormData.name}
                                  onChange={(e) => updateVendorFormField(vendor.id, "name", e.target.value)}
                                  onFocus={() => {
                                    if (searchResults[vendor.id]?.length > 0) {
                                      setShowSearchResults((prev) => ({ ...prev, [vendor.id]: true }));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    // Delay to allow clicking on search results
                                    setTimeout(() => {
                                      const activeElement = document.activeElement;
                                      const resultsContainer = searchResultsRefs.current[vendor.id];
                                      if (!resultsContainer?.contains(activeElement)) {
                                        setShowSearchResults((prev) => ({ ...prev, [vendor.id]: false }));
                                        handleVendorFieldBlur(vendor.id, "name");
                                      }
                                    }, 200);
                                  }}
                                  onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                      e.preventDefault();
                                      e.currentTarget.select();
                                      return;
                                    }
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                    if (e.key === "Escape") {
                                      setEditingVendorFields((prev) => {
                                        const newFields = { ...prev };
                                        if (newFields[vendor.id]) {
                                          const fields = new Set(newFields[vendor.id]);
                                          fields.delete("name");
                                          fields.delete("organizationNumber");
                                          fields.delete("emailDomain");
                                          if (fields.size === 0) {
                                            delete newFields[vendor.id];
                                          } else {
                                            newFields[vendor.id] = fields;
                                          }
                                        }
                                        return newFields;
                                      });
                                      setShowSearchResults((prev) => ({ ...prev, [vendor.id]: false }));
                                    }
                                  }}
                                  data-vendor-id={vendor.id}
                                  data-vendor-field="name"
                                  className="w-full text-sm font-medium text-text-primary px-2 py-1.5 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500 h-[1.75rem]"
                                  autoFocus
                                />
                                {searching[vendor.id] && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  </div>
                                )}
                                {/* Search Results Dropdown */}
                                {showSearchResults[vendor.id] && searchResults[vendor.id]?.length > 0 && (
                                  <div className="absolute z-[102] w-full mt-1 bg-background-tertiary border border-border-primary rounded-md shadow-lg max-h-60 overflow-auto top-full">
                                    {searchResults[vendor.id].map((result) => (
                                      <button
                                        key={result.organizationNumber}
                                        type="button"
                                        onClick={() => handleSelectCompany(vendor.id, result)}
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
                            ) : (
                              <div
                                className="text-sm font-medium text-text-primary truncate hover:text-primary-600 cursor-pointer h-[1.75rem] flex items-center"
                                onClick={() => handleVendorNameClick(vendor.id)}
                              >
                                {vendor.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Main Contact column - hidden when editing */}
                      {!isEditing && (
                        <td className="px-4 py-4 text-sm text-text-secondary">
                          {mainContact ? (
                            <div className="truncate">
                              {mainContact.firstName} {mainContact.lastName}
                            </div>
                          ) : (
                            <div className="truncate text-text-tertiary">-</div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 text-center align-top">
                        <div className="flex items-center justify-center h-[1.75rem]">
                          <input
                            type="checkbox"
                            checked={shallReceiveRFI}
                            onChange={(e) =>
                              handleCheckboxChange(vendor.id, "shallReceiveRFI", e.target.checked)
                            }
                            className="w-4 h-4 accent-primary-600 cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <div className="flex items-center justify-center h-[1.75rem]">
                          <input
                            type="checkbox"
                            checked={shallReceiveRFP}
                            onChange={(e) =>
                              handleCheckboxChange(vendor.id, "shallReceiveRFP", e.target.checked)
                            }
                            className="w-4 h-4 accent-primary-600 cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center align-top">
                        <div className="flex items-center justify-center h-[1.75rem]">
                          <input
                            type="checkbox"
                            checked={shallReceiveShortlist}
                            onChange={(e) =>
                              handleCheckboxChange(vendor.id, "shallReceiveShortlist", e.target.checked)
                            }
                            className="w-4 h-4 accent-primary-600 cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center h-[1.75rem]">
                          <select
                            value={projectVendor.status}
                            onChange={(e) =>
                              handleStatusChange(
                                vendor.id,
                                e.target.value as VendorStatus
                              )
                            }
                            disabled={updatingStatus === vendor.id}
                            className="w-full text-sm border-border-primary bg-background-secondary text-text-primary rounded-md focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      {/* Contacts column - shows badge */}
                      <td className="px-4 py-4 text-sm text-text-secondary align-top">
                        <div className="flex items-center h-[1.75rem]">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {contactCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Second row for edit mode - Org number, Email domain, Delete button */}
                    {isEditing && (
                      <tr data-vendor-id={vendor.id} style={{ position: 'relative', zIndex: 10 }}>
                        <td 
                          className="px-0 py-0"
                          colSpan={2}
                          style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                        >
                          <div className="flex items-stretch" style={{ pointerEvents: 'auto' }}>
                            {/* Green panel spacer */}
                            <div className="bg-primary-500 w-[3.5rem]"></div>
                            <div className="px-4 py-2 flex-1 min-w-0" style={{ pointerEvents: 'auto' }}>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Org Number (9 digits)"
                                  value={currentFormData.organizationNumber}
                                  onChange={(e) => {
                                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 9);
                                    updateVendorFormField(vendor.id, "organizationNumber", cleaned);
                                  }}
                                  onBlur={(e) => handleVendorFieldBlur(vendor.id, "organizationNumber")}
                                  onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                      e.preventDefault();
                                      e.currentTarget.select();
                                      return;
                                    }
                                    if (e.key === "Escape") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  data-vendor-id={vendor.id}
                                  data-vendor-field="organizationNumber"
                                  className="w-full text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }}
                                />
                                {lookingUpOrgNumber[vendor.id] && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  </div>
                                )}
                              </div>
                              {brregNames[vendor.id] && (
                                <p className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                                  ✓ Found in brreg.no: "{brregNames[vendor.id]}" - Name will be set automatically
                                </p>
                              )}
                              {currentFormData.organizationNumber.length === 9 && brregNames[vendor.id] === null && !lookingUpOrgNumber[vendor.id] && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                  ⚠ Organization number not found in brreg.no. Please verify the number or remove it.
                                </p>
                              )}
                              {(currentFormData.organizationNumber.length === 0 || (currentFormData.organizationNumber.length === 9 && brregNames[vendor.id] === undefined && !lookingUpOrgNumber[vendor.id])) && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Optional - 9 digits for Norwegian companies (must exist in brreg.no)
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td 
                          colSpan={4}
                          className="px-4 py-2 align-top"
                          style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                        >
                          <div style={{ pointerEvents: 'auto' }}>
                            <input
                              type="text"
                              placeholder="Domain name"
                              value={currentFormData.emailDomain}
                              onChange={(e) => updateVendorFormField(vendor.id, "emailDomain", e.target.value)}
                              onBlur={(e) => handleVendorFieldBlur(vendor.id, "emailDomain")}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                  e.preventDefault();
                                  e.currentTarget.select();
                                  return;
                                }
                                if (e.key === "Escape") {
                                  e.currentTarget.blur();
                                }
                              }}
                              data-vendor-id={vendor.id}
                              data-vendor-field="emailDomain"
                              className="w-full text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }}
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Optional - The email domain for this company
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top" style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}>
                          <div className="flex justify-end" style={{ minHeight: '100%', pointerEvents: 'auto' }}>
                            <div className="flex flex-col justify-end">
                              <button
                                onClick={async () => {
                                  if (confirm("Are you sure you want to remove this vendor from the project?")) {
                                    await onDeleteVendor(vendor.id);
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}


                    {/* Expanded row showing contacts */}
                    {(isExpanded || vendor.id in isVendorExpandedAnimating) && (
                      <tr style={{ position: 'relative', zIndex: 1 }}>
                        <td
                          colSpan={7}
                          className="px-0 py-0 bg-background-secondary overflow-hidden"
                        >
                          <div
                            className={`transition-all duration-300 ease-out ${
                              isVendorExpandedAnimating[vendor.id]
                                ? "max-h-[2000px] opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="space-y-3 pl-[3.5rem] pr-4 py-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm text-text-primary">
                                Contact Persons
                              </h4>
                              {!addingContactVendorId && (
                                <button
                                  onClick={() =>
                                    handleAddContactClick(vendor.id)
                                  }
                                  className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center gap-1"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                  Add Contact
                                </button>
                              )}
                            </div>

                            {/* Contact List */}
                            {vendor.contacts && vendor.contacts.length > 0 && (
                                <div className="space-y-2">
                                  {vendor.contacts.map((contact) => {
                                    const isEditing = editingContactFields[contact.id]?.has("firstName");
                                    const currentContactData = contactFormData[contact.id] || {
                                      firstName: contact.firstName,
                                      lastName: contact.lastName,
                                      email: contact.email,
                                      isMainContact: contact.isMainContact,
                                    };

                                    return (
                                      <div key={contact.id} data-contact-id={contact.id}>
                                        <div
                                          className="grid grid-cols-12 gap-4 items-center bg-background-tertiary p-3 rounded-md border border-border-primary"
                                        >
                                          {/* First name - aligns with Name column (3 cols) */}
                                          <div className="col-span-3 min-w-0">
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentContactData.firstName}
                                                onChange={(e) => updateContactFormField(contact.id, "firstName", e.target.value)}
                                                onBlur={() => handleContactFieldBlur(vendor.id, contact.id, "firstName")}
                                                onKeyDown={(e) => {
                                                  if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                                    e.preventDefault();
                                                    e.currentTarget.select();
                                                    return;
                                                  }
                                                  if (e.key === "Enter") {
                                                    e.currentTarget.blur();
                                                  }
                                                  if (e.key === "Escape") {
                                                    setEditingContactFields((prev) => {
                                                      const newFields = { ...prev };
                                                      if (newFields[contact.id]) {
                                                        const fields = new Set(newFields[contact.id]);
                                                        fields.delete("firstName");
                                                        fields.delete("lastName");
                                                        fields.delete("email");
                                                        fields.delete("isMainContact");
                                                        if (fields.size === 0) {
                                                          delete newFields[contact.id];
                                                          setEditingContactId(null);
                                                        } else {
                                                          newFields[contact.id] = fields;
                                                        }
                                                      }
                                                      return newFields;
                                                    });
                                                  }
                                                }}
                                                className="w-full text-sm font-medium text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                autoFocus
                                              />
                                            ) : (
                                              <div
                                                className="text-sm font-medium text-text-primary truncate hover:text-primary-600 cursor-pointer"
                                                onClick={() => handleContactNameClick(vendor.id, contact.id)}
                                              >
                                                {contact.firstName} {contact.lastName}
                                              </div>
                                            )}
                                          </div>
                                          {/* Last name - beneath Main Contact column (3 cols) */}
                                          <div className="col-span-3 min-w-0">
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentContactData.lastName}
                                                onChange={(e) => updateContactFormField(contact.id, "lastName", e.target.value)}
                                                onBlur={() => handleContactFieldBlur(vendor.id, contact.id, "lastName")}
                                                onKeyDown={(e) => {
                                                  if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                                    e.preventDefault();
                                                    e.currentTarget.select();
                                                    return;
                                                  }
                                                  if (e.key === "Enter") {
                                                    e.currentTarget.blur();
                                                  }
                                                  if (e.key === "Escape") {
                                                    e.currentTarget.blur();
                                                  }
                                                }}
                                                className="w-full text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                              />
                                            ) : null}
                                          </div>
                                          {/* Email starts at RFI? column, Main contact checkbox at the end */}
                                          <div className="col-span-6 min-w-0 flex items-center justify-between gap-4">
                                            {isEditing ? (
                                              <>
                                                <input
                                                  type="email"
                                                  value={currentContactData.email}
                                                  onChange={(e) => updateContactFormField(contact.id, "email", e.target.value)}
                                                  onBlur={() => handleContactFieldBlur(vendor.id, contact.id, "email")}
                                                  onKeyDown={(e) => {
                                                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                                      e.preventDefault();
                                                      e.currentTarget.select();
                                                      return;
                                                    }
                                                    if (e.key === "Enter") {
                                                      e.currentTarget.blur();
                                                    }
                                                    if (e.key === "Escape") {
                                                      e.currentTarget.blur();
                                                    }
                                                  }}
                                                  className="flex-1 text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                                <label className="flex items-center gap-2 flex-shrink-0">
                                                  <input
                                                    type="checkbox"
                                                    checked={currentContactData.isMainContact}
                                                    disabled={currentContactData.isMainContact}
                                                    onChange={(e) => {
                                                      // Only allow checking, not unchecking
                                                      if (e.target.checked && !currentContactData.isMainContact) {
                                                        updateContactFormField(contact.id, "isMainContact", true);
                                                        handleContactFieldSave(vendor.id, contact.id, "isMainContact", true);
                                                      }
                                                    }}
                                                    className="w-4 h-4 accent-primary-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                  />
                                                  <span className="text-xs text-text-secondary">
                                                    {currentContactData.isMainContact ? "Main contact" : "Set as main contact"}
                                                  </span>
                                                </label>
                                              </>
                                            ) : (
                                              <>
                                                <div className="text-sm text-text-secondary truncate">
                                                  {contact.email}
                                                </div>
                                                {contact.isMainContact && (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 flex-shrink-0">
                                                    Main
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        {/* Delete button below, right-aligned */}
                                        {isEditing && (
                                          <div className="flex justify-end mt-2 pr-4">
                                            <button
                                              onClick={async () => {
                                                if (confirm("Are you sure you want to delete this contact?")) {
                                                  await handleDeleteContact(vendor.id, contact.id);
                                                  setEditingContactFields((prev) => {
                                                    const newFields = { ...prev };
                                                    delete newFields[contact.id];
                                                    return newFields;
                                                  });
                                                  setEditingContactId(null);
                                                }
                                              }}
                                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                            )}

                            {/* Empty State */}
                            {(!vendor.contacts ||
                              vendor.contacts.length === 0) &&
                              !addingContactVendorId &&
                              Object.keys(editingContactFields).length === 0 && (
                                <div className="text-center py-4">
                                  <p className="text-sm text-text-secondary italic">
                                    No contacts added yet
                                  </p>
                                </div>
                              )}

                            {/* Inline Add Contact Form - appears below existing contacts */}
                            {addingContactVendorId === vendor.id && (() => {
                              const isFirstContact = !vendor.contacts || vendor.contacts.length === 0;
                              const currentFormData = addingContactFormData[vendor.id] || {
                                firstName: "",
                                lastName: "",
                                email: "",
                                isMainContact: isFirstContact,
                              };

                              return (
                                <div
                                  className={`mt-2 transition-all duration-300 ease-out ${
                                    isContactFormAnimating[`add-${vendor.id}`]
                                      ? "opacity-100 translate-y-0"
                                      : "opacity-0 -translate-y-4"
                                  }`}
                                >
                                  <div
                                    className="grid grid-cols-12 gap-4 items-center bg-background-tertiary p-3 rounded-md border border-border-primary"
                                  >
                                    {/* First name - aligns with Name column (3 cols) */}
                                    <div className="col-span-3 min-w-0">
                                      <input
                                        type="text"
                                        placeholder="First name"
                                        value={currentFormData.firstName}
                                        onChange={(e) => updateAddingContactFormField(vendor.id, "firstName", e.target.value)}
                                        onBlur={() => handleAddingContactBlur(vendor.id)}
                                        onKeyDown={(e) => {
                                          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                            e.preventDefault();
                                            e.currentTarget.select();
                                            return;
                                          }
                                          if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                          }
                                          if (e.key === "Escape") {
                                            handleContactCancel();
                                          }
                                        }}
                                        className="w-full text-sm font-medium text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        autoFocus
                                      />
                                    </div>
                                    {/* Last name - beneath Main Contact column (3 cols) */}
                                    <div className="col-span-3 min-w-0">
                                      <input
                                        type="text"
                                        placeholder="Last name"
                                        value={currentFormData.lastName}
                                        onChange={(e) => updateAddingContactFormField(vendor.id, "lastName", e.target.value)}
                                        onBlur={() => handleAddingContactBlur(vendor.id)}
                                        onKeyDown={(e) => {
                                          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                            e.preventDefault();
                                            e.currentTarget.select();
                                            return;
                                          }
                                          if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                          }
                                          if (e.key === "Escape") {
                                            handleContactCancel();
                                          }
                                        }}
                                        className="w-full text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      />
                                    </div>
                                    {/* Email starts at RFI? column, Main contact checkbox at the end */}
                                    <div className="col-span-6 min-w-0 flex items-center justify-between gap-4">
                                      <input
                                        type="email"
                                        placeholder="Email"
                                        value={currentFormData.email}
                                        onChange={(e) => updateAddingContactFormField(vendor.id, "email", e.target.value)}
                                        onBlur={() => handleAddingContactBlur(vendor.id)}
                                        onKeyDown={(e) => {
                                          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                            e.preventDefault();
                                            e.currentTarget.select();
                                            return;
                                          }
                                          if (e.key === "Enter") {
                                            e.currentTarget.blur();
                                          }
                                          if (e.key === "Escape") {
                                            handleContactCancel();
                                          }
                                        }}
                                        className="flex-1 text-sm text-text-primary px-2 py-1 border border-border-primary bg-background-secondary rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      />
                                      {!isFirstContact && (
                                        <label className="flex items-center gap-2 flex-shrink-0">
                                          <input
                                            type="checkbox"
                                            checked={currentFormData.isMainContact}
                                            onChange={(e) => updateAddingContactFormField(vendor.id, "isMainContact", e.target.checked)}
                                            className="w-4 h-4 accent-primary-600 cursor-pointer"
                                          />
                                          <span className="text-xs text-text-secondary">
                                            {currentFormData.isMainContact ? "Main contact" : "Set as main contact"}
                                          </span>
                                        </label>
                                      )}
                                    </div>
                                  </div>
                                  {/* Cancel button below, right-aligned */}
                                  <div className="flex justify-end mt-2 pr-4">
                                    <button
                                      onClick={handleContactCancel}
                                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Inline Add Vendor Form - appears after last vendor */}
              {addingVendor && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-4 bg-background-secondary"
                  >
                    <VendorForm
                      projectId={projectId}
                      onSubmit={handleVendorSubmit}
                      onCancel={handleVendorCancel}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
