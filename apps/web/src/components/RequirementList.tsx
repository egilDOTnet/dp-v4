"use client";

import { useState, useRef, useEffect } from "react";
import { Requirement, api } from "@/lib/api";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
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
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-5 top-1/2 -translate-y-1/2 w-2.5 flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:opacity-100"
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

export default function RequirementList({
  projectId,
  hierarchyId,
  requirements,
  onRequirementUpdate,
}: RequirementListProps) {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newRequirement, setNewRequirement] = useState({
    description: "",
    type: "Information" as Requirement["type"],
    status: "New" as Requirement["status"],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    description: string;
    type: Requirement["type"];
    status: Requirement["status"];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, any[]>>({});

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

  const handleCreate = async () => {
    if (!newRequirement.description.trim()) {
      setError("Description is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.requirements.create(projectId, {
        hierarchyId,
        description: newRequirement.description.trim(),
        type: newRequirement.type,
        status: newRequirement.status,
      });
      setNewRequirement({
        description: "",
        type: "Information",
        status: "New",
      });
      setIsCreatingNew(false);
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to create requirement");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingData || !editingData.description.trim()) {
      setError("Description is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.requirements.update(projectId, id, {
        description: editingData.description.trim(),
        type: editingData.type,
        status: editingData.status,
      });
      setEditingId(null);
      setEditingData(null);
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to update requirement");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this requirement?")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.requirements.delete(projectId, id);
      onRequirementUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to delete requirement");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (requirement: Requirement) => {
    setEditingId(requirement.id);
    setEditingData({
      description: requirement.description,
      type: requirement.type,
      status: requirement.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
    setError("");
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
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "ForReview":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Requirements ({sortedRequirements.length})
        </h3>
        {!isCreatingNew && (
          <button
            onClick={() => setIsCreatingNew(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            + Add Requirement
          </button>
        )}
      </div>

      {isCreatingNew && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <textarea
            value={newRequirement.description}
            onChange={(e) =>
              setNewRequirement({ ...newRequirement, description: e.target.value })
            }
            placeholder="Requirement description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newRequirement.type}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    type: e.target.value as Requirement["type"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Information">Information</option>
                <option value="Mandatory">Mandatory</option>
                <option value="Important">Important</option>
                <option value="Wish">Wish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={newRequirement.status}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    status: e.target.value as Requirement["status"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="New">New</option>
                <option value="ForReview">For Review</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNew(false);
                setNewRequirement({
                  description: "",
                  type: "Information",
                  status: "New",
                });
                setError("");
              }}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
            {sortedRequirements.map((requirement) => {
              const isEditing = editingId === requirement.id;
              const isShowingHistory = showHistoryId === requirement.id;

              return (
                <SortableRequirementItem
                  key={requirement.id}
                  requirement={requirement}
                >
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingData?.description || ""}
                          onChange={(e) =>
                            setEditingData({
                              ...editingData!,
                              description: e.target.value,
                            })
                          }
                          placeholder="Requirement description"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type
                            </label>
                            <select
                              value={editingData?.type || "Information"}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData!,
                                  type: e.target.value as Requirement["type"],
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="Information">Information</option>
                              <option value="Mandatory">Mandatory</option>
                              <option value="Important">Important</option>
                              <option value="Wish">Wish</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Status
                            </label>
                            <select
                              value={editingData?.status || "New"}
                              onChange={(e) =>
                                setEditingData({
                                  ...editingData!,
                                  status: e.target.value as Requirement["status"],
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="New">New</option>
                              <option value="ForReview">For Review</option>
                              <option value="Approved">Approved</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(requirement.id)}
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
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-primary-600">
                                {requirement.number}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(
                                  requirement.type
                                )}`}
                              >
                                {requirement.type}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                  requirement.status
                                )}`}
                              >
                                {requirement.status}
                              </span>
                            </div>
                            <p className="text-gray-900">{requirement.description}</p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => startEdit(requirement)}
                              className="text-sm text-gray-600 hover:text-gray-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(requirement.id)}
                              disabled={loading}
                              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
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
                            onClick={() => loadHistory(requirement.id)}
                            className="text-primary-600 hover:text-primary-700 underline"
                          >
                            {isShowingHistory ? "Hide" : "Show"} History
                          </button>
                        </div>
                        {isShowingHistory && history[requirement.id] && (
                          <div className="mt-4 border-t border-gray-200 pt-4">
                            <h4 className="font-medium mb-2">History</h4>
                            <div className="space-y-2">
                              {history[requirement.id].map((entry) => (
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
                                  <p className="text-gray-700">{entry.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SortableRequirementItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {sortedRequirements.length === 0 && !isCreatingNew && (
        <div className="text-center py-8 text-gray-500">
          <p>No requirements yet. Click "Add Requirement" to create one.</p>
        </div>
      )}
    </div>
  );
}



