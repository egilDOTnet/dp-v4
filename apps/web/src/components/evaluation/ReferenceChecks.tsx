"use client";

import { useEffect, useState, useRef } from "react";
import { api, ReferenceCheck, ProjectVendor, ReferenceCheckTemplate } from "@/lib/api";
import { LoadingSpinner, Card, CardHeader, CardBody, Button, FormField, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, VendorSelector } from "@/components/ui";
import type { Vendor } from "@/components/ui/VendorSelector";
import WysiwygEditor from "@/components/WysiwygEditor";
import { formatDateTimeISO } from "@/lib/date-utils";

interface ReferenceChecksProps {
  projectId: string;
}

export function ReferenceChecks({ projectId }: ReferenceChecksProps) {
  const [referenceChecks, setReferenceChecks] = useState<ReferenceCheck[]>([]);
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [template, setTemplate] = useState<ReferenceCheckTemplate | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [vendorDropdownJustClosed, setVendorDropdownJustClosed] = useState(false);

  // Form data for creating new reference check
  const [newFormData, setNewFormData] = useState({
    selectedVendor: null as Vendor | null,
    companyName: "",
    contactName: "",
    contactPosition: "" as string | null,
    contactEmail: "" as string | null,
    contactPhone: "" as string | null,
    content: "",
  });

  // Editing state - tracks which fields are being edited for each reference check
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  // Form data for editing existing reference checks
  const [formData, setFormData] = useState<Record<string, Partial<ReferenceCheck>>>({});
  // Saving state
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());

  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const newFormRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");
  const templateLoadingRef = useRef(false);
  const templateLoadedRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `references-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);
    setError(null);

    Promise.all([
      api.evaluation.references.list(projectId),
      api.projects.vendors.list(projectId),
    ])
      .then(([checksData, vendorsData]) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setReferenceChecks(checksData);
          setVendors(vendorsData);
        }
      })
      .catch((err: any) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setError(err.message || "Failed to load reference checks");
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
  }, [projectId]);

  // Load template on mount
  useEffect(() => {
    // Prevent duplicate calls (React Strict Mode protection)
    if (templateLoadingRef.current || templateLoadedRef.current) {
      return;
    }

    templateLoadingRef.current = true;

    api.admin.referenceCheckTemplate
      .get()
      .then((templateData) => {
        // Only update if template hasn't been loaded yet
        if (!templateLoadedRef.current) {
          setTemplate(templateData);
          // Pre-populate new form content with template
          if (templateData.content) {
            setNewFormData((prev) => ({ ...prev, content: templateData.content }));
          }
          templateLoadedRef.current = true;
        }
      })
      .catch((_err: any) => {
        // Template might not exist yet, that's okay
        console.log("No reference check template found");
      })
      .finally(() => {
        templateLoadingRef.current = false;
      });
  }, []);

  // Handle clicks outside of editing reference checks to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks for a short time after dropdown closes to prevent form from closing
      if (vendorDropdownJustClosed) {
        return;
      }

      const target = event.target as Node;

      // Check if click is outside any reference check container
      let clickedInsideRef = false;
      Object.values(refs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideRef = true;
        }
      });

      // Also check if clicking on the create form (including header)
      if (isCreatingNew && newFormRef.current && newFormRef.current.contains(target)) {
        clickedInsideRef = true;
      }

      // Also check if clicking on the vendor dropdown (which renders outside the form ref via Portal)
      if (isCreatingNew) {
        // Check for dropdown menu content
        const dropdownContent = document.querySelector('[role="menu"]');
        if (dropdownContent && dropdownContent.contains(target)) {
          clickedInsideRef = true;
          return;
        }
        // Check if click is on any element with data-radix-dropdown-menu attributes
        const radixElement = (target as HTMLElement)?.closest('[data-radix-dropdown-menu-content]') ||
                            (target as HTMLElement)?.closest('[data-radix-collection-item]');
        if (radixElement) {
          clickedInsideRef = true;
          return;
        }
      }

      if (!clickedInsideRef) {
        // If creating new, handle blur logic
        if (isCreatingNew) {
          handleNewFormBlur();
        }

        // Save any pending changes before exiting edit mode
        Object.entries(editingFields).forEach(([refId, fields]) => {
          const data = formData[refId];
          const refCheck = referenceChecks.find((r) => r.id === refId);

          if (data && refCheck) {
            fields.forEach((field) => {
              if (
                (field === "companyName" && data.companyName?.trim() !== refCheck.companyName?.trim()) ||
                (field === "contactName" && data.contactName?.trim() !== refCheck.contactName?.trim()) ||
                (field === "contactPosition" && (data.contactPosition ?? null) !== (refCheck.contactPosition ?? null)) ||
                (field === "contactEmail" && (data.contactEmail ?? null) !== (refCheck.contactEmail ?? null)) ||
                (field === "contactPhone" && (data.contactPhone ?? null) !== (refCheck.contactPhone ?? null)) ||
                (field === "content" && (data.content ?? "") !== (refCheck.content ?? ""))
              ) {
                handleFieldSave(refId, field, data[field as keyof typeof data] as any);
              } else {
                // No changes, just exit edit mode for this field
                setEditingFields((prev) => {
                  const newFields = { ...prev };
                  if (newFields[refId]) {
                    newFields[refId].delete(field);
                    if (newFields[refId].size === 0) {
                      delete newFields[refId];
                    }
                  }
                  return newFields;
                });
              }
            });
          }
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreatingNew, editingFields, formData, referenceChecks, vendorDropdownJustClosed]);

  const loadData = async () => {
    if (!projectId) return;

    // Create a unique key for this load
    const loadKey = `references-${projectId}`;
    
    // Prevent duplicate calls
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);
    setError(null);

    try {
      const [checksData, vendorsData] = await Promise.all([
        api.evaluation.references.list(projectId),
        api.projects.vendors.list(projectId),
      ]);
      // Only update if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setReferenceChecks(checksData);
        setVendors(vendorsData);
      }
    } catch (err: any) {
      // Only log error if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setError(err.message || "Failed to load reference checks");
      }
    } finally {
      // Only update loading state if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const hasFormChanges = () => {
    // Check if form has any meaningful data (different from initial state)
    const hasData =
      newFormData.selectedVendor ||
      newFormData.companyName.trim() ||
      newFormData.contactName.trim() ||
      newFormData.contactPosition?.trim() ||
      newFormData.contactEmail?.trim() ||
      newFormData.contactPhone?.trim() ||
      (newFormData.content.trim() && newFormData.content !== (template?.content || ""));
    return hasData;
  };

  const handleCancelNew = () => {
    setIsCreatingNew(false);
    setNewFormData({
      selectedVendor: null,
      companyName: "",
      contactName: "",
      contactPosition: null,
      contactEmail: null,
      contactPhone: null,
      content: template?.content || "",
    });
    setShowCancelConfirm(false);
  };

  const handleNewFormBlur = () => {
    // Check if form has meaningful data
    if (hasFormChanges()) {
      // Show confirmation dialog
      setShowCancelConfirm(true);
    } else {
      // No changes, just close
      handleCancelNew();
    }
  };

  const handleCreate = async () => {
    if (!newFormData.selectedVendor || !newFormData.companyName.trim() || !newFormData.contactName.trim()) {
      setError("Please fill in vendor, company name, and contact name");
      return;
    }

    try {
      setError(null);
      await api.evaluation.references.create(projectId, {
        vendorId: newFormData.selectedVendor.id,
        companyName: newFormData.companyName.trim(),
        contactName: newFormData.contactName.trim(),
        contactPosition: newFormData.contactPosition?.trim() || null,
        contactEmail: newFormData.contactEmail?.trim() || null,
        contactPhone: newFormData.contactPhone?.trim() || null,
        content: newFormData.content,
      });

      // Reset form
      setNewFormData({
        selectedVendor: null,
        companyName: "",
        contactName: "",
        contactPosition: null,
        contactEmail: null,
        contactPhone: null,
        content: template?.content || "",
      });
      setIsCreatingNew(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create reference check");
    }
  };

  const handleDelete = async (referenceId: string) => {
    try {
      setDeleting(true);
      await api.evaluation.references.delete(projectId, referenceId);
      setDeleteConfirmId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete reference check");
      setDeleteConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  const ensureFormData = (refCheck: ReferenceCheck) => {
    if (!formData[refCheck.id]) {
      setFormData((prev) => ({
        ...prev,
        [refCheck.id]: {
          companyName: refCheck.companyName,
          contactName: refCheck.contactName,
          contactPosition: refCheck.contactPosition,
          contactEmail: refCheck.contactEmail,
          contactPhone: refCheck.contactPhone,
          content: refCheck.content,
        },
      }));
    }
  };

  const handleFieldFocus = (refId: string, field: string, refCheck: ReferenceCheck) => {
    ensureFormData(refCheck);
    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[refId]) {
        newFields[refId] = new Set();
      }
      newFields[refId].add(field);
      return newFields;
    });
  };

  const handleFieldBlur = (refId: string, field: string, _e: React.FocusEvent) => {
    const data = formData[refId];
    const refCheck = referenceChecks.find((r) => r.id === refId);

    if (data && refCheck) {
      let hasChanged = false;
      if (
        (field === "companyName" && data.companyName?.trim() !== refCheck.companyName?.trim()) ||
        (field === "contactName" && data.contactName?.trim() !== refCheck.contactName?.trim()) ||
        (field === "contactPosition" && (data.contactPosition ?? null) !== (refCheck.contactPosition ?? null)) ||
        (field === "contactEmail" && (data.contactEmail ?? null) !== (refCheck.contactEmail ?? null)) ||
        (field === "contactPhone" && (data.contactPhone ?? null) !== (refCheck.contactPhone ?? null)) ||
        (field === "content" && (data.content ?? "") !== (refCheck.content ?? ""))
      ) {
        hasChanged = true;
      }

      if (hasChanged) {
        handleFieldSave(refId, field, data[field as keyof typeof data] as any);
      } else {
        // No changes, just exit edit mode for this field
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[refId]) {
            newFields[refId].delete(field);
            if (newFields[refId].size === 0) {
              delete newFields[refId];
            }
          }
          return newFields;
        });
      }
    }
  };

  const handleFieldSave = async (refId: string, field: string, value: any) => {
    if (savingFields.has(refId)) return;

    setSavingFields((prev) => new Set(prev).add(refId));

    try {
      const updatePayload: any = {};
      if (field === "companyName") {
        updatePayload.companyName = value?.trim() || "";
      } else if (field === "contactName") {
        updatePayload.contactName = value?.trim() || "";
      } else if (field === "contactPosition") {
        updatePayload.contactPosition = value?.trim() || null;
      } else if (field === "contactEmail") {
        updatePayload.contactEmail = value?.trim() || null;
      } else if (field === "contactPhone") {
        updatePayload.contactPhone = value?.trim() || null;
      } else if (field === "content") {
        updatePayload.content = value || "";
      }

      await api.evaluation.references.update(projectId, refId, updatePayload);
      await loadData();

      // Exit edit mode for this field
      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[refId]) {
          newFields[refId].delete(field);
          if (newFields[refId].size === 0) {
            delete newFields[refId];
          }
        }
        return newFields;
      });
    } catch (err: any) {
      setError(err.message || `Failed to update ${field}`);
    } finally {
      setSavingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(refId);
        return newSet;
      });
    }
  };

  const handleFieldChange = (refId: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [refId]: {
        ...prev[refId],
        [field]: value,
      },
    }));
  };

  // Group reference checks by vendor
  const groupedByVendor = referenceChecks.reduce((acc, ref) => {
    if (!acc[ref.vendorId]) {
      acc[ref.vendorId] = [];
    }
    acc[ref.vendorId].push(ref);
    return acc;
  }, {} as Record<string, ReferenceCheck[]>);

  // Get vendor name for a vendor ID (use vendorName from reference check if available)
  const getVendorName = (vendorId: string, checks: ReferenceCheck[]) => {
    if (checks.length > 0 && checks[0].vendorName) {
      return checks[0].vendorName;
    }
    const vendor = vendors.find((v) => v.vendor.id === vendorId);
    return vendor?.vendor.name || "Unknown Vendor";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-text-primary">Reference Checks</h2>
            {!isCreatingNew && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setIsCreatingNew(true);
                  setNewFormData({
                    selectedVendor: null,
                    companyName: "",
                    contactName: "",
                    contactPosition: null,
                    contactEmail: null,
                    contactPhone: null,
                    content: template?.content || "",
                  });
                }}
              >
                Create Reference Check
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {/* Create New Form */}
          {isCreatingNew && (
            <Card className="border-2 border-primary-500 mb-6" ref={newFormRef}>
          <CardHeader>
            <h3 className="text-lg font-semibold text-text-primary">New Reference Check</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <VendorSelector
                label="Vendor"
                required
                value={newFormData.selectedVendor}
                options={vendors.map((pv) => ({
                  id: pv.vendor.id,
                  name: pv.vendor.name,
                  organizationNumber: pv.vendor.organizationNumber,
                  emailDomain: pv.vendor.emailDomain,
                }))}
                onChange={(vendor) => setNewFormData((prev) => ({ ...prev, selectedVendor: vendor }))}
                onOpenChange={(open) => {
                  if (!open) {
                    // Dropdown just closed, set flag to ignore next click-outside event
                    setVendorDropdownJustClosed(true);
                    setTimeout(() => {
                      setVendorDropdownJustClosed(false);
                    }, 200);
                  }
                }}
              />

              <FormField label="Company Name" required>
                <Input
                  value={newFormData.companyName}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Company name"
                />
              </FormField>

              <FormField label="Contact Name" required>
                <Input
                  value={newFormData.contactName}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Contact name"
                />
              </FormField>

              <FormField label="Contact Position">
                <Input
                  value={newFormData.contactPosition || ""}
                  onChange={(e) =>
                    setNewFormData((prev) => ({ ...prev, contactPosition: e.target.value || null }))
                  }
                  placeholder="Position (optional)"
                />
              </FormField>

              <FormField label="Contact Email">
                <Input
                  type="email"
                  value={newFormData.contactEmail || ""}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, contactEmail: e.target.value || null }))}
                  placeholder="email@example.com (optional)"
                />
              </FormField>

              <FormField label="Contact Phone">
                <Input
                  type="tel"
                  value={newFormData.contactPhone || ""}
                  onChange={(e) => setNewFormData((prev) => ({ ...prev, contactPhone: e.target.value || null }))}
                  placeholder="Phone number (optional)"
                />
              </FormField>

              <FormField label="Content" required>
                <WysiwygEditor
                  value={newFormData.content}
                  onChange={(value) => setNewFormData((prev) => ({ ...prev, content: value }))}
                  placeholder="Enter reference check notes..."
                />
              </FormField>

              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => handleNewFormBlur()}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreate}>
                  Create Reference Check
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
          )}

          {/* Reference Checks Grouped by Vendor */}
          {Object.keys(groupedByVendor).length === 0 && !isCreatingNew && (
            <div className="text-center py-12 text-text-secondary">
              <p>No reference checks yet. Create one to get started.</p>
            </div>
          )}

          {Object.entries(groupedByVendor).map(([vendorId, checks]) => (
        <div key={vendorId} className="space-y-4">
          <h3 className="text-xl font-semibold text-text-primary">{getVendorName(vendorId, checks)}</h3>
          <div className="space-y-4">
            {checks.map((refCheck) => {
              const isEditing = editingFields[refCheck.id] || new Set();
              const isSaving = savingFields.has(refCheck.id);
              const data = formData[refCheck.id];

              return (
                <Card key={refCheck.id} ref={(el) => (refs.current[refCheck.id] = el)}>
                  <CardBody>
                    <div className="space-y-4">
                      {/* Date/Time - Read-only */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Created
                          </label>
                          <p className="text-sm text-text-primary">
                            {formatDateTimeISO(refCheck.createdAt)}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Updated
                          </label>
                          <p className="text-sm text-text-primary">
                            {formatDateTimeISO(refCheck.updatedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Company Name */}
                      <FormField label="Company Name" required>
                        {isEditing.has("companyName") ? (
                          <Input
                            value={data?.companyName ?? refCheck.companyName}
                            onChange={(e) => handleFieldChange(refCheck.id, "companyName", e.target.value)}
                            onBlur={(e) => handleFieldBlur(refCheck.id, "companyName", e)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            autoFocus
                            disabled={isSaving}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary"
                            onClick={() => handleFieldFocus(refCheck.id, "companyName", refCheck)}
                          >
                            {refCheck.companyName || <span className="text-text-tertiary">Click to edit</span>}
                          </div>
                        )}
                      </FormField>

                      {/* Contact Name */}
                      <FormField label="Contact Name" required>
                        {isEditing.has("contactName") ? (
                          <Input
                            value={data?.contactName ?? refCheck.contactName}
                            onChange={(e) => handleFieldChange(refCheck.id, "contactName", e.target.value)}
                            onBlur={(e) => handleFieldBlur(refCheck.id, "contactName", e)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            autoFocus
                            disabled={isSaving}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary"
                            onClick={() => handleFieldFocus(refCheck.id, "contactName", refCheck)}
                          >
                            {refCheck.contactName || <span className="text-text-tertiary">Click to edit</span>}
                          </div>
                        )}
                      </FormField>

                      {/* Contact Position */}
                      <FormField label="Contact Position">
                        {isEditing.has("contactPosition") ? (
                          <Input
                            value={data?.contactPosition ?? refCheck.contactPosition ?? ""}
                            onChange={(e) =>
                              handleFieldChange(refCheck.id, "contactPosition", e.target.value || null)
                            }
                            onBlur={(e) => handleFieldBlur(refCheck.id, "contactPosition", e)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="Position (optional)"
                            autoFocus
                            disabled={isSaving}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary"
                            onClick={() => handleFieldFocus(refCheck.id, "contactPosition", refCheck)}
                          >
                            {refCheck.contactPosition || <span className="text-text-tertiary">Click to edit (optional)</span>}
                          </div>
                        )}
                      </FormField>

                      {/* Contact Email */}
                      <FormField label="Contact Email">
                        {isEditing.has("contactEmail") ? (
                          <Input
                            type="email"
                            value={data?.contactEmail ?? refCheck.contactEmail ?? ""}
                            onChange={(e) => handleFieldChange(refCheck.id, "contactEmail", e.target.value || null)}
                            onBlur={(e) => handleFieldBlur(refCheck.id, "contactEmail", e)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="email@example.com (optional)"
                            autoFocus
                            disabled={isSaving}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary"
                            onClick={() => handleFieldFocus(refCheck.id, "contactEmail", refCheck)}
                          >
                            {refCheck.contactEmail || <span className="text-text-tertiary">Click to edit (optional)</span>}
                          </div>
                        )}
                      </FormField>

                      {/* Contact Phone */}
                      <FormField label="Contact Phone">
                        {isEditing.has("contactPhone") ? (
                          <Input
                            type="tel"
                            value={data?.contactPhone ?? refCheck.contactPhone ?? ""}
                            onChange={(e) => handleFieldChange(refCheck.id, "contactPhone", e.target.value || null)}
                            onBlur={(e) => handleFieldBlur(refCheck.id, "contactPhone", e)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="Phone number (optional)"
                            autoFocus
                            disabled={isSaving}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary"
                            onClick={() => handleFieldFocus(refCheck.id, "contactPhone", refCheck)}
                          >
                            {refCheck.contactPhone || <span className="text-text-tertiary">Click to edit (optional)</span>}
                          </div>
                        )}
                      </FormField>

                      {/* Content */}
                      <FormField label="Content" required>
                        {isEditing.has("content") ? (
                          <div className="space-y-2">
                            <WysiwygEditor
                              value={data?.content ?? refCheck.content}
                              onChange={(value) => handleFieldChange(refCheck.id, "content", value)}
                              placeholder="Enter reference check notes..."
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  const currentData = formData[refCheck.id];
                                  if (currentData && currentData.content !== undefined) {
                                    handleFieldSave(refCheck.id, "content", currentData.content);
                                  }
                                }}
                                disabled={isSaving}
                              >
                                {isSaving ? "Saving..." : "Save Content"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="px-3 py-2 border border-border-primary rounded-md bg-background-secondary cursor-text hover:bg-background-tertiary min-h-[100px] prose prose-sm max-w-none dark:prose-invert"
                            onClick={() => handleFieldFocus(refCheck.id, "content", refCheck)}
                          >
                            {refCheck.content ? (
                              <div dangerouslySetInnerHTML={{ __html: refCheck.content }} />
                            ) : (
                              <span className="text-text-tertiary">Click to edit</span>
                            )}
                          </div>
                        )}
                      </FormField>

                      {/* Delete Button */}
                      <div className="flex justify-end pt-2 border-t border-border-primary">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteConfirmId(refCheck.id)}
                          disabled={isSaving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
        </CardBody>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCancelConfirm(false)}>
              Continue working
            </Button>
            <Button variant="danger" onClick={handleCancelNew}>
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reference Check</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reference check? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
