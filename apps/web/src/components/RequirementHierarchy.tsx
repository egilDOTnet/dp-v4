"use client";

import { useState, useRef, useEffect } from "react";
import { api, RequirementHierarchy as RequirementHierarchyType, Requirement } from "@/lib/api";
import RequirementList from "@/components/RequirementList";
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

interface RequirementHierarchyProps {
  projectId: string;
  hierarchies: RequirementHierarchyType[];
  requirements: Requirement[];
  selectedHierarchyId: string | null;
  onHierarchySelect: (id: string | null) => void;
  onHierarchyUpdate: () => void;
  onRequirementUpdate: () => void;
  onAddRequirement?: (hierarchyId: string) => void;
  createForHierarchyId?: string | null;
  onCreateFormClose?: () => void;
  expandedHierarchies: Set<string>;
  onExpandedHierarchiesChange: (hierarchies: Set<string>) => void;
  disableDragAndDrop?: boolean;
  selectedRequirementIds?: Set<string>;
  onRequirementToggle?: (requirementId: string) => void;
  onHierarchyToggle?: (hierarchyId: string) => void;
}


interface SortableHierarchyItemProps {
  hierarchy: RequirementHierarchyType;
  children: (props: { attributes: any; listeners: any; setNodeRef: any; style: any }) => React.ReactNode;
}

function SortableHierarchyItem({
  hierarchy,
  children,
}: SortableHierarchyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: hierarchy.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children({ attributes, listeners, setNodeRef, style })}
    </div>
  );
}

interface SortableRequirementWrapperProps {
  requirement: Requirement;
  children: (props: { attributes: any; listeners: any }) => React.ReactNode;
}

function SortableRequirementWrapper({
  requirement,
  children,
}: SortableRequirementWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: requirement.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children({ attributes, listeners })}
    </div>
  );
}

// Simplified requirement item component for rendering in drag context
interface RequirementItemProps {
  projectId: string;
  requirement: Requirement;
  onRequirementUpdate: () => void;
  selectedHierarchyId?: string | null;
  hierarchyLevel?: 1 | 2;
  dragAttributes?: any;
  dragListeners?: any;
  selectedRequirementIds?: Set<string>;
  onRequirementToggle?: (requirementId: string) => void;
}

function RequirementItem({ projectId, requirement, onRequirementUpdate, selectedHierarchyId, hierarchyLevel = 1, dragAttributes, dragListeners, selectedRequirementIds, onRequirementToggle }: RequirementItemProps) {
  // Use RequirementList but only for this single requirement with drag enabled if props provided
  return (
    <RequirementList
      projectId={projectId}
      hierarchyId={requirement.hierarchyId}
      requirements={[requirement]}
      onRequirementUpdate={onRequirementUpdate}
      shouldShowCreateForm={false}
      onCreateFormClose={() => {}}
      selectedHierarchyId={selectedHierarchyId}
      disableDragAndDrop={!dragAttributes}
      hierarchyLevel={hierarchyLevel}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      selectedRequirementIds={selectedRequirementIds}
      onRequirementToggle={onRequirementToggle}
    />
  );
}

// Create form component
interface RequirementCreateFormProps {
  projectId: string;
  hierarchyId: string;
  onRequirementUpdate: () => void;
  onClose?: () => void;
  hierarchyLevel?: 1 | 2;
}

function RequirementCreateForm({ projectId, hierarchyId, onRequirementUpdate, onClose, hierarchyLevel = 1 }: RequirementCreateFormProps) {
  return (
    <RequirementList
      projectId={projectId}
      hierarchyId={hierarchyId}
      requirements={[]}
      onRequirementUpdate={onRequirementUpdate}
      shouldShowCreateForm={true}
      onCreateFormClose={onClose}
      selectedHierarchyId={null}
      disableDragAndDrop={true}
      hierarchyLevel={hierarchyLevel}
    />
  );
}

export default function RequirementHierarchyComponent({
  projectId,
  hierarchies,
  requirements,
  selectedHierarchyId,
  onHierarchySelect,
  onHierarchyUpdate,
  onRequirementUpdate,
  onAddRequirement,
  createForHierarchyId,
  onCreateFormClose,
  expandedHierarchies,
  onExpandedHierarchiesChange,
  disableDragAndDrop = false,
  selectedRequirementIds = new Set(),
  onRequirementToggle,
  onHierarchyToggle,
}: RequirementHierarchyProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const formDataRef = useRef(formData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hierarchyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Keep ref in sync with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

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

  const level1Hierarchies = hierarchies.filter((h) => h.parentId === null).sort((a, b) => a.order - b.order);
  const level2Hierarchies = hierarchies.filter((h) => h.parentId !== null).sort((a, b) => a.order - b.order);

  // Helper to check if all requirements under a hierarchy are selected
  const areAllRequirementsSelected = (hierarchyId: string): boolean => {
    const directRequirements = requirements.filter((r) => r.hierarchyId === hierarchyId);
    const childHierarchies = level2Hierarchies.filter((h) => h.parentId === hierarchyId);
    
    const allDirectSelected = directRequirements.length > 0 && 
      directRequirements.every((r) => selectedRequirementIds.has(r.id));
    
    const allChildrenSelected = childHierarchies.length > 0 &&
      childHierarchies.every((h) => areAllRequirementsSelected(h.id));
    
    if (directRequirements.length === 0 && childHierarchies.length === 0) {
      return false; // No requirements to select
    }
    
    if (directRequirements.length > 0 && childHierarchies.length > 0) {
      return allDirectSelected && allChildrenSelected;
    }
    
    return directRequirements.length > 0 ? allDirectSelected : allChildrenSelected;
  };

  // Helper to get combined and sorted children (both sub-hierarchies and requirements) for a Level 1 hierarchy
  const getChildrenForLevel1 = (h1Id: string) => {
    const subHierarchies = level2Hierarchies.filter((h2) => h2.parentId === h1Id);
    const level1Requirements = requirements.filter((r) => r.hierarchyId === h1Id);
    
    // Combine both types and sort by their number
    const combined = [
      ...subHierarchies.map((h) => ({ type: 'hierarchy' as const, item: h, number: h.number, order: h.order })),
      ...level1Requirements.map((r) => ({ type: 'requirement' as const, item: r, number: r.number, order: r.order }))
    ];
    
    // Sort by order field
    combined.sort((a, b) => a.order - b.order);
    
    return combined;
  };

  // Helper to get total count of all elements under a Level 1 hierarchy
  const getTotalChildCount = (h1Id: string) => {
    const subHierarchies = level2Hierarchies.filter((h2) => h2.parentId === h1Id);
    const level1Requirements = requirements.filter((r) => r.hierarchyId === h1Id);
    
    // Count all level 2 requirements
    const level2RequirementsCount = subHierarchies.reduce((sum, h2) => {
      return sum + requirements.filter((r) => r.hierarchyId === h2.id).length;
    }, 0);
    
    // Total = sub-hierarchies + level 1 requirements + level 2 requirements
    return subHierarchies.length + level1Requirements.length + level2RequirementsCount;
  };

  const toggleHierarchyExpansion = (hierarchyId: string) => {
    // Don't toggle if we're in the middle of a drag operation
    if (isDragging) {
      return;
    }
    
    const isCurrentlyExpanded = expandedHierarchies.has(hierarchyId);
    
    const newSet = new Set(expandedHierarchies);
    if (isCurrentlyExpanded) {
      newSet.delete(hierarchyId);
    } else {
      newSet.add(hierarchyId);
    }
    onExpandedHierarchiesChange(newSet);
    
    // Schedule state updates for parent component after this render completes
    setTimeout(() => {
      if (isCurrentlyExpanded) {
        // If collapsing and this hierarchy is selected, deselect it
        if (selectedHierarchyId === hierarchyId) {
          onHierarchySelect(null);
        }
        // If collapsing a level 1, also deselect any selected children
        const children = level2Hierarchies.filter((h2) => h2.parentId === hierarchyId);
        children.forEach((child) => {
          if (selectedHierarchyId === child.id) {
            onHierarchySelect(null);
          }
        });
      } else {
        // When expanding, select it to show requirements
        onHierarchySelect(hierarchyId);
      }
    }, 0);
  };

  const handleCreate = async (parentId: string | null) => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.requirements.hierarchies.create(projectId, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        parentId: parentId || undefined,
      });
      setFormData({ title: "", description: "" });
      setCreatingParentId(null);
      onHierarchyUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to create hierarchy");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[RequirementHierarchy] Updating hierarchy:", { projectId, hierarchyId: id, title: formData.title.trim() });
      await api.requirements.hierarchies.update(projectId, id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
      });
      setEditingId(null);
      setFormData({ title: "", description: "" });
      onHierarchyUpdate();
    } catch (err: any) {
      console.error("[RequirementHierarchy] Error updating hierarchy:", { projectId, hierarchyId: id, error: err });
      setError(err.message || "Failed to update hierarchy");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this hierarchy level? This will also delete all requirements in it.")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.requirements.hierarchies.delete(projectId, id);
      if (selectedHierarchyId === id) {
        onHierarchySelect(null);
      }
      onHierarchyUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to delete hierarchy");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (hierarchy: RequirementHierarchyType) => {
    setEditingId(hierarchy.id);
    setFormData({
      title: hierarchy.title,
      description: hierarchy.description || "",
    });
  };

  // Auto-focus title input when entering edit mode
  useEffect(() => {
    if (editingId) {
      const input = titleInputRefs.current[editingId];
      if (input) {
        input.focus();
      }
    }
  }, [editingId]);

  // Helper to check if an element is within the same editing hierarchy
  const isWithinSameHierarchy = (hierarchyId: string, element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Node)) return false;
    const hierarchyElement = hierarchyRefs.current[hierarchyId];
    if (!hierarchyElement) return false;
    return hierarchyElement.contains(element);
  };

  // Handle click outside to save and exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside the editing hierarchy
      if (editingId) {
        const hierarchyElement = hierarchyRefs.current[editingId];
        if (!hierarchyElement) return;
        
        // Check if target is inside the hierarchy element
        // Walk up the DOM tree to be sure
        let currentElement: Node | null = target;
        let isInsideHierarchy = false;
        
        while (currentElement && currentElement !== document.body) {
          if (currentElement === hierarchyElement || hierarchyElement.contains(currentElement)) {
            isInsideHierarchy = true;
            break;
          }
          currentElement = currentElement.parentNode;
        }
        
        // Only exit edit mode if click is truly outside
        if (!isInsideHierarchy) {
          // Use ref to get latest formData without causing re-renders
          const currentFormData = formDataRef.current;
          // Save and exit edit mode
          if (currentFormData.title.trim()) {
            console.log("[RequirementHierarchy] Click outside detected, saving hierarchy:", { editingId, projectId, title: currentFormData.title });
            handleUpdate(editingId);
          } else {
            // If title is empty, just cancel
            cancelEdit();
          }
        }
      }
    };

    if (editingId) {
      // Add a small delay to ensure refs are set after render
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [editingId, projectId]); // Removed formData from dependencies, using ref instead

  // Auto-focus title input when creating new hierarchy
  useEffect(() => {
    if (creatingParentId) {
      const inputKey = creatingParentId === "ROOT" ? "ROOT" : `create-${creatingParentId}`;
      const input = titleInputRefs.current[inputKey];
      if (input) {
        input.focus();
      }
    }
  }, [creatingParentId]);

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ title: "", description: "" });
    setError("");
  };

  const startCreate = (parentId: string | null) => {
    // Use "ROOT" to indicate creating level 1, or parent ID for level 2
    setCreatingParentId(parentId === null ? "ROOT" : parentId);
    setFormData({ title: "", description: "" });
    setError("");
  };

  const cancelCreate = () => {
    setCreatingParentId(null);
    setFormData({ title: "", description: "" });
    setError("");
  };

  // Wrapper for requirement updates - expanded state is now managed by parent
  const handleRequirementUpdateWithState = async () => {
    await onRequirementUpdate();
  };

  const toggleDescription = (hierarchyId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(hierarchyId)) {
        newSet.delete(hierarchyId);
      } else {
        newSet.add(hierarchyId);
      }
      return newSet;
    });
  };

  const handleDragEnd = async (event: DragEndEvent, parentId: string | null) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const hierarchiesToReorder = parentId === null ? level1Hierarchies : level2Hierarchies.filter((h) => h.parentId === parentId);
    const oldIndex = hierarchiesToReorder.findIndex((h) => h.id === active.id);
    const newIndex = hierarchiesToReorder.findIndex((h) => h.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(hierarchiesToReorder, oldIndex, newIndex);
    const hierarchyIds = reordered.map((h) => h.id);

    setLoading(true);
    setError("");

    try {
      await api.requirements.hierarchies.reorder(projectId, {
        hierarchyIds,
        parentId: parentId || undefined,
      });
      // Expanded state is now managed by parent - no need to save/restore
      await onHierarchyUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reorder hierarchies");
    } finally {
      setLoading(false);
    }
  };

  const handleChildDragEnd = async (event: DragEndEvent, parentId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Check if this is a level 2 requirement being dragged
    const draggedRequirement = requirements.find(r => r.id === active.id);
    // Find the hierarchy that this requirement belongs to
    const draggedRequirementHierarchy = draggedRequirement ? hierarchies.find(h => h.id === draggedRequirement.hierarchyId) : null;
    // Check if it's a level 2 requirement by checking if its hierarchy has a parent that matches parentId
    const isLevel2Requirement = draggedRequirementHierarchy && draggedRequirementHierarchy.parentId === parentId;
    const level2HierarchiesInParent = level2Hierarchies.filter(h => h.parentId === parentId);
    
    if (isLevel2Requirement) {
      // Handle level 2 requirement drag - determine target hierarchy
      const overRequirement = requirements.find(r => r.id === over.id);
      const overHierarchy = level2HierarchiesInParent.find(h => h.id === over.id);
      
      // Validate that we have a valid drop target
      if (!overRequirement && !overHierarchy) {
        // Dropped on something that's not a requirement or level 2 hierarchy - abort
        return;
      }
      
      let targetHierarchyId = draggedRequirement!.hierarchyId;
      
      if (overHierarchy) {
        // Dropped on a level 2 hierarchy
        targetHierarchyId = overHierarchy.id;
      } else if (overRequirement && level2HierarchiesInParent.some(h => h.id === overRequirement.hierarchyId)) {
        // Dropped on another level 2 requirement
        targetHierarchyId = overRequirement.hierarchyId;
      } else if (overRequirement) {
        // Dropped on a requirement that's not a level 2 requirement - abort
        return;
      }

      setLoading(true);
      setError("");

      try {
        const sourceHierarchyId = draggedRequirement!.hierarchyId;
        
        // Check if this is a cross-hierarchy move
        if (sourceHierarchyId !== targetHierarchyId) {
          // Cross-hierarchy move
          const targetRequirements = requirements.filter(r => r.hierarchyId === targetHierarchyId);
          const overRequirementInTarget = overRequirement && overRequirement.hierarchyId === targetHierarchyId ? overRequirement : null;
          
          let newOrder = 0;
          if (overRequirementInTarget) {
            // Insert at the position of the requirement we're hovering over
            newOrder = overRequirementInTarget.order;
          } else {
            // Add to the end
            newOrder = targetRequirements.length > 0 ? Math.max(...targetRequirements.map(r => r.order)) + 1 : 0;
          }

          await api.requirements.move(projectId, draggedRequirement!.id, {
            hierarchyId: targetHierarchyId,
            order: newOrder,
          });
        } else {
          // Same hierarchy - just reorder
          const hierarchyRequirements = requirements.filter(r => r.hierarchyId === targetHierarchyId).sort((a, b) => a.order - b.order);
          const oldIndex = hierarchyRequirements.findIndex(r => r.id === active.id);
          const newIndex = hierarchyRequirements.findIndex(r => r.id === over.id);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(hierarchyRequirements, oldIndex, newIndex);
            await api.requirements.reorder(projectId, {
              requirementIds: reordered.map(r => r.id),
              hierarchyId: targetHierarchyId,
            });
          } else if (oldIndex === -1 || newIndex === -1) {
            // If we can't find the indices, don't do anything
            setLoading(false);
            return;
          }
        }

        // Reload data - expanded state is managed by parent and will persist
        await onRequirementUpdate();
      } catch (err: any) {
        setError(err.message || "Failed to move requirement");
      } finally {
        setLoading(false);
      }
      
      return;
    }

    // Check if dragging a level 1 requirement
    const isDraggingLevel1Requirement = draggedRequirement && draggedRequirement.hierarchyId === parentId;
    const subHierarchies = level2Hierarchies.filter(h => h.parentId === parentId);
    
    if (isDraggingLevel1Requirement && subHierarchies.length > 0) {
      setError("Cannot add requirements to a hierarchy that has sub-hierarchies");
      return;
    }

    // Check if dragging a hierarchy where there are already requirements
    const isDraggingHierarchy = hierarchies.find(h => h.id === active.id);
    const level1Requirements = requirements.filter(r => r.hierarchyId === parentId);
    
    if (isDraggingHierarchy && level1Requirements.length > 0) {
      setError("Cannot add sub-hierarchies to a hierarchy that has requirements");
      return;
    }

    // Get all children (both hierarchies and requirements)
    const children = getChildrenForLevel1(parentId);
    const oldIndex = children.findIndex((c) => 
      c.type === 'hierarchy' ? c.item.id === active.id : c.item.id === active.id
    );
    const newIndex = children.findIndex((c) => 
      c.type === 'hierarchy' ? c.item.id === over.id : c.item.id === over.id
    );

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(children, oldIndex, newIndex);
    
    // Create ordered arrays with all items maintaining their relative positions
    const hierarchyItems: Array<{ id: string; order: number }> = [];
    const requirementItems: Array<{ id: string; order: number }> = [];
    
    reordered.forEach((child, index) => {
      if (child.type === 'hierarchy') {
        hierarchyItems.push({ id: child.item.id, order: index });
      } else {
        requirementItems.push({ id: child.item.id, order: index });
      }
    });

    setLoading(true);
    setError("");

    try {
      // Reorder all items in parallel
      const promises = [];
      
      if (hierarchyItems.length > 0) {
        promises.push(
          api.requirements.hierarchies.reorder(projectId, {
            hierarchyIds: hierarchyItems.map(h => h.id),
            parentId,
          })
        );
      }
      
      if (requirementItems.length > 0) {
        promises.push(
          api.requirements.reorder(projectId, {
            requirementIds: requirementItems.map(r => r.id),
            hierarchyId: parentId,
          })
        );
      }
      
      await Promise.all(promises);
      
      // Reload data - expanded state is managed by parent and will persist
      await Promise.all([onHierarchyUpdate(), onRequirementUpdate()]);
    } catch (err: any) {
      setError(err.message || "Failed to reorder items");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Requirement Hierarchy</h2>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Level 1 Hierarchies */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          setIsDragging(true);
        }}
        onDragEnd={(event) => {
          handleDragEnd(event, null);
          // Delay clearing isDragging to prevent click handlers from firing
          setTimeout(() => setIsDragging(false), 100);
        }}
      >
        <SortableContext
          items={level1Hierarchies.map((h) => h.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {level1Hierarchies.map((h1) => {
          const _children = level2Hierarchies.filter((h2) => h2.parentId === h1.id);
          const isEditing = editingId === h1.id;
          const isCreatingChild = creatingParentId === h1.id;

          return (
            <SortableHierarchyItem key={h1.id} hierarchy={h1}>
            {({ attributes, listeners }) => (
            <div>
              {isEditing ? (
                <div 
                  ref={(el) => {
                    hierarchyRefs.current[h1.id] = el;
                  }}
                  className="border-2 border-primary-700 rounded-lg bg-background-tertiary flex items-stretch overflow-hidden"
                >
                  {/* Left side: Number - same as view mode */}
                  <div 
                    className="bg-primary-700 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg"
                  >
                    <span className="font-semibold text-lg leading-none">
                      {h1.number.endsWith('.') ? h1.number.slice(0, -1) : h1.number}
                    </span>
                  </div>

                  {/* Right side: Edit form */}
                  <div className="flex-1 px-4 py-3">
                    <div className="space-y-3">
                      <input
                        ref={(el) => {
                          titleInputRefs.current[h1.id] = el;
                        }}
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        onKeyDown={(e) => {
                          // Handle Ctrl-A/Command-A to select all text
                          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                            e.preventDefault();
                            e.currentTarget.select();
                            return;
                          }
                          if (e.key === "Escape") {
                            cancelEdit();
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (formData.title.trim()) {
                              handleUpdate(h1.id);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Check if focus is moving to another element within the same hierarchy
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          if (relatedTarget && isWithinSameHierarchy(h1.id, relatedTarget)) {
                            return;
                          }
                          
                          // Auto-save on blur if title is not empty
                          if (formData.title.trim()) {
                            setTimeout(() => {
                              const activeElement = document.activeElement;
                              // Double-check that focus is not still within the hierarchy
                              if (editingId === h1.id && !isWithinSameHierarchy(h1.id, activeElement)) {
                                handleUpdate(h1.id);
                              }
                            }, 150);
                          }
                        }}
                        placeholder="Title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-700 font-medium text-lg"
                      />
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        onKeyDown={(e) => {
                          // Handle Ctrl-A/Command-A to select all text
                          if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                            e.preventDefault();
                            e.currentTarget.select();
                            return;
                          }
                        }}
                        onBlur={(e) => {
                          // Check if focus is moving to another element within the same hierarchy
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          if (relatedTarget && isWithinSameHierarchy(h1.id, relatedTarget)) {
                            return;
                          }
                          
                          // Auto-save on blur
                          if (formData.title.trim()) {
                            setTimeout(() => {
                              const activeElement = document.activeElement;
                              // Double-check that focus is not still within the hierarchy
                              if (editingId === h1.id && !isWithinSameHierarchy(h1.id, activeElement)) {
                                handleUpdate(h1.id);
                              }
                            }, 150);
                          }
                        }}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-700"
                      />
                      {/* Delete button in lower right */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDelete(h1.id)}
                          disabled={loading}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="rounded-lg bg-primary-600 flex items-stretch overflow-hidden cursor-pointer"
                  onClick={() => {
                    // Allow click to toggle if not dragging
                    if (!isDragging) {
                      toggleHierarchyExpansion(h1.id);
                    }
                  }}
                >
                  {/* Left side: Number with drag handle */}
                  <div
                    {...(disableDragAndDrop ? {} : attributes)}
                    {...(disableDragAndDrop ? {} : listeners)}
                    className={`bg-primary-700 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 rounded-tl-lg rounded-bl-lg transition-colors ${
                      disableDragAndDrop ? '' : 'cursor-grab active:cursor-grabbing hover:bg-primary-800'
                    }`}
                    title={disableDragAndDrop ? "Click to expand/collapse" : "Drag to reorder or click to expand/collapse"}
                  >
                    <span className="font-semibold text-lg leading-none">
                      {h1.number.endsWith('.') ? h1.number.slice(0, -1) : h1.number}
                    </span>
                  </div>

                  {/* Right side: Hierarchy content */}
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-medium text-lg leading-none text-gray-100 hover:text-white cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(h1);
                            }}
                          >
                            {h1.title}
                          </span>
                          {h1.description && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDescription(h1.id);
                              }}
                              className="flex-shrink-0 text-white hover:text-white self-center"
                              title="Toggle description"
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
                                  strokeWidth={2.5}
                                  d="M4 6h16M4 12h16M4 18h16"
                                />
                              </svg>
                            </button>
                          )}
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                            getTotalChildCount(h1.id) > 0 
                              ? 'bg-primary-700 text-white' 
                              : 'invisible'
                          }`}>
                            {getTotalChildCount(h1.id) || 0}
                          </span>
                        </div>
                        {/* Description */}
                        {h1.description && expandedDescriptions.has(h1.id) && (
                          <p className="text-sm text-gray-100 mt-1">{h1.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Combined children (sub-hierarchies and requirements) with unified drag context */}
              {expandedHierarchies.has(h1.id) && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => {
                    setIsDragging(true);
                  }}
                  onDragEnd={(event) => {
                    handleChildDragEnd(event, h1.id);
                    // Delay clearing isDragging to prevent click handlers from firing
                    setTimeout(() => setIsDragging(false), 100);
                  }}
                >
                  <SortableContext
                    items={[
                      // Level 1 children (both hierarchies and requirements)
                      ...getChildrenForLevel1(h1.id).map((child) => 
                        child.type === 'hierarchy' ? child.item.id : child.item.id
                      ),
                      // Include only VISIBLE level 2 requirements (from expanded hierarchies) for dragging
                      ...level2Hierarchies
                        .filter(h2 => h2.parentId === h1.id && expandedHierarchies.has(h2.id))
                        .flatMap(h2 => requirements.filter(r => r.hierarchyId === h2.id).map(r => r.id))
                    ]}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-2 space-y-2">
                      {getChildrenForLevel1(h1.id).map((child) => {
                        if (child.type === 'hierarchy') {
                          const h2 = child.item;
                          const isEditing2 = editingId === h2.id;
                          
                          return (
                            <SortableHierarchyItem key={h2.id} hierarchy={h2}>
                        {({ attributes, listeners }) => (
                        <div>
                          {isEditing2 ? (
                            <div 
                              ref={(el) => {
                                hierarchyRefs.current[h2.id] = el;
                              }}
                              className="border-2 border-primary-600 rounded-lg bg-background-tertiary flex items-stretch overflow-hidden" 
                              style={{ marginLeft: '3.5rem' }}
                            >
                              {/* Left side: Number - same as view mode */}
                              <div 
                                className="bg-primary-600 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg"
                              >
                                <span className="font-semibold text-base leading-none">
                                  {h2.number.endsWith('.') ? h2.number.slice(0, -1) : h2.number}
                                </span>
                              </div>

                              {/* Right side: Edit form */}
                              <div className="flex-1 px-4 py-3">
                                <div className="space-y-3">
                                  <input
                                    ref={(el) => {
                                      titleInputRefs.current[h2.id] = el;
                                    }}
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) =>
                                      setFormData({ ...formData, title: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        cancelEdit();
                                      } else if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (formData.title.trim()) {
                                          handleUpdate(h2.id);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Check if focus is moving to another element within the same hierarchy
                                      const relatedTarget = e.relatedTarget as HTMLElement;
                                      if (relatedTarget && isWithinSameHierarchy(h2.id, relatedTarget)) {
                                        return;
                                      }
                                      
                                      // Auto-save on blur if title is not empty
                                      if (formData.title.trim()) {
                                        setTimeout(() => {
                                          const activeElement = document.activeElement;
                                          // Double-check that focus is not still within the hierarchy
                                          if (editingId === h2.id && !isWithinSameHierarchy(h2.id, activeElement)) {
                                            handleUpdate(h2.id);
                                          }
                                        }, 150);
                                      }
                                    }}
                                    placeholder="Title"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600 font-medium text-base"
                                  />
                                  <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                      setFormData({ ...formData, description: e.target.value })
                                    }
                                    onBlur={(e) => {
                                      // Check if focus is moving to another element within the same hierarchy
                                      const relatedTarget = e.relatedTarget as HTMLElement;
                                      if (relatedTarget && isWithinSameHierarchy(h2.id, relatedTarget)) {
                                        return;
                                      }
                                      
                                      // Auto-save on blur
                                      if (formData.title.trim()) {
                                        setTimeout(() => {
                                          const activeElement = document.activeElement;
                                          // Double-check that focus is not still within the hierarchy
                                          if (editingId === h2.id && !isWithinSameHierarchy(h2.id, activeElement)) {
                                            handleUpdate(h2.id);
                                          }
                                        }, 150);
                                      }
                                    }}
                                    placeholder="Description (optional)"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
                                  />
                                  {/* Delete button in lower right */}
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => handleDelete(h2.id)}
                                      disabled={loading}
                                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="group relative rounded-lg bg-primary-500 flex items-stretch overflow-visible cursor-pointer" 
                              style={{ marginLeft: '3.5rem' }}
                              onClick={() => {
                                // Allow click to toggle if not dragging
                                if (!isDragging) {
                                  toggleHierarchyExpansion(h2.id);
                                }
                              }}
                            >
                              {/* Checkbox - positioned to the left of the number */}
                              {onHierarchyToggle && requirements.filter((r) => r.hierarchyId === h2.id).length > 0 && (
                                <div
                                  className={`absolute -left-8 top-1/2 -translate-y-1/2 transition-opacity z-10 flex items-center justify-center ${
                                    areAllRequirementsSelected(h2.id)
                                      ? "opacity-100"
                                      : "opacity-0 group-hover:opacity-100"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onHierarchyToggle(h2.id);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={areAllRequirementsSelected(h2.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      onHierarchyToggle(h2.id);
                                    }}
                                    className="w-5 h-5 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              )}
                              
                              {/* Left side: Number with drag handle */}
                              <div
                                {...(disableDragAndDrop ? {} : attributes)}
                                {...(disableDragAndDrop ? {} : listeners)}
                                className={`bg-primary-600 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 rounded-tl-lg rounded-bl-lg transition-colors ${
                                  disableDragAndDrop ? '' : 'cursor-grab active:cursor-grabbing hover:bg-primary-700'
                                }`}
                                title={disableDragAndDrop ? "Click to expand/collapse" : "Drag to reorder or click to expand/collapse"}
                              >
                                <span className="font-semibold text-base leading-none">
                                  {h2.number.endsWith('.') ? h2.number.slice(0, -1) : h2.number}
                                </span>
                              </div>

                              {/* Right side: Hierarchy content */}
                              <div className="flex-1 px-4 py-3">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className="font-medium text-base leading-none text-gray-100 hover:text-white cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEdit(h2);
                                        }}
                                      >
                                        {h2.title}
                                      </span>
                                      {h2.description && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDescription(h2.id);
                                          }}
                                          className="flex-shrink-0 text-white hover:text-white self-center"
                                          title="Toggle description"
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
                                              strokeWidth={2.5}
                                              d="M4 6h16M4 12h16M4 18h16"
                                            />
                                          </svg>
                                        </button>
                                      )}
                                      {(() => {
                                        const count = requirements.filter((r) => r.hierarchyId === h2.id).length;
                                        return (
                                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                                            count > 0 
                                              ? 'bg-primary-600 text-white' 
                                              : 'invisible'
                                          }`}>
                                            {count || 0}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    {/* Description */}
                                    {h2.description && expandedDescriptions.has(h2.id) && (
                                      <p className="text-sm text-gray-100 mt-1">
                                        {h2.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Requirements inline for Level 2 - only show if expanded */}
                          {expandedHierarchies.has(h2.id) && (
                            <>
                              <div className="mt-2 space-y-2" style={{ marginLeft: '7rem' }}>
                                {requirements.filter((r) => r.hierarchyId === h2.id).sort((a, b) => a.order - b.order).map((req) => (
                                  <SortableRequirementWrapper key={req.id} requirement={req}>
                                    {({ attributes, listeners }) => (
                                      <RequirementItem
                                        projectId={projectId}
                                        requirement={req}
                                        onRequirementUpdate={handleRequirementUpdateWithState}
                                        selectedHierarchyId={selectedHierarchyId}
                                        hierarchyLevel={2}
                                        dragAttributes={disableDragAndDrop ? undefined : attributes}
                                        dragListeners={disableDragAndDrop ? undefined : listeners}
                                        selectedRequirementIds={selectedRequirementIds}
                                        onRequirementToggle={onRequirementToggle}
                                      />
                                    )}
                                  </SortableRequirementWrapper>
                                ))}
                                
                                {/* Create form */}
                                {createForHierarchyId === h2.id && (
                                  <RequirementCreateForm
                                    projectId={projectId}
                                    hierarchyId={h2.id}
                                    onRequirementUpdate={handleRequirementUpdateWithState}
                                    onClose={onCreateFormClose}
                                    hierarchyLevel={2}
                                  />
                                )}
                              </div>
                              
                              {onAddRequirement && createForHierarchyId !== h2.id && !disableDragAndDrop && (
                                <div className="mt-2" style={{ marginLeft: '7rem' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddRequirement(h2.id);
                                    }}
                                    className="text-sm text-primary-600 hover:text-primary-500 transition-colors"
                                  >
                                    + Add requirement here
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                          </div>
                          )}
                          </SortableHierarchyItem>
                        );
                      } else {
                        // Render requirement with sortable wrapper
                        const req = child.item;
                        return (
                          <SortableRequirementWrapper key={req.id} requirement={req}>
                          {({ attributes, listeners }) => (
                            <div style={{ marginLeft: '3.5rem' }}>
                              <RequirementItem
                                projectId={projectId}
                                requirement={req}
                                onRequirementUpdate={handleRequirementUpdateWithState}
                                selectedHierarchyId={selectedHierarchyId}
                                hierarchyLevel={1}
                                dragAttributes={disableDragAndDrop ? undefined : attributes}
                                dragListeners={disableDragAndDrop ? undefined : listeners}
                                selectedRequirementIds={selectedRequirementIds}
                                onRequirementToggle={onRequirementToggle}
                              />
                            </div>
                          )}
                          </SortableRequirementWrapper>
                        );
                      }
                    })}
                    
                    {/* Create new requirement form */}
                    {createForHierarchyId === h1.id && (
                      <div style={{ marginLeft: '3.5rem' }}>
                        <RequirementCreateForm
                          projectId={projectId}
                          hierarchyId={h1.id}
                          onRequirementUpdate={handleRequirementUpdateWithState}
                          onClose={onCreateFormClose}
                          hierarchyLevel={1}
                        />
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

              {/* OLD CODE - Level 2 Hierarchies - only show if parent is expanded */}
              {/* Disabled: {false && expandedHierarchies.has(h1.id) && children.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => {}}
                  onDragEnd={(event) => handleDragEnd(event, h1.id)}
                >
                  <SortableContext
                    items={children.map((h) => h.id)}
                    strategy={verticalListSortingStrategy}
                  >
                <div className="mt-2 space-y-2">
                  {children.map((h2) => {
                    const isEditing2 = editingId === h2.id;

                    return (
                      <SortableHierarchyItem key={h2.id} hierarchy={h2}>
                      {({ attributes, listeners }) => (
                      <div>
                        {isEditing2 ? (
                          <div className="space-y-3">
                            <input
                              ref={(el) => {
                                titleInputRefs.current[h2.id] = el;
                              }}
                              type="text"
                              value={formData.title}
                              onChange={(e) =>
                                setFormData({ ...formData, title: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  cancelEdit();
                                } else if (e.key === "Enter" && e.ctrlKey) {
                                  handleUpdate(h2.id);
                                }
                              }}
                              placeholder="Title"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                            <textarea
                              value={formData.description}
                              onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                              }
                              placeholder="Description (optional)"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                            <div className="flex gap-2 justify-between">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdate(h2.id)}
                                  disabled={loading}
                                  className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={loading}
                                  className="px-3 py-1 border border-border-primary rounded-md hover:bg-background-primary disabled:opacity-50 text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                              <button
                                onClick={() => handleDelete(h2.id)}
                                disabled={loading}
                                className="px-3 py-1 text-red-600 hover:text-red-800 disabled:opacity-50 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative" style={{ marginLeft: '3.5rem' }}>
                            <div
                              {...attributes}
                              {...listeners}
                              className="absolute -left-5 flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:opacity-100 flex-shrink-0"
                              style={{ paddingTop: '0.25rem' }}
                              title="Drag to reorder"
                              onClick={(e) => e.stopPropagation()}
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
                            <div className="flex items-start justify-between">
                              <div
                                className="flex-1 cursor-pointer min-w-0 flex items-start"
                                onClick={() => toggleHierarchyExpansion(h2.id)}
                              >
                                <span className={`font-medium flex-shrink-0 mr-2 ${
                                  expandedHierarchies.has(h2.id)
                                    ? "text-primary-600"
                                    : "text-gray-900"
                                }`}>
                                  {h2.number.endsWith('.') ? h2.number : `${h2.number}.`}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 flex-wrap">
                                    <span
                                      className={`font-medium hover:text-primary-500 ${
                                        expandedHierarchies.has(h2.id)
                                          ? "text-primary-600"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {h2.title}
                                    </span>
                                    {h2.description && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDescription(h2.id);
                                        }}
                                        className="flex-shrink-0 text-gray-500 hover:text-gray-700 self-center"
                                        title="Toggle description"
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
                                            d="M4 6h16M4 12h16M4 18h16"
                                          />
                                        </svg>
                                      </button>
                                    )}
                                    {(() => {
                                      const count = requirements.filter((r) => r.hierarchyId === h2.id).length;
                                      return count > 0 ? (
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-background-secondary text-text-primary text-xs font-medium">
                                          {count}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                  {h2.description && expandedDescriptions.has(h2.id) && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {h2.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2" style={{ width: '120px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(h2);
                                  }}
                                  className="px-3 py-1 bg-background-primary text-text-primary rounded-md hover:bg-background-secondary text-sm transition-colors"
                                >
                                  Edit
                                </button>
                                {onAddRequirement && (
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!expandedHierarchies.has(h2.id)) {
                                          const newSet = new Set(expandedHierarchies);
                                          newSet.add(h2.id);
                                          onExpandedHierarchiesChange(newSet);
                                          onHierarchySelect(h2.id);
                                        }
                                        onAddRequirement(h2.id);
                                      }}
                                    className="w-6 h-6 bg-primary-600 text-white rounded-full hover:bg-primary-700 flex items-center justify-center transition-colors"
                                    title="New requirement"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {expandedHierarchies.has(h2.id) && (
                          <div className="mt-2" style={{ marginLeft: '7rem' }}>
                            <RequirementList
                              projectId={projectId}
                              hierarchyId={h2.id}
                              requirements={requirements.filter((r) => r.hierarchyId === h2.id)}
                              onRequirementUpdate={onRequirementUpdate}
                              shouldShowCreateForm={createForHierarchyId === h2.id}
                              onCreateFormClose={onCreateFormClose}
                              selectedHierarchyId={selectedHierarchyId}
                              hierarchyLevel={2}
                            />
                          </div>
                        )}
                      </div>
                      )}
                      </SortableHierarchyItem>
                    );
                  })}
                </div>
                  </SortableContext>
                </DndContext>
              )} */}

              {/* Create Level 2 Hierarchy - only show if parent is expanded */}
              {expandedHierarchies.has(h1.id) && isCreatingChild && (
                <div className="mt-2" style={{ marginLeft: '3.5rem' }}>
                  <div className="border border-border-primary rounded p-3 bg-background-secondary space-y-3">
                    <input
                      ref={(el) => {
                        titleInputRefs.current[`create-${h1.id}`] = el;
                      }}
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      onKeyDown={(e) => {
                        // Handle Ctrl-A/Command-A to select all text
                        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                          e.preventDefault();
                          e.currentTarget.select();
                          return;
                        }
                      }}
                      placeholder="Title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      onKeyDown={(e) => {
                        // Handle Ctrl-A/Command-A to select all text
                        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                          e.preventDefault();
                          e.currentTarget.select();
                          return;
                        }
                      }}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreate(h1.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                      >
                        Create
                      </button>
                      <button
                        onClick={cancelCreate}
                        disabled={loading}
                        className="px-3 py-1 border border-border-primary rounded-md hover:bg-background-primary disabled:opacity-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Level 2 Hierarchy and Requirement Links - only show if parent is expanded and not searching */}
              {expandedHierarchies.has(h1.id) && !isCreatingChild && !disableDragAndDrop && (() => {
                const subHierarchies = level2Hierarchies.filter((h2) => h2.parentId === h1.id);
                const level1Requirements = requirements.filter((r) => r.hierarchyId === h1.id);
                const hasSubHierarchies = subHierarchies.length > 0;
                const hasRequirements = level1Requirements.length > 0;

                return (
                  <div className="mt-2 flex gap-4" style={{ marginLeft: '3.5rem' }}>
                    {!hasRequirements && (
                      <button
                        onClick={() => startCreate(h1.id)}
                        className="text-sm text-primary-600 hover:text-primary-500 transition-colors"
                      >
                        + Add sub-hierarchy here
                      </button>
                    )}
                    {onAddRequirement && !hasSubHierarchies && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Expand the hierarchy if not already expanded
                          if (!expandedHierarchies.has(h1.id)) {
                            const newSet = new Set(expandedHierarchies);
                            newSet.add(h1.id);
                            onExpandedHierarchiesChange(newSet);
                            onHierarchySelect(h1.id);
                          }
                          onAddRequirement(h1.id);
                        }}
                        className="text-sm text-primary-600 hover:text-primary-500 transition-colors"
                      >
                        + Add requirement here
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            )}
            </SortableHierarchyItem>
          );
        })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add top-level hierarchy link */}
      {creatingParentId !== "ROOT" && editingId === null && !disableDragAndDrop && (
        <div className="mt-2">
          <button
            onClick={() => startCreate(null)}
            className="text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            + Add top-level hierarchy here
          </button>
        </div>
      )}

      {/* Create Level 1 Hierarchy form */}
      {creatingParentId === "ROOT" && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 space-y-3">
          <input
            ref={(el) => {
              titleInputRefs.current["ROOT"] = el;
            }}
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            onKeyDown={(e) => {
              // Handle Ctrl-A/Command-A to select all text
              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                e.preventDefault();
                e.currentTarget.select();
                return;
              }
            }}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleCreate(null)}
              disabled={loading}
              className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
            >
              Create
            </button>
            <button
              onClick={cancelCreate}
              disabled={loading}
              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

