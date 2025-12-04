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
  createTrigger?: number;
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

export default function RequirementHierarchyComponent({
  projectId,
  hierarchies,
  requirements,
  selectedHierarchyId,
  onHierarchySelect,
  onHierarchyUpdate,
  onRequirementUpdate,
  onAddRequirement,
  createTrigger,
}: RequirementHierarchyProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const titleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      await api.requirements.hierarchies.update(projectId, id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
      });
      setEditingId(null);
      setFormData({ title: "", description: "" });
      onHierarchyUpdate();
    } catch (err: any) {
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
      setActiveDragId(null);
      return;
    }

    const hierarchiesToReorder = parentId === null ? level1Hierarchies : level2Hierarchies.filter((h) => h.parentId === parentId);
    const oldIndex = hierarchiesToReorder.findIndex((h) => h.id === active.id);
    const newIndex = hierarchiesToReorder.findIndex((h) => h.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveDragId(null);
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
      onHierarchyUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reorder hierarchies");
    } finally {
      setLoading(false);
      setActiveDragId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Requirement Hierarchy</h2>
        {creatingParentId !== "ROOT" && editingId === null && (
          <button
            onClick={() => startCreate(null)}
            className="w-6 h-6 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
            title="Add Level 1 Hierarchy"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
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
        onDragStart={(event) => setActiveDragId(event.active.id as string)}
        onDragEnd={(event) => handleDragEnd(event, null)}
      >
        <SortableContext
          items={level1Hierarchies.map((h) => h.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {level1Hierarchies.map((h1) => {
          const children = level2Hierarchies.filter((h2) => h2.parentId === h1.id);
          const isEditing = editingId === h1.id;
          const isCreatingChild = creatingParentId === h1.id;

          return (
            <SortableHierarchyItem key={h1.id} hierarchy={h1}>
            {({ attributes, listeners }) => (
            <div className="p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    ref={(el) => {
                      titleInputRefs.current[h1.id] = el;
                    }}
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        cancelEdit();
                      } else if (e.key === "Enter" && e.ctrlKey) {
                        handleUpdate(h1.id);
                      }
                    }}
                    placeholder="Title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2 justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(h1.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={loading}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(h1.id)}
                      disabled={loading}
                      className="px-3 py-1 text-red-600 hover:text-red-800 disabled:opacity-50 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between group">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onHierarchySelect(h1.id)}
                  >
                    <div className="flex items-start gap-2">
                      {/* Drag handle */}
                      <div
                        {...attributes}
                        {...listeners}
                        className="flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:opacity-100 pt-0.5"
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
                      <span className={`font-medium ${
                        selectedHierarchyId === h1.id
                          ? "text-primary-600"
                          : "text-gray-900"
                      }`}>
                        {h1.number.endsWith('.') ? h1.number : `${h1.number}.`}
                      </span>
                      <span
                        className={`font-medium hover:text-primary-600 ${
                          selectedHierarchyId === h1.id
                            ? "text-primary-700"
                            : "text-gray-900"
                        }`}
                      >
                        {h1.title}
                      </span>
                      {h1._count && h1._count.requirements > 0 && (
                        <span className="text-sm text-gray-500">
                          ({h1._count.requirements} requirement
                          {h1._count.requirements !== 1 ? "s" : ""})
                        </span>
                      )}
                      {h1.description && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDescription(h1.id);
                          }}
                          className="flex-shrink-0 text-gray-500 hover:text-gray-700 ml-1"
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
                    </div>
                    {h1.description && expandedDescriptions.has(h1.id) && (
                      <p className="text-sm text-gray-600 mt-1">{h1.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '120px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(h1);
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors"
                    >
                      Edit
                    </button>
                    {onAddRequirement && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddRequirement(h1.id);
                        }}
                        className="w-6 h-6 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
                        title="New requirement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Level 2 Hierarchies */}
              {children.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(event) => setActiveDragId(event.active.id as string)}
                  onDragEnd={(event) => handleDragEnd(event, h1.id)}
                >
                  <SortableContext
                    items={children.map((h) => h.id)}
                    strategy={verticalListSortingStrategy}
                  >
                <div className="mt-3 space-y-2">
                  {children.map((h2) => {
                    const isEditing2 = editingId === h2.id;

                    return (
                      <SortableHierarchyItem key={h2.id} hierarchy={h2}>
                      {({ attributes, listeners }) => (
                      <div className="p-4">
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
                                  className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
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
                          <div className="flex items-start justify-between group">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => onHierarchySelect(h2.id)}
                            >
                              <div className="flex items-start gap-2">
                                {/* Drag handle */}
                                <div
                                  {...attributes}
                                  {...listeners}
                                  className="flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:opacity-100 pt-0.5"
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
                                <span className={`font-medium ${
                                  selectedHierarchyId === h2.id
                                    ? "text-primary-600"
                                    : "text-gray-900"
                                }`}>
                                  {h2.number.endsWith('.') ? h2.number : `${h2.number}.`}
                                </span>
                                <span
                                  className={`font-medium hover:text-primary-600 ${
                                    selectedHierarchyId === h2.id
                                      ? "text-primary-700"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {h2.title}
                                </span>
                                {h2._count && h2._count.requirements > 0 && (
                                  <span className="text-sm text-gray-500">
                                    ({h2._count.requirements} requirement
                                    {h2._count.requirements !== 1 ? "s" : ""})
                                  </span>
                                )}
                                {h2.description && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDescription(h2.id);
                                    }}
                                    className="flex-shrink-0 text-gray-500 hover:text-gray-700 ml-1"
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
                              </div>
                              {h2.description && expandedDescriptions.has(h2.id) && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {h2.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '120px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(h2);
                                }}
                                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors"
                              >
                                Edit
                              </button>
                              {onAddRequirement && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddRequirement(h2.id);
                                  }}
                                  className="w-6 h-6 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
                                  title="New requirement"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Requirements inline for Level 2 */}
                        {selectedHierarchyId === h2.id && (
                          <div className="mt-4">
                            <RequirementList
                              projectId={projectId}
                              hierarchyId={h2.id}
                              requirements={requirements.filter((r) => r.hierarchyId === h2.id)}
                              onRequirementUpdate={onRequirementUpdate}
                              createTrigger={createTrigger}
                              selectedHierarchyId={selectedHierarchyId}
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
              )}

              {/* Create Level 2 Hierarchy */}
              {isCreatingChild && (
                <div className="mt-3">
                  <div className="border border-gray-200 rounded p-3 bg-gray-50 space-y-3">
                    <input
                      ref={(el) => {
                        titleInputRefs.current[`create-${h1.id}`] = el;
                      }}
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                        onClick={() => handleCreate(h1.id)}
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
                </div>
              )}

              {/* Add Level 2 Hierarchy Link */}
              {!isCreatingChild && (
                <div className="mt-2">
                  <button
                    onClick={() => startCreate(h1.id)}
                    className="text-sm text-primary-600 hover:text-primary-700 block"
                  >
                    + Add sub-hierarchy
                  </button>
                </div>
              )}

              {/* Requirements inline for Level 1 */}
              {selectedHierarchyId === h1.id && (
                <div className="mt-4">
                  <RequirementList
                    projectId={projectId}
                    hierarchyId={h1.id}
                    requirements={requirements.filter((r) => r.hierarchyId === h1.id)}
                    onRequirementUpdate={onRequirementUpdate}
                    createTrigger={createTrigger}
                    selectedHierarchyId={selectedHierarchyId}
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

      {/* Create Level 1 Hierarchy button is now in header */}
      {creatingParentId === "ROOT" && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 space-y-3">
          <input
            ref={(el) => {
              titleInputRefs.current["ROOT"] = el;
            }}
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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

