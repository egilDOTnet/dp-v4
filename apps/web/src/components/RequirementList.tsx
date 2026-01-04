"use client";

import { useState, useRef, useEffect } from "react";
import { Requirement, api, RequirementHistory } from "@/lib/api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RequirementListProps {
  projectId?: string;
  templateId?: string;
  hierarchyId: string;
  requirements: Requirement[];
  onRequirementUpdate: () => void;
  shouldShowCreateForm?: boolean;
  onCreateFormClose?: () => void;
  selectedHierarchyId?: string | null;
  disableDragAndDrop?: boolean;
  hierarchyLevel?: 1 | 2; // 1 for Level 1 hierarchies, 2 for Level 2 hierarchies
  dragAttributes?: any;
  dragListeners?: any;
  selectedRequirementIds?: Set<string>;
  onRequirementToggle?: (requirementId: string) => void;
}

interface SortableRequirementItemProps {
  requirement: Requirement;
  children: (props: { attributes: any; listeners: any }) => React.ReactNode;
}

function SortableRequirementItem({
  requirement,
  children,
}: SortableRequirementItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: requirement.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children({ attributes, listeners })}
    </div>
  );
}

interface RequirementFormData {
  description: string;
  type: Requirement["type"];
  status: Requirement["status"];
}

export default function RequirementList({
  projectId,
  templateId,
  hierarchyId,
  requirements,
  onRequirementUpdate,
  shouldShowCreateForm = false,
  onCreateFormClose,
  selectedHierarchyId: _selectedHierarchyId = null,
  disableDragAndDrop = false,
  hierarchyLevel = 1,
  dragAttributes,
  dragListeners,
  selectedRequirementIds = new Set(),
  onRequirementToggle,
}: RequirementListProps) {
  // Ensure either projectId or templateId is provided
  if (!projectId && !templateId) {
    throw new Error("Either projectId or templateId must be provided");
  }
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRequirement, setNewRequirement] = useState<RequirementFormData>({
    description: "",
    type: "Information",
    status: "New",
  });
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, RequirementFormData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, RequirementHistory[]>>({});
  const [saveTimeouts, setSaveTimeouts] = useState<Record<string, NodeJS.Timeout>>({});
  const [newlyCreatedRequirementId, setNewlyCreatedRequirementId] = useState<string | null>(null);
  const [isNewRequirementAnimating, setIsNewRequirementAnimating] = useState(false);
  const [cancelingRequirementId, setCancelingRequirementId] = useState<string | null>(null);
  const descriptionTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const newRequirementTextareaRef = useRef<HTMLTextAreaElement>(null);
  const requirementRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order);

  // Get color and font classes based on hierarchy level
  const getColorClasses = () => {
    if (hierarchyLevel === 2) {
      // Level 3 requirements (under level 2 hierarchy)
      // Number background: same as level 2 hierarchy title background (primary-500)
      // Border: same as level 2 hierarchy title background (primary-500)
      return {
        border: 'border-primary-500',
        bg: 'bg-primary-500',
        focusRing: 'focus:ring-primary-500',
        numberSize: 'text-sm',
        descriptionSize: 'text-sm',
      };
    }
    // Level 2 requirements (under level 1 hierarchy)
    // Number background: same as level 2 hierarchy number background (primary-600)
    // Text background: white (bg-background-tertiary)
    return {
      border: 'border-primary-600',
      bg: 'bg-primary-600',
      focusRing: 'focus:ring-primary-600',
      numberSize: 'text-base',
      descriptionSize: 'text-base',
    };
  };

  const colorClasses = getColorClasses();

  // Initialize form data for all requirements when they change
  useEffect(() => {
    requirements.forEach((requirement) => {
      if (requirement && requirement.id && !formData[requirement.id]) {
        setFormData((prev) => ({
          ...prev,
          [requirement.id]: {
            description: requirement.description,
            type: requirement.type,
            status: requirement.status,
          },
        }));
      }
    });
  }, [requirements]);

  // Auto-focus description textarea when creating new requirement
  useEffect(() => {
    if (isCreatingNew && newRequirementTextareaRef.current) {
      newRequirementTextareaRef.current.focus();
    }
  }, [isCreatingNew]);

  // Handle external trigger to create new requirement
  useEffect(() => {
    if (shouldShowCreateForm && !isCreatingNew) {
      setIsCreatingNew(true);
      setIsNewRequirementAnimating(false);
      // Trigger animation after element is in DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsNewRequirementAnimating(true);
          // Focus the textarea after animation starts
          setTimeout(() => {
            newRequirementTextareaRef.current?.focus();
          }, 50);
        });
      });
    }
  }, [shouldShowCreateForm]);

  // Scroll to and animate newly created requirement when it appears in the list
  useEffect(() => {
    if (newlyCreatedRequirementId) {
      // Wait for the requirement to be rendered in the DOM
      const scrollTimeout = setTimeout(() => {
        const requirementElement = requirementRefs.current[newlyCreatedRequirementId];
        if (requirementElement) {
          requirementElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);

      // Remove the highlight after animation completes
      const clearHighlightTimeout = setTimeout(() => {
        setNewlyCreatedRequirementId(null);
      }, 2000);

      return () => {
        clearTimeout(scrollTimeout);
        clearTimeout(clearHighlightTimeout);
      };
    }
  }, [newlyCreatedRequirementId, requirements]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeouts).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Add native event listeners to editable elements to stop propagation
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
    };

    // Find all editable elements within requirement containers that are being edited
    Object.entries(requirementRefs.current).forEach(([reqId, ref]) => {
      if (ref && editingFields[reqId]) {
        const textareas = ref.querySelectorAll('textarea');
        const selects = ref.querySelectorAll('select');
        const inputs = ref.querySelectorAll('input');
        
        textareas.forEach((el) => {
          el.addEventListener('mousedown', handleMouseDown, true);
        });
        selects.forEach((el) => {
          el.addEventListener('mousedown', handleMouseDown, true);
        });
        inputs.forEach((el) => {
          el.addEventListener('mousedown', handleMouseDown, true);
        });
      }
    });

    // Cleanup
    return () => {
      Object.entries(requirementRefs.current).forEach(([reqId, ref]) => {
        if (ref && editingFields[reqId]) {
          const textareas = ref.querySelectorAll('textarea');
          const selects = ref.querySelectorAll('select');
          const inputs = ref.querySelectorAll('input');
          
          textareas.forEach((el) => {
            el.removeEventListener('mousedown', handleMouseDown, true);
          });
          selects.forEach((el) => {
            el.removeEventListener('mousedown', handleMouseDown, true);
          });
          inputs.forEach((el) => {
            el.removeEventListener('mousedown', handleMouseDown, true);
          });
        }
      });
    };
  }, [editingFields]);

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;
      
      // Check if click is inside any requirement container that's being edited
      let clickedInsideEditingRequirement = false;
      
      // Check all requirement refs
      for (const [reqId, ref] of Object.entries(requirementRefs.current)) {
        if (!ref) continue;
        
        // Check if target is inside this requirement container
        // Use both contains and checking if target is the ref itself
        const isInside = ref === target || ref.contains(target);
        
        if (isInside) {
          // If this requirement is being edited, don't exit edit mode
          if (editingFields[reqId]) {
            clickedInsideEditingRequirement = true;
            break;
          }
        }
      }

      // Also check if clicking on the create form
      if (isCreatingNew) {
        const newRequirementRef = requirementRefs.current["__new__"];
        if (newRequirementRef && (newRequirementRef === target || newRequirementRef.contains(target))) {
          clickedInsideEditingRequirement = true;
        }
      }

      // If clicking inside a requirement that's being edited, don't exit edit mode
      if (clickedInsideEditingRequirement) {
        return;
      }

      // Only exit edit mode if clicking completely outside all requirement containers
      if (Object.keys(editingFields).length > 0) {
        // Save any pending changes before exiting edit mode
        Object.entries(editingFields).forEach(([requirementId, fields]) => {
          const data = formData[requirementId];
          const requirement = requirements.find((r) => r.id === requirementId);
          
          if (data && requirement) {
            fields.forEach((field) => {
              if (field === "description" && data.description !== requirement.description) {
                handleFieldSave(requirementId, "description", data.description);
              } else if (field === "type" && data.type !== requirement.type) {
                handleFieldSave(requirementId, "type", data.type);
              } else if (field === "status" && data.status !== requirement.status) {
                handleFieldSave(requirementId, "status", data.status);
              }
            });
          }
        });

        // Exit all edit modes
        setEditingFields({});
        setShowHistoryId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreatingNew, editingFields, formData, requirements]);

  const handleCreate = async () => {
    if (!newRequirement.description.trim()) {
      setError("Description is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const newRequirementData = projectId
        ? await api.requirements.create(projectId, {
            hierarchyId,
            description: newRequirement.description.trim(),
            type: newRequirement.type || "Information",
            status: newRequirement.status || "New",
          })
        : await api.admin.requirementTemplates.requirements.create(templateId!, {
            hierarchyId,
            description: newRequirement.description.trim(),
            type: newRequirement.type || "Information",
          });
      setNewRequirement({
        description: "",
        type: "Information",
        status: "New",
      });
      setIsNewRequirementAnimating(false);
      setIsCreatingNew(false);
      // Set the newly created requirement ID for animation
      setNewlyCreatedRequirementId(newRequirementData.id);
      // Close the create form
      if (onCreateFormClose) {
        onCreateFormClose();
      }
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to create requirement");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldSave = async (
    requirementId: string,
    field: keyof RequirementFormData,
    value: string | Requirement["type"] | Requirement["status"]
  ) => {
    const timeoutKey = `${requirementId}-${field}`;
    if (saveTimeouts[timeoutKey]) {
      clearTimeout(saveTimeouts[timeoutKey]);
      delete saveTimeouts[timeoutKey];
    }

    setLoading(true);
    setError("");

    try {
      const requirement = requirements.find((r) => r.id === requirementId);
      if (!requirement) return;

      const updatePayload: {
        description?: string;
        type?: Requirement["type"];
        status?: Requirement["status"];
      } = {};

      if (field === "description") {
        updatePayload.description = value as string;
      } else if (field === "type") {
        updatePayload.type = value as Requirement["type"];
      } else if (field === "status") {
        updatePayload.status = value as Requirement["status"];
      }

      if (projectId) {
        await api.requirements.update(projectId, requirementId, updatePayload);
      } else {
        await api.admin.requirementTemplates.requirements.update(templateId!, requirementId, {
          description: updatePayload.description,
          type: updatePayload.type,
        });
      }

      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[requirementId]) {
          const fields = new Set(newFields[requirementId]);
          fields.delete(field);
          if (fields.size === 0) {
            delete newFields[requirementId];
          } else {
            newFields[requirementId] = fields;
          }
        }
        return newFields;
      });

      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to update requirement");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldBlur = (
    requirementId: string,
    field: keyof RequirementFormData,
    _e: React.FocusEvent<HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const timeoutKey = `${requirementId}-${field}`;
    
    if (saveTimeouts[timeoutKey]) {
      clearTimeout(saveTimeouts[timeoutKey]);
    }

    const delayedSaveTimeout = setTimeout(() => {
      const activeElement = document.activeElement;
      if (isWithinSameRequirement(requirementId, activeElement)) {
        return;
      }

      const data = formData[requirementId];
      if (!data) return;

      const requirement = requirements.find((r) => r.id === requirementId);
      if (!requirement) return;

      let hasChanged = false;
      if (field === "description" && data.description !== requirement.description) {
        hasChanged = true;
      } else if (field === "type" && data.type !== requirement.type) {
        hasChanged = true;
      } else if (field === "status" && data.status !== requirement.status) {
        hasChanged = true;
      }

      if (hasChanged) {
        handleFieldSave(requirementId, field, data[field]);
      } else {
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[requirementId]) {
            const fields = new Set(newFields[requirementId]);
            fields.delete(field);
            if (fields.size === 0) {
              delete newFields[requirementId];
            } else {
              newFields[requirementId] = fields;
            }
          }
          return newFields;
        });
      }

      // If no fields are being edited for this requirement, collapse it
      const stillEditing = editingFields[requirementId]?.size > 0;
      if (!stillEditing) {
        setShowHistoryId((prev) => (prev === requirementId ? null : prev));
      }
    }, 150);

    setSaveTimeouts((prev) => ({ ...prev, [timeoutKey]: delayedSaveTimeout }));
  };

  const isWithinSameRequirement = (requirementId: string, element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Node)) return false;
    const requirementContainer = requirementRefs.current[requirementId];
    if (!requirementContainer) return false;
    return requirementContainer.contains(element);
  };

  const handleFieldFocus = (requirementId: string, field: keyof RequirementFormData) => {
    const timeoutKey = `${requirementId}-${field}`;
    if (saveTimeouts[timeoutKey]) {
      clearTimeout(saveTimeouts[timeoutKey]);
      delete saveTimeouts[timeoutKey];
    }

    const requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    
    if (!formData[requirementId]) {
      setFormData((prev) => ({
        ...prev,
        [requirementId]: {
          description: requirement.description,
          type: requirement.type,
          status: requirement.status,
        },
      }));
    }

    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[requirementId]) {
        newFields[requirementId] = new Set();
      }
      newFields[requirementId].add(field);
      return newFields;
    });
  };

  const enterEditMode = (requirementId: string) => {
    const requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement) return;
    
    // Initialize form data
    if (!formData[requirementId]) {
      setFormData((prev) => ({
        ...prev,
        [requirementId]: {
          description: requirement.description,
          type: requirement.type,
          status: requirement.status,
        },
      }));
    }

    // Activate all fields at once
    setEditingFields((prev) => {
      const newFields = { ...prev };
      newFields[requirementId] = new Set(['description', 'type', 'status']);
      return newFields;
    });
  };

  const updateFormField = (
    requirementId: string,
    field: keyof RequirementFormData,
    value: string | Requirement["type"] | Requirement["status"]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [requirementId]: {
        ...(prev[requirementId] || {
          description: "",
          type: "Information",
          status: "New",
        }),
        [field]: value,
      },
    }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this requirement?")) {
      return;
    }

    setLoading(true);
    setError("");

    // Start fade-out animation
    setCancelingRequirementId(id);
    // Wait for animation to complete before deleting
    setTimeout(async () => {
      try {
        if (projectId) {
          await api.requirements.delete(projectId, id);
        } else {
          await api.admin.requirementTemplates.requirements.delete(templateId!, id);
        }
        setCancelingRequirementId(null);
        onRequirementUpdate();
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to delete requirement");
        setCancelingRequirementId(null);
        setLoading(false);
      }
    }, 300);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedRequirements.findIndex((r) => r.id === active.id);
    const newIndex = sortedRequirements.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(sortedRequirements, oldIndex, newIndex);
    const requirementIds = reordered.map((r) => r.id);

    setLoading(true);
    setError("");

    try {
      if (projectId) {
        await api.requirements.reorder(projectId, {
          requirementIds,
          hierarchyId,
        });
      } else {
        // For templates, use the first requirementId as the route param (API expects it)
        await api.admin.requirementTemplates.requirements.reorder(templateId!, requirementIds[0] || "", {
          requirementIds,
          hierarchyId,
        });
      }
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reorder requirements");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (requirementId: string) => {
    if (history[requirementId]) {
      setShowHistoryId(showHistoryId === requirementId ? null : requirementId);
      return;
    }

    try {
      // History is only available for project requirements, not templates
      if (!projectId) {
        setHistory((prev) => ({ ...prev, [requirementId]: [] }));
        return;
      }
      const historyData = await api.requirements.getHistory(projectId, requirementId);
      setHistory((prev) => ({ ...prev, [requirementId]: historyData }));
      setShowHistoryId(requirementId);
    } catch (err: any) {
      setError(err.message || "Failed to load history");
    }
  };

  const restoreFromHistory = (requirementId: string, historyEntry: RequirementHistory) => {
    setFormData((prev) => ({
      ...prev,
      [requirementId]: {
        description: historyEntry.description,
        type: historyEntry.type,
        status: historyEntry.status,
      },
    }));
    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[requirementId]) {
        newFields[requirementId] = new Set();
      }
      newFields[requirementId].add("description");
      newFields[requirementId].add("type");
      newFields[requirementId].add("status");
      return newFields;
    });
    // Save the restored values
    handleFieldSave(requirementId, "description", historyEntry.description);
    handleFieldSave(requirementId, "type", historyEntry.type);
    handleFieldSave(requirementId, "status", historyEntry.status);
  };

  const getTypeColor = (type: Requirement["type"]) => {
    switch (type) {
      case "Mandatory":
        return "bg-red-100 text-red-800";
      case "Important":
        return "bg-orange-100 text-orange-800";
      case "Wish":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: Requirement["status"]) => {
    if (status === null) {
      return "bg-gray-50 text-gray-400";
    }
    switch (status) {
      case "Approved":
        return "bg-primary-100 text-primary-800";
      case "ForReview":
        return "bg-yellow-100 text-yellow-800";
      case "New":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Filter history to exclude current version
  const getFilteredHistory = (requirementId: string): RequirementHistory[] => {
    const requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement || !history[requirementId]) return [];

    return history[requirementId].filter((entry) => {
      return (
        entry.description !== requirement.description ||
        entry.type !== requirement.type ||
        entry.status !== requirement.status
      );
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}



      {disableDragAndDrop || dragAttributes ? (
        <div className="space-y-2">
          {sortedRequirements.map((requirement) => {
            // Render without sortable wrapper when drag and drop is disabled
            const isEditingDescription = editingFields[requirement.id]?.has("description");
              const isEditingType = editingFields[requirement.id]?.has("type");
            const isEditingStatus = editingFields[requirement.id]?.has("status");
            const isEditing = isEditingDescription || isEditingType || isEditingStatus;
            const isShowingHistory = showHistoryId === requirement.id;

            const requirementFormData = formData[requirement.id] || {
              description: requirement.description,
              type: requirement.type,
              status: requirement.status,
            };

            return (
              <div
                key={requirement.id}
                ref={(el) => {
                  requirementRefs.current[requirement.id] = el;
                }}
                className={`group relative border-2 ${colorClasses.border} rounded-lg bg-background-tertiary flex items-stretch overflow-visible transition-all duration-300 ease-out ${
                  cancelingRequirementId === requirement.id
                    ? "opacity-0 scale-95"
                    : newlyCreatedRequirementId === requirement.id
                    ? "shadow-lg scale-105"
                    : ""
                }`}
              >
                {/* Checkbox - positioned to the left of the number */}
                {onRequirementToggle && (
                  <div
                    className={`absolute -left-8 top-1/2 -translate-y-1/2 transition-opacity z-10 flex items-center justify-center ${
                      selectedRequirementIds.has(requirement.id)
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequirementToggle(requirement.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRequirementIds.has(requirement.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onRequirementToggle(requirement.id);
                      }}
                      className="w-5 h-5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Left side: Number with drag handle if external drag props provided */}
                <div 
                  {...(dragAttributes || {})}
                  {...(dragListeners || {})}
                  className={`${colorClasses.bg} text-white flex items-start justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg ${dragAttributes ? 'cursor-grab active:cursor-grabbing hover:brightness-110 transition-all' : ''}`}
                  title={dragAttributes ? "Drag to reorder" : undefined}
                >
                  <span className={`font-semibold ${colorClasses.numberSize} leading-none mt-1`}>
                    {requirement.number.endsWith('.') ? requirement.number.slice(0, -1) : requirement.number}
                  </span>
                </div>

                {/* Right side: Requirement content */}
                <div className="flex-1 px-4 py-3">
                  {isEditing ? (
                    <div className="grid grid-cols-4 gap-4">
                      {/* Description area - 3 columns */}
                      <div className="col-span-3">
                          <textarea
                            ref={(el) => {
                              descriptionTextareaRefs.current[requirement.id] = el;
                            }}
                            value={requirementFormData.description}
                            onChange={(e) =>
                              updateFormField(requirement.id, "description", e.target.value)
                            }
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={() => handleFieldFocus(requirement.id, "description")}
                            onBlur={(e) => handleFieldBlur(requirement.id, "description", e)}
                            onKeyDown={(e) => {
                              // Handle Ctrl-A/Command-A to select all text
                              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                e.preventDefault();
                                e.currentTarget.select();
                                return;
                              }
                              if (e.key === "Escape") {
                                e.currentTarget.blur();
                              }
                            }}
                            placeholder="Requirement description"
                            rows={5}
                            className={`w-full px-2 py-1 border border-gray-300 rounded ${colorClasses.descriptionSize} focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                            autoFocus
                          />
                      </div>

                      {/* Metadata area - 1 column */}
                      <div className="col-span-1 text-xs text-gray-500 space-y-2">
                          {/* Type */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700 whitespace-nowrap">Type:</span>
                            <select
                              value={requirementFormData.type || ""}
                              onChange={(e) => {
                                const newType = e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]);
                                updateFormField(requirement.id, "type", newType);
                                handleFieldSave(requirement.id, "type", newType);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={() => handleFieldFocus(requirement.id, "type")}
                              onBlur={(e) => handleFieldBlur(requirement.id, "type", e)}
                              className={`flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                            >
                              <option value="">(Blank)</option>
                              <option value="Information">Information</option>
                              <option value="Mandatory">Mandatory</option>
                              <option value="Important">Important</option>
                              <option value="Wish">Wish</option>
                            </select>
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700 whitespace-nowrap">Status:</span>
                            <select
                              value={requirementFormData.status || ""}
                              onChange={(e) => {
                                const newStatus = e.target.value as Requirement["status"];
                                updateFormField(requirement.id, "status", newStatus);
                                handleFieldSave(requirement.id, "status", newStatus);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={() => handleFieldFocus(requirement.id, "status")}
                              onBlur={(e) => handleFieldBlur(requirement.id, "status", e)}
                              className={`flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                            >
                              <option value="New">New</option>
                              <option value="ForReview">For Review</option>
                              <option value="Approved">Approved</option>
                            </select>
                          </div>
                          
                        {/* Created */}
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-700">Created:</span>
                            <span>{new Date(requirement.createdAt).toLocaleDateString()}</span>
                            {requirement.createdBy && (
                              <span
                                className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                title={
                                  requirement.createdBy.firstName &&
                                  requirement.createdBy.lastName
                                    ? `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`
                                    : requirement.createdBy.name ||
                                      requirement.createdBy.email
                                }
                              >
                                i
                              </span>
                            )}
                        </div>
                          
                        {/* Modified */}
                        {requirement.updatedAt !== requirement.createdAt && (
                          <div className="flex items-center gap-1">
                              <span className="font-medium text-gray-700">Modified:</span>
                              <span>{new Date(requirement.updatedAt).toLocaleDateString()}</span>
                              {requirement.lastModifiedBy && (
                                <span
                                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                  title={
                                    requirement.lastModifiedBy.firstName &&
                                    requirement.lastModifiedBy.lastName
                                      ? `${requirement.lastModifiedBy.firstName} ${requirement.lastModifiedBy.lastName}`
                                      : requirement.lastModifiedBy.name ||
                                        requirement.lastModifiedBy.email
                                  }
                                >
                                  i
                                </span>
                              )}
                          </div>
                        )}
                          
                        {/* Show History and Delete on same line */}
                        <div className="flex justify-between items-center pt-2">
                            <button
                              onClick={() => loadHistory(requirement.id)}
                              className="text-primary-600 hover:text-primary-500 underline"
                            >
                              {isShowingHistory ? "Hide" : "Show"} History
                            </button>
                            <button
                              onClick={() => handleDelete(requirement.id)}
                              disabled={loading}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                            >
                              Delete
                            </button>
                        </div>
                      </div>
                      
                      {/* History display - spans all 4 columns */}
                      {isShowingHistory && (
                        <div className="col-span-4 border-t border-gray-200 pt-4 mt-4">
                          <h4 className="font-medium mb-2 text-sm">History</h4>
                          <div className="space-y-2">
                            {getFilteredHistory(requirement.id).length === 0 ? (
                              <p className="text-sm text-gray-500">No previous versions</p>
                            ) : (
                              getFilteredHistory(requirement.id).map((entry) => (
                                <div
                                  key={entry.id}
                                  className="bg-background-secondary rounded p-3 text-sm grid grid-cols-4 gap-4"
                                >
                                  {/* Description - 3 columns */}
                                  <div className="col-span-3">
                                    <p className="text-gray-700">{entry.description}</p>
                                  </div>
                                  
                                  {/* Metadata - 1 column */}
                                  <div className="col-span-1 text-xs text-gray-500 space-y-2">
                                    {/* Type */}
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700 whitespace-nowrap">Type:</span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                                          entry.type
                                        )}`}
                                      >
                                        {entry.type}
                                      </span>
                                    </div>
                                    {/* Status */}
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700 whitespace-nowrap">Status:</span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                          entry.status
                                        )}`}
                                      >
                                        {entry.status}
                                      </span>
                                    </div>
                                    {/* Modified */}
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-gray-700">Modified:</span>
                                      <span>
                                        {new Date(entry.createdAt).toLocaleDateString('en-GB', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric' 
                                        })} {new Date(entry.createdAt).toLocaleTimeString('en-GB', { 
                                          hour: '2-digit', 
                                          minute: '2-digit',
                                          hour12: false
                                        })}
                                      </span>
                                      {entry.modifiedBy && (
                                        <span
                                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                          title={
                                            entry.modifiedBy.firstName &&
                                            entry.modifiedBy.lastName
                                              ? `${entry.modifiedBy.firstName} ${entry.modifiedBy.lastName}`
                                              : entry.modifiedBy.name ||
                                                entry.modifiedBy.email
                                          }
                                        >
                                          i
                                        </span>
                                      )}
                                    </div>
                                    {/* Restore button */}
                                    <div className="text-right pt-2">
                                      <button
                                        onClick={() => restoreFromHistory(requirement.id, entry)}
                                        className="text-xs text-primary-600 hover:text-primary-700 underline"
                                      >
                                        Restore
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      {/* Description area */}
                      <div className="flex-1 min-w-0">
                        <p 
                          className={`${colorClasses.descriptionSize} text-gray-900 cursor-pointer hover:text-primary-500`}
                          onClick={() => enterEditMode(requirement.id)}
                        >
                          {requirement.description}
                        </p>
                      </div>

                      {/* Right side: Type and Status */}
                      <div className="flex items-start gap-2 flex-shrink-0">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${getTypeColor(
                            requirementFormData.type
                          )}`}
                          onClick={() => enterEditMode(requirement.id)}
                        >
                          {requirementFormData.type}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${getStatusColor(
                            requirementFormData.status
                          )}`}
                          onClick={() => enterEditMode(requirement.id)}
                        >
                          {requirementFormData.status || "New"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

            {/* New requirement inline editing - now at the bottom */}
            {isCreatingNew && (
              <div
                ref={(el) => {
                  if (el) {
                    requirementRefs.current["__new__"] = el;
                  }
                }}
                className={`border-2 ${colorClasses.border} rounded-lg bg-white flex items-stretch overflow-hidden transition-all duration-300 ease-out ${
                  isNewRequirementAnimating
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-4"
                }`}
              >
                {/* Left side: Number indicator */}
                <div className={`${colorClasses.bg} text-white flex items-start justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg`}>
                  <span className={`font-semibold ${colorClasses.numberSize} leading-none mt-1`}>+</span>
                </div>

                {/* Right side: Form content */}
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    {/* Description textarea */}
                    <div className="flex-1 min-w-0">
                      <textarea
                        ref={newRequirementTextareaRef}
                        value={newRequirement.description}
                        onChange={(e) =>
                          setNewRequirement({ ...newRequirement, description: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setIsNewRequirementAnimating(false);
                            setTimeout(() => {
                              setIsCreatingNew(false);
                              setNewRequirement({
                                description: "",
                                type: "Information",
                                status: "New",
                              });
                              setError("");
                              if (onCreateFormClose) {
                                onCreateFormClose();
                              }
                            }, 300);
                          } else if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (newRequirement.description.trim()) {
                              handleCreate();
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Check if focus is moving to another element within the create form
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          const createFormElement = requirementRefs.current["__new__"];
                          
                          if (createFormElement && relatedTarget && createFormElement.contains(relatedTarget)) {
                            // Focus is staying within the form, don't trigger save/cancel
                            return;
                          }

                          // Delay to allow clicks on Cancel button to register
                          setTimeout(() => {
                            if (newRequirement.description.trim()) {
                              handleCreate();
                            } else {
                              // Cancel if empty
                              setIsNewRequirementAnimating(false);
                              setTimeout(() => {
                                setIsCreatingNew(false);
                                setNewRequirement({
                                  description: "",
                                  type: "Information",
                                  status: "New",
                                });
                                setError("");
                                if (onCreateFormClose) {
                                  onCreateFormClose();
                                }
                              }, 300);
                            }
                          }, 150);
                        }}
                        placeholder="Requirement description"
                        rows={2}
                        className={`w-full px-2 py-1 border border-gray-300 rounded ${colorClasses.descriptionSize} focus:outline-none focus:ring-2 focus:ring-primary-500`}
                        autoFocus
                      />
                    </div>

                    {/* Right side: Type and Status selects - aligned to top */}
                    <div className="flex items-start gap-2 flex-shrink-0">
                      <select
                        value={newRequirement.type || ""}
                        onChange={(e) =>
                          setNewRequirement({
                            ...newRequirement,
                            type: e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]),
                          })
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">(Blank)</option>
                        <option value="Information">Information</option>
                        <option value="Mandatory">Mandatory</option>
                        <option value="Important">Important</option>
                        <option value="Wish">Wish</option>
                      </select>
                      <select
                        value={newRequirement.status || ""}
                        onChange={(e) =>
                          setNewRequirement({
                            ...newRequirement,
                            status: e.target.value as Requirement["status"],
                          })
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="New">New</option>
                        <option value="ForReview">For Review</option>
                        <option value="Approved">Approved</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-end items-center">
                    <button
                      onClick={() => {
                        setIsNewRequirementAnimating(false);
                        // Wait for exit animation to complete before removing from DOM
                        setTimeout(() => {
                          setIsCreatingNew(false);
                          setNewRequirement({
                            description: "",
                            type: "Information",
                            status: "New",
                          });
                          setError("");
                          // Close the create form
                          if (onCreateFormClose) {
                            onCreateFormClose();
                          }
                        }, 300);
                      }}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 underline text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => {}}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedRequirements.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedRequirements.map((requirement) => {
                const isEditingDescription = editingFields[requirement.id]?.has("description");
                const isEditingType = editingFields[requirement.id]?.has("type");
                const isEditingStatus = editingFields[requirement.id]?.has("status");
                const isEditing = isEditingDescription || isEditingType || isEditingStatus;
                const isShowingHistory = showHistoryId === requirement.id;

                const requirementFormData = formData[requirement.id] || {
                  description: requirement.description,
                  type: requirement.type,
                  status: requirement.status,
                };

                return (
                  <SortableRequirementItem
                    key={requirement.id}
                    requirement={requirement}
                  >
                    {({ attributes, listeners }) => (
                      <div
                        ref={(el) => {
                          requirementRefs.current[requirement.id] = el;
                        }}
                        className={`group relative border-2 ${colorClasses.border} rounded-lg bg-background-tertiary flex items-stretch overflow-visible transition-all duration-300 ease-out ${
                          cancelingRequirementId === requirement.id
                            ? "opacity-0 scale-95"
                            : newlyCreatedRequirementId === requirement.id
                            ? "shadow-lg scale-105"
                            : ""
                        }`}
                      >
                        {/* Checkbox - positioned to the left of the number */}
                        {onRequirementToggle && (
                          <div
                            className={`absolute -left-8 top-1/2 -translate-y-1/2 transition-opacity z-10 flex items-center justify-center ${
                              selectedRequirementIds.has(requirement.id)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequirementToggle(requirement.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRequirementIds.has(requirement.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                onRequirementToggle(requirement.id);
                              }}
                              className="w-5 h-5 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        {/* Left side: Number with drag handle */}
                        <div 
                          {...attributes}
                          {...listeners}
                          className={`${colorClasses.bg} text-white flex items-start justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg cursor-grab active:cursor-grabbing hover:brightness-110 transition-all`}
                          title="Drag to reorder"
                        >
                          <span className={`font-semibold ${colorClasses.numberSize} leading-none mt-1`}>
                            {requirement.number.endsWith('.') ? requirement.number.slice(0, -1) : requirement.number}
                          </span>
                        </div>

                        {/* Right side: Requirement content */}
                        <div className="flex-1 px-4 py-3">
                          {isEditing ? (
                            <div className="grid grid-cols-4 gap-4">
                              {/* Description area - 3 columns */}
                              <div className="col-span-3">
                                <textarea
                                  ref={(el) => {
                                    descriptionTextareaRefs.current[requirement.id] = el;
                                  }}
                                  value={requirementFormData.description}
                                  onChange={(e) =>
                                    updateFormField(requirement.id, "description", e.target.value)
                                  }
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={() => handleFieldFocus(requirement.id, "description")}
                                  onBlur={(e) => handleFieldBlur(requirement.id, "description", e)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Requirement description"
                                  rows={5}
                                  className={`w-full px-2 py-1 border border-gray-300 rounded ${colorClasses.descriptionSize} focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                                  autoFocus
                                />
                              </div>

                              {/* Metadata area - 1 column */}
                              <div className="col-span-1 text-xs text-gray-500 space-y-2">
                                {/* Type */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-700 whitespace-nowrap">Type:</span>
                                  <select
                                    value={requirementFormData.type || ""}
                                    onChange={(e) => {
                                      const newType = e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]);
                                      updateFormField(requirement.id, "type", newType);
                                      handleFieldSave(requirement.id, "type", newType);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={() => handleFieldFocus(requirement.id, "type")}
                                    onBlur={(e) => handleFieldBlur(requirement.id, "type", e)}
                                    className={`flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                                  >
                                    <option value="">(Blank)</option>
                                    <option value="Information">Information</option>
                                    <option value="Mandatory">Mandatory</option>
                                    <option value="Important">Important</option>
                                    <option value="Wish">Wish</option>
                                  </select>
                                </div>

                                {/* Status */}
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-700 whitespace-nowrap">Status:</span>
                                  <select
                                    value={requirementFormData.status || ""}
                                    onChange={(e) => {
                                      const newStatus = e.target.value as Requirement["status"];
                                      updateFormField(requirement.id, "status", newStatus);
                                      handleFieldSave(requirement.id, "status", newStatus);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={() => handleFieldFocus(requirement.id, "status")}
                                    onBlur={(e) => handleFieldBlur(requirement.id, "status", e)}
                                    className={`flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 ${colorClasses.focusRing}`}
                                  >
                                    <option value="New">New</option>
                                    <option value="ForReview">For Review</option>
                                    <option value="Approved">Approved</option>
                                  </select>
                                </div>
                                
                                {/* Created */}
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-gray-700">Created:</span>
                                  <span>{new Date(requirement.createdAt).toLocaleDateString()}</span>
                                  {requirement.createdBy && (
                                    <span
                                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                      title={
                                        requirement.createdBy.firstName &&
                                        requirement.createdBy.lastName
                                          ? `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`
                                          : requirement.createdBy.name ||
                                            requirement.createdBy.email
                                      }
                                    >
                                      i
                                    </span>
                                  )}
                                </div>
                                
                                {/* Modified */}
                                {requirement.updatedAt !== requirement.createdAt && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-gray-700">Modified:</span>
                                    <span>{new Date(requirement.updatedAt).toLocaleDateString()}</span>
                                    {requirement.lastModifiedBy && (
                                      <span
                                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                        title={
                                          requirement.lastModifiedBy.firstName &&
                                          requirement.lastModifiedBy.lastName
                                            ? `${requirement.lastModifiedBy.firstName} ${requirement.lastModifiedBy.lastName}`
                                            : requirement.lastModifiedBy.name ||
                                              requirement.lastModifiedBy.email
                                        }
                                      >
                                        i
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Show History and Delete on same line */}
                                <div className="flex justify-between items-center pt-2">
                                  <button
                                    onClick={() => loadHistory(requirement.id)}
                                    className="text-primary-600 hover:text-primary-500 underline"
                                  >
                                    {isShowingHistory ? "Hide" : "Show"} History
                                  </button>
                                  <button
                                    onClick={() => handleDelete(requirement.id)}
                                    disabled={loading}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            
                              {/* History display - spans all 4 columns */}
                              {isShowingHistory && (
                                <div className="col-span-4 border-t border-gray-200 pt-4 mt-4">
                                  <h4 className="font-medium mb-2 text-sm">History</h4>
                                  <div className="space-y-2">
                                    {getFilteredHistory(requirement.id).length === 0 ? (
                                      <p className="text-sm text-gray-500">No previous versions</p>
                                    ) : (
                                      getFilteredHistory(requirement.id).map((entry) => (
                                        <div
                                          key={entry.id}
                                          className="bg-background-secondary rounded p-3 text-sm grid grid-cols-4 gap-4"
                                        >
                                          {/* Description - 3 columns */}
                                          <div className="col-span-3">
                                            <p className="text-gray-700">{entry.description}</p>
                                          </div>
                                          
                                          {/* Metadata - 1 column */}
                                          <div className="col-span-1 text-xs text-gray-500 space-y-2">
                                            {/* Type */}
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-700 whitespace-nowrap">Type:</span>
                                              <span
                                                className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                                                  entry.type
                                                )}`}
                                              >
                                                {entry.type}
                                              </span>
                                            </div>
                                            {/* Status */}
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-gray-700 whitespace-nowrap">Status:</span>
                                              <span
                                                className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                                  entry.status
                                                )}`}
                                              >
                                                {entry.status}
                                              </span>
                                            </div>
                                            {/* Modified */}
                                            <div className="flex items-center gap-1">
                                              <span className="font-medium text-gray-700">Modified:</span>
                                              <span>
                                                {new Date(entry.createdAt).toLocaleDateString('en-GB', { 
                                                  day: '2-digit', 
                                                  month: '2-digit', 
                                                  year: 'numeric' 
                                                })} {new Date(entry.createdAt).toLocaleTimeString('en-GB', { 
                                                  hour: '2-digit', 
                                                  minute: '2-digit',
                                                  hour12: false
                                                })}
                                              </span>
                                              {entry.modifiedBy && (
                                                <span
                                                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-400 text-white text-[10px] font-semibold cursor-help"
                                                  title={
                                                    entry.modifiedBy.firstName &&
                                                    entry.modifiedBy.lastName
                                                      ? `${entry.modifiedBy.firstName} ${entry.modifiedBy.lastName}`
                                                      : entry.modifiedBy.name ||
                                                        entry.modifiedBy.email
                                                  }
                                                >
                                                  i
                                                </span>
                                              )}
                                            </div>
                                            {/* Restore button */}
                                            <div className="text-right pt-2">
                                              <button
                                                onClick={() => restoreFromHistory(requirement.id, entry)}
                                                className="text-xs text-primary-600 hover:text-primary-700 underline"
                                              >
                                                Restore
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              {/* Description area */}
                              <div className="flex-1 min-w-0">
                                <p 
                                  className={`${colorClasses.descriptionSize} text-gray-900 cursor-pointer hover:text-primary-500`}
                                  onClick={() => enterEditMode(requirement.id)}
                                >
                                  {requirement.description}
                                </p>
                              </div>

                            {/* Right side: Type and Status */}
                            <div className="flex items-start gap-2 flex-shrink-0">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${getTypeColor(
                                    requirementFormData.type
                                  )}`}
                                  onClick={() => enterEditMode(requirement.id)}
                                >
                                  {requirementFormData.type}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${getStatusColor(
                                    requirementFormData.status
                                  )}`}
                                  onClick={() => enterEditMode(requirement.id)}
                                >
                                  {requirementFormData.status || "New"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </SortableRequirementItem>
                );
              })}

              {/* New requirement inline editing - now at the bottom */}
              {isCreatingNew && (
                <div
                  ref={(el) => {
                    if (el) {
                      requirementRefs.current["__new__"] = el;
                    }
                  }}
                  className={`border-2 ${colorClasses.border} rounded-lg bg-background-tertiary flex items-stretch overflow-hidden transition-all duration-300 ease-out ${
                    isNewRequirementAnimating
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-4"
                  }`}
                >
                  {/* Left side: Number indicator */}
                  <div className={`${colorClasses.bg} text-white flex items-start justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg`}>
                    <span className={`font-semibold ${colorClasses.numberSize} leading-none mt-1`}>+</span>
                  </div>

                  {/* Right side: Form content */}
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      {/* Description textarea */}
                      <div className="flex-1 min-w-0">
                        <textarea
                          ref={newRequirementTextareaRef}
                          value={newRequirement.description}
                          onChange={(e) =>
                            setNewRequirement({ ...newRequirement, description: e.target.value })
                          }
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setIsNewRequirementAnimating(false);
                            setTimeout(() => {
                              setIsCreatingNew(false);
                              setNewRequirement({
                                description: "",
                                type: "Information",
                                status: "New",
                              });
                              setError("");
                              if (onCreateFormClose) {
                                onCreateFormClose();
                              }
                            }, 300);
                          } else if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (newRequirement.description.trim()) {
                              handleCreate();
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Check if focus is moving to another element within the create form
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          const createFormElement = requirementRefs.current["__new__"];
                          
                          if (createFormElement && relatedTarget && createFormElement.contains(relatedTarget)) {
                            // Focus is staying within the form, don't trigger save/cancel
                            return;
                          }

                          // Delay to allow clicks on Cancel button to register
                          setTimeout(() => {
                            if (newRequirement.description.trim()) {
                              handleCreate();
                            } else {
                              // Cancel if empty
                              setIsNewRequirementAnimating(false);
                              setTimeout(() => {
                                setIsCreatingNew(false);
                                setNewRequirement({
                                  description: "",
                                  type: "Information",
                                  status: "New",
                                });
                                setError("");
                                if (onCreateFormClose) {
                                  onCreateFormClose();
                                }
                              }, 300);
                            }
                          }, 150);
                        }}
                          placeholder="Requirement description"
                          rows={2}
                          className={`w-full px-2 py-1 border border-gray-300 rounded ${colorClasses.descriptionSize} focus:outline-none focus:ring-2 focus:ring-primary-500`}
                          autoFocus
                        />
                      </div>

                      {/* Right side: Type and Status selects - aligned to top */}
                      <div className="flex items-start gap-2 flex-shrink-0">
                        <select
                          value={newRequirement.type || ""}
                          onChange={(e) =>
                            setNewRequirement({
                              ...newRequirement,
                              type: e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]),
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">(Blank)</option>
                          <option value="Information">Information</option>
                          <option value="Mandatory">Mandatory</option>
                          <option value="Important">Important</option>
                          <option value="Wish">Wish</option>
                        </select>
                        <select
                          value={newRequirement.status || ""}
                          onChange={(e) =>
                            setNewRequirement({
                              ...newRequirement,
                              status: e.target.value as Requirement["status"],
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="New">New</option>
                          <option value="ForReview">For Review</option>
                          <option value="Approved">Approved</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex justify-end items-center">
                      <button
                        onClick={() => {
                          setIsNewRequirementAnimating(false);
                          // Wait for exit animation to complete before removing from DOM
                          setTimeout(() => {
                            setIsCreatingNew(false);
                            setNewRequirement({
                              description: "",
                              type: "Information",
                              status: "New",
                            });
                            setError("");
                            // Close the create form
                            if (onCreateFormClose) {
                              onCreateFormClose();
                            }
                          }, 300);
                        }}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 underline text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {sortedRequirements.length === 0 && !isCreatingNew && (
        <div className="text-center py-8 text-gray-500">
          <p>There are no requirements yet.</p>
        </div>
      )}
    </div>
  );
}

