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
  projectId: string;
  hierarchyId: string;
  requirements: Requirement[];
  onRequirementUpdate: () => void;
  shouldShowCreateForm?: boolean;
  onCreateFormClose?: () => void;
  selectedHierarchyId?: string | null;
  disableDragAndDrop?: boolean;
}

interface SortableRequirementItemProps {
  requirement: Requirement;
  children: React.ReactNode;
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
    <div ref={setNodeRef} style={style} className="relative group/requirement">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-5 top-0 w-2.5 flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover/requirement:opacity-100 transition-opacity z-10 hover:opacity-100"
        style={{ paddingTop: '0.25rem' }}
        title="Drag to reorder"
      >
        <div className="flex gap-0.5">
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
        </div>
        <div className="flex gap-0.5">
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
        </div>
        <div className="flex gap-0.5">
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
        </div>
        <div className="flex gap-0.5">
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-gray-400 rounded-full"></div>
        </div>
      </div>
      {children}
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
  hierarchyId,
  requirements,
  onRequirementUpdate,
  shouldShowCreateForm = false,
  onCreateFormClose,
  selectedHierarchyId = null,
  disableDragAndDrop = false,
}: RequirementListProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRequirement, setNewRequirement] = useState<RequirementFormData>({
    description: "",
    type: "Information",
    status: "New",
  });
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, RequirementFormData>>({});
  const [expandedRequirements, setExpandedRequirements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
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

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any requirement container
      let clickedInsideRequirement = false;
      Object.values(requirementRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideRequirement = true;
        }
      });

      // Also check if clicking on the create form
      if (isCreatingNew) {
        const newRequirementRef = requirementRefs.current["__new__"];
        if (newRequirementRef && newRequirementRef.contains(target)) {
          clickedInsideRequirement = true;
        }
      }

      if (!clickedInsideRequirement) {
        // Exit all edit modes
        setEditingFields({});
        setExpandedRequirements(new Set());
        setShowHistoryId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreatingNew]);

  const handleCreate = async () => {
    if (!newRequirement.description.trim()) {
      setError("Description is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const newRequirementData = await api.requirements.create(projectId, {
        hierarchyId,
        description: newRequirement.description.trim(),
        type: newRequirement.type || "Information",
        status: newRequirement.status || "New",
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

      await api.requirements.update(projectId, requirementId, updatePayload);

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
        setExpandedRequirements((prev) => {
          const newSet = new Set(prev);
          newSet.delete(requirementId);
          return newSet;
        });
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

    // Expand requirement when editing
    setExpandedRequirements((prev) => new Set(prev).add(requirementId));
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

  const handleRequirementClick = (requirementId: string) => {
    setExpandedRequirements((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(requirementId)) {
        newSet.delete(requirementId);
      } else {
        newSet.add(requirementId);
      }
      return newSet;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this requirement?")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start fade-out animation
      setCancelingRequirementId(id);
      // Wait for animation to complete before deleting
      setTimeout(async () => {
        await api.requirements.delete(projectId, id);
        setCancelingRequirementId(null);
        onRequirementUpdate();
        setLoading(false);
      }, 300);
    } catch (err: any) {
      setError(err.message || "Failed to delete requirement");
      setCancelingRequirementId(null);
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveDragId(null);
      return;
    }

    const oldIndex = sortedRequirements.findIndex((r) => r.id === active.id);
    const newIndex = sortedRequirements.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveDragId(null);
      return;
    }

    const reordered = arrayMove(sortedRequirements, oldIndex, newIndex);
    const requirementIds = reordered.map((r) => r.id);

    setLoading(true);
    setError("");

    try {
      await api.requirements.reorder(projectId, {
        requirementIds,
        hierarchyId,
      });
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reorder requirements");
    } finally {
      setLoading(false);
      setActiveDragId(null);
    }
  };

  const loadHistory = async (requirementId: string) => {
    if (history[requirementId]) {
      setShowHistoryId(showHistoryId === requirementId ? null : requirementId);
      return;
    }

    try {
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
    setExpandedRequirements((prev) => new Set(prev).add(requirementId));
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
        return "bg-green-100 text-green-800";
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



      {disableDragAndDrop ? (
        <div className="space-y-2">
            {/* New requirement inline editing */}
            {isCreatingNew && (
              <div
                ref={(el) => {
                  if (el) {
                    requirementRefs.current["__new__"] = el;
                  }
                }}
                className={`transition-all duration-300 ease-out ${
                  isNewRequirementAnimating
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-4"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left side: Number and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start mb-2">
                      <span className="text-gray-700 flex-shrink-0 mr-2">New</span>
                      <textarea
                        ref={newRequirementTextareaRef}
                        value={newRequirement.description}
                        onChange={(e) =>
                          setNewRequirement({ ...newRequirement, description: e.target.value })
                        }
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
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
                          } else if (e.key === "Enter" && e.ctrlKey) {
                            handleCreate();
                          }
                        }}
                        placeholder="Requirement description"
                        rows={2}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Right side: Status and Type */}
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                <div className="mt-3 flex justify-between items-center">
                  <button
                    onClick={handleCreate}
                    disabled={loading || !newRequirement.description.trim()}
                    className="text-primary-600 hover:text-primary-700 underline disabled:opacity-50 text-sm"
                  >
                    Create
                  </button>
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
            )}

          {sortedRequirements.map((requirement) => {
              // Render without sortable wrapper when drag and drop is disabled
              const isExpanded = expandedRequirements.has(requirement.id);
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
                  className={`transition-all duration-300 ease-out ${
                    cancelingRequirementId === requirement.id
                      ? "opacity-0 scale-95"
                      : newlyCreatedRequirementId === requirement.id
                      ? "border-primary-500 bg-primary-50 shadow-lg scale-105"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side: Number and Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start mb-2">
                        <span className="flex-shrink-0 mr-2 text-gray-700">
                          {requirement.number.endsWith('.') ? requirement.number : `${requirement.number}.`}
                        </span>
                        <div className="flex-1 min-w-0">
                          {isEditingDescription ? (
                            <textarea
                              ref={(el) => {
                                descriptionTextareaRefs.current[requirement.id] = el;
                              }}
                              value={requirementFormData.description}
                              onChange={(e) =>
                                updateFormField(requirement.id, "description", e.target.value)
                              }
                              onFocus={() => handleFieldFocus(requirement.id, "description")}
                              onBlur={(e) => handleFieldBlur(requirement.id, "description", e)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="Requirement description"
                              rows={2}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            />
                          ) : (
                            <p className="text-gray-900">
                              {requirement.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Show timestamps and history/delete only in edit mode */}
                      {isEditing && (
                        <div className="mt-3 flex justify-between items-start text-xs text-gray-500">
                          <div className="space-y-1">
                            <div>
                              Created: {new Date(requirement.createdAt).toLocaleDateString()}
                              {requirement.createdBy &&
                                ` by ${
                                  requirement.createdBy.firstName &&
                                  requirement.createdBy.lastName
                                    ? `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`
                                    : requirement.createdBy.name ||
                                      requirement.createdBy.email
                                }`}
                            </div>
                            <button
                              onClick={() => loadHistory(requirement.id)}
                              className="text-primary-600 hover:text-primary-700 underline"
                            >
                              {isShowingHistory ? "Hide" : "Show"} History
                            </button>
                          </div>
                          <div className="space-y-1 text-right">
                            {requirement.updatedAt !== requirement.createdAt && (
                              <div>
                                Modified:{" "}
                                {new Date(requirement.updatedAt).toLocaleDateString()}
                                {requirement.lastModifiedBy &&
                                  ` by ${
                                    requirement.lastModifiedBy.firstName &&
                                    requirement.lastModifiedBy.lastName
                                      ? `${requirement.lastModifiedBy.firstName} ${requirement.lastModifiedBy.lastName}`
                                      : requirement.lastModifiedBy.name ||
                                        requirement.lastModifiedBy.email
                                  }`}
                              </div>
                            )}
                            <button
                              onClick={() => handleDelete(requirement.id)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50 underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      {/* History display */}
                      {isShowingHistory && isEditing && (
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          <h4 className="font-medium mb-2 text-sm">History</h4>
                          <div className="space-y-2">
                            {getFilteredHistory(requirement.id).length === 0 ? (
                              <p className="text-sm text-gray-500">No previous versions</p>
                            ) : (
                              getFilteredHistory(requirement.id).map((entry) => (
                                <div
                                  key={entry.id}
                                  className="bg-gray-50 rounded p-3 text-sm"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                                        entry.type
                                      )}`}
                                    >
                                      {entry.type}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                        entry.status
                                      )}`}
                                    >
                                      {entry.status}
                                    </span>
                                    <span className="text-gray-500">
                                      {new Date(entry.createdAt).toLocaleString()}
                                    </span>
                                    {entry.modifiedBy && (
                                      <span className="text-gray-500">
                                        by{" "}
                                        {entry.modifiedBy.firstName &&
                                        entry.modifiedBy.lastName
                                          ? `${entry.modifiedBy.firstName} ${entry.modifiedBy.lastName}`
                                          : entry.modifiedBy.name ||
                                            entry.modifiedBy.email}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-700 mb-2">{entry.description}</p>
                                  <button
                                    onClick={() => restoreFromHistory(requirement.id, entry)}
                                    className="text-xs text-primary-600 hover:text-primary-700 underline"
                                  >
                                    Restore
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side: Type, Status, and Edit button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isEditingType ? (
                        <select
                          value={requirementFormData.type || ""}
                          onChange={(e) => {
                            const newType = e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]);
                            updateFormField(requirement.id, "type", newType);
                            handleFieldSave(requirement.id, "type", newType);
                          }}
                          onFocus={() => handleFieldFocus(requirement.id, "type")}
                          onBlur={(e) => handleFieldBlur(requirement.id, "type", e)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        >
                          <option value="">(Blank)</option>
                          <option value="Information">Information</option>
                          <option value="Mandatory">Mandatory</option>
                          <option value="Important">Important</option>
                          <option value="Wish">Wish</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${isEditing ? 'cursor-pointer hover:opacity-80' : ''} ${getTypeColor(
                            requirementFormData.type
                          )}`}
                          onClick={() => {
                            if (isEditing) {
                              handleFieldFocus(requirement.id, "type");
                            }
                          }}
                        >
                          {requirementFormData.type}
                        </span>
                      )}
                      {isEditingStatus ? (
                        <select
                          value={requirementFormData.status || ""}
                          onChange={(e) => {
                            const newStatus = e.target.value as Requirement["status"];
                            updateFormField(requirement.id, "status", newStatus);
                            handleFieldSave(requirement.id, "status", newStatus);
                          }}
                          onFocus={() => handleFieldFocus(requirement.id, "status")}
                          onBlur={(e) => handleFieldBlur(requirement.id, "status", e)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        >
                          <option value="New">New</option>
                          <option value="ForReview">For Review</option>
                          <option value="Approved">Approved</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${isEditing ? 'cursor-pointer hover:opacity-80' : ''} ${getStatusColor(
                            requirementFormData.status
                          )}`}
                          onClick={() => {
                            if (isEditing) {
                              handleFieldFocus(requirement.id, "status");
                            }
                          }}
                        >
                          {requirementFormData.status || "New"}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          handleRequirementClick(requirement.id);
                          handleFieldFocus(requirement.id, "description");
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors opacity-0 group-hover/requirement:opacity-100"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => setActiveDragId(event.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedRequirements.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {/* New requirement inline editing */}
              {isCreatingNew && (
                <div
                  ref={(el) => {
                    if (el) {
                      requirementRefs.current["__new__"] = el;
                    }
                  }}
                  className={`transition-all duration-300 ease-out ${
                    isNewRequirementAnimating
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-4"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side: Number and Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start mb-2">
                        <span className="text-gray-700 flex-shrink-0 mr-2">New</span>
                        <textarea
                          ref={newRequirementTextareaRef}
                          value={newRequirement.description}
                          onChange={(e) =>
                            setNewRequirement({ ...newRequirement, description: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
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
                            } else if (e.key === "Enter" && e.ctrlKey) {
                              handleCreate();
                            }
                          }}
                          placeholder="Requirement description"
                          rows={2}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Right side: Status and Type */}
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                  <div className="mt-3 flex justify-between items-center">
                    <button
                      onClick={handleCreate}
                      disabled={loading || !newRequirement.description.trim()}
                      className="text-primary-600 hover:text-primary-700 underline disabled:opacity-50 text-sm"
                    >
                      Create
                    </button>
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
              )}

              {sortedRequirements.map((requirement) => {
                const isExpanded = expandedRequirements.has(requirement.id);
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
                    <div
                      ref={(el) => {
                        requirementRefs.current[requirement.id] = el;
                      }}
                      className={`transition-all duration-300 ease-out ${
                        cancelingRequirementId === requirement.id
                          ? "opacity-0 scale-95"
                          : newlyCreatedRequirementId === requirement.id
                          ? "border-primary-500 bg-primary-50 shadow-lg scale-105"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left side: Number and Description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start mb-2">
                            <span className="flex-shrink-0 mr-2 text-gray-700">
                              {requirement.number.endsWith('.') ? requirement.number : `${requirement.number}.`}
                            </span>
                            <div className="flex-1 min-w-0">
                              {isEditingDescription ? (
                                <textarea
                                  ref={(el) => {
                                    descriptionTextareaRefs.current[requirement.id] = el;
                                  }}
                                  value={requirementFormData.description}
                                  onChange={(e) =>
                                    updateFormField(requirement.id, "description", e.target.value)
                                  }
                                  onFocus={() => handleFieldFocus(requirement.id, "description")}
                                  onBlur={(e) => handleFieldBlur(requirement.id, "description", e)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Requirement description"
                                  rows={2}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  autoFocus
                                />
                              ) : (
                                <p className="text-gray-900">
                                  {requirement.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Show timestamps and history/delete only in edit mode */}
                          {isEditing && (
                            <div className="mt-3 flex justify-between items-start text-xs text-gray-500">
                              <div className="space-y-1">
                                <div>
                                  Created: {new Date(requirement.createdAt).toLocaleDateString()}
                                  {requirement.createdBy &&
                                    ` by ${
                                      requirement.createdBy.firstName &&
                                      requirement.createdBy.lastName
                                        ? `${requirement.createdBy.firstName} ${requirement.createdBy.lastName}`
                                        : requirement.createdBy.name ||
                                          requirement.createdBy.email
                                    }`}
                                </div>
                                <button
                                  onClick={() => loadHistory(requirement.id)}
                                  className="text-primary-600 hover:text-primary-700 underline"
                                >
                                  {isShowingHistory ? "Hide" : "Show"} History
                                </button>
                              </div>
                              <div className="space-y-1 text-right">
                                {requirement.updatedAt !== requirement.createdAt && (
                                  <div>
                                    Modified:{" "}
                                    {new Date(requirement.updatedAt).toLocaleDateString()}
                                    {requirement.lastModifiedBy &&
                                      ` by ${
                                        requirement.lastModifiedBy.firstName &&
                                        requirement.lastModifiedBy.lastName
                                          ? `${requirement.lastModifiedBy.firstName} ${requirement.lastModifiedBy.lastName}`
                                          : requirement.lastModifiedBy.name ||
                                            requirement.lastModifiedBy.email
                                      }`}
                                  </div>
                                )}
                                <button
                                  onClick={() => handleDelete(requirement.id)}
                                  disabled={loading}
                                  className="text-red-600 hover:text-red-800 disabled:opacity-50 underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}

                          {/* History display */}
                          {isShowingHistory && isEditing && (
                            <div className="mt-4 border-t border-gray-200 pt-4">
                              <h4 className="font-medium mb-2 text-sm">History</h4>
                              <div className="space-y-2">
                                {getFilteredHistory(requirement.id).length === 0 ? (
                                  <p className="text-sm text-gray-500">No previous versions</p>
                                ) : (
                                  getFilteredHistory(requirement.id).map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="bg-gray-50 rounded p-3 text-sm"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                                            entry.type
                                          )}`}
                                        >
                                          {entry.type}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                            entry.status
                                          )}`}
                                        >
                                          {entry.status}
                                        </span>
                                        <span className="text-gray-500">
                                          {new Date(entry.createdAt).toLocaleString()}
                                        </span>
                                        {entry.modifiedBy && (
                                          <span className="text-gray-500">
                                            by{" "}
                                            {entry.modifiedBy.firstName &&
                                            entry.modifiedBy.lastName
                                              ? `${entry.modifiedBy.firstName} ${entry.modifiedBy.lastName}`
                                              : entry.modifiedBy.name ||
                                                entry.modifiedBy.email}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-gray-700 mb-2">{entry.description}</p>
                                      <button
                                        onClick={() => restoreFromHistory(requirement.id, entry)}
                                        className="text-xs text-primary-600 hover:text-primary-700 underline"
                                      >
                                        Restore
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right side: Type, Status, and Edit button */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isEditingType ? (
                            <select
                              value={requirementFormData.type || ""}
                              onChange={(e) => {
                                const newType = e.target.value === "" ? "Information" : (e.target.value as Requirement["type"]);
                                updateFormField(requirement.id, "type", newType);
                                handleFieldSave(requirement.id, "type", newType);
                              }}
                              onFocus={() => handleFieldFocus(requirement.id, "type")}
                              onBlur={(e) => handleFieldBlur(requirement.id, "type", e)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            >
                              <option value="">(Blank)</option>
                              <option value="Information">Information</option>
                              <option value="Mandatory">Mandatory</option>
                              <option value="Important">Important</option>
                              <option value="Wish">Wish</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${isEditing ? 'cursor-pointer hover:opacity-80' : ''} ${getTypeColor(
                                requirementFormData.type
                              )}`}
                              onClick={() => {
                                if (isEditing) {
                                  handleFieldFocus(requirement.id, "type");
                                }
                              }}
                            >
                              {requirementFormData.type}
                            </span>
                          )}
                          {isEditingStatus ? (
                            <select
                              value={requirementFormData.status || ""}
                              onChange={(e) => {
                                const newStatus = e.target.value as Requirement["status"];
                                updateFormField(requirement.id, "status", newStatus);
                                handleFieldSave(requirement.id, "status", newStatus);
                              }}
                              onFocus={() => handleFieldFocus(requirement.id, "status")}
                              onBlur={(e) => handleFieldBlur(requirement.id, "status", e)}
                              className="px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            >
                              <option value="New">New</option>
                              <option value="ForReview">For Review</option>
                              <option value="Approved">Approved</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${isEditing ? 'cursor-pointer hover:opacity-80' : ''} ${getStatusColor(
                                requirementFormData.status
                              )}`}
                              onClick={() => {
                                if (isEditing) {
                                  handleFieldFocus(requirement.id, "status");
                                }
                              }}
                            >
                              {requirementFormData.status || "New"}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              handleRequirementClick(requirement.id);
                              handleFieldFocus(requirement.id, "description");
                            }}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors opacity-0 group-hover/requirement:opacity-100"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  </SortableRequirementItem>
                );
              })}
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
