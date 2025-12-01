"use client";

import { useState } from "react";
import { api, RequirementHierarchy as RequirementHierarchyType } from "@/lib/api";

interface RequirementHierarchyProps {
  projectId: string;
  hierarchies: RequirementHierarchyType[];
  selectedHierarchyId: string | null;
  onHierarchySelect: (id: string | null) => void;
  onHierarchyUpdate: () => void;
}

export default function RequirementHierarchyComponent({
  projectId,
  hierarchies,
  selectedHierarchyId,
  onHierarchySelect,
  onHierarchyUpdate,
}: RequirementHierarchyProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const level1Hierarchies = hierarchies.filter((h) => h.parentId === null);
  const level2Hierarchies = hierarchies.filter((h) => h.parentId !== null);

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

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Level 1 Hierarchies */}
      <div className="space-y-2">
        {level1Hierarchies.map((h1) => {
          const children = level2Hierarchies.filter((h2) => h2.parentId === h1.id);
          const isEditing = editingId === h1.id;
          const isCreatingChild = creatingParentId === h1.id;

          return (
            <div key={h1.id} className="border border-gray-200 rounded-lg p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onHierarchySelect(h1.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary-600">
                        {h1.number}.
                      </span>
                      <span
                        className={`font-medium ${
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
                    </div>
                    {h1.description && (
                      <p className="text-sm text-gray-600 mt-1 ml-6">{h1.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(h1)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(h1.id)}
                      disabled={loading}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Level 2 Hierarchies */}
              {children.length > 0 && (
                <div className="mt-3 ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                  {children.map((h2) => {
                    const isEditing2 = editingId === h2.id;

                    return (
                      <div key={h2.id} className="border border-gray-200 rounded p-3 bg-gray-50">
                        {isEditing2 ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={formData.title}
                              onChange={(e) =>
                                setFormData({ ...formData, title: e.target.value })
                              }
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
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => onHierarchySelect(h2.id)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary-600">
                                  {h2.number}.
                                </span>
                                <span
                                  className={`font-medium ${
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
                              </div>
                              {h2.description && (
                                <p className="text-sm text-gray-600 mt-1 ml-6">
                                  {h2.description}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(h2)}
                                className="text-sm text-gray-600 hover:text-gray-800"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(h2.id)}
                                disabled={loading}
                                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Level 2 Hierarchy */}
              {isCreatingChild && (
                <div className="mt-3 ml-6 border-l-2 border-gray-200 pl-4">
                  <div className="border border-gray-200 rounded p-3 bg-gray-50 space-y-3">
                    <input
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

              {/* Add Level 2 Hierarchy Button */}
              {!isCreatingChild && (
                <div className="mt-2 ml-6">
                  <button
                    onClick={() => startCreate(h1.id)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Add sub-hierarchy
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Level 1 Hierarchy */}
      {creatingParentId !== "ROOT" && editingId === null && (
        <button
          onClick={() => startCreate(null)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          + Add Level 1 Hierarchy
        </button>
      )}
      {creatingParentId === "ROOT" && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 space-y-3">
          <input
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

