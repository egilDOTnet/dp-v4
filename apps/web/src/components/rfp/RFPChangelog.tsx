"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api, RFP, RFPChangelogEntry } from "@/lib/api";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";

interface RFPChangelogProps {
  projectId: string;
  rfp: RFP;
}

export default function RFPChangelog({ projectId, rfp }: RFPChangelogProps) {
  const [entries, setEntries] = useState<RFPChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const descriptionTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");

  useEffect(() => {
    if (!projectId) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `changelog-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    api.rfp.changelog
      .list(projectId)
      .then((data) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setEntries(data);
        }
      })
      .catch((err: any) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          console.error("Error loading changelog:", err);
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

  // Initialize form data for all entries when they change
  useEffect(() => {
    entries.forEach((entry) => {
      if (entry && entry.id && !formData[entry.id]) {
        setFormData((prev) => ({
          ...prev,
          [entry.id]: entry.description || "",
        }));
      }
    });
  }, [entries]);

  const loadChangelog = async () => {
    // Create a unique key for this load
    const loadKey = `changelog-${projectId}`;
    
    // Prevent duplicate calls
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    try {
      const data = await api.rfp.changelog.list(projectId);
      // Only update if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setEntries(data);
      }
    } catch (err: any) {
      // Only log error if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        console.error("Error loading changelog:", err);
      }
    } finally {
      // Only update loading state if this is still the current load
      if (lastLoadKeyRef.current === loadKey) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  const handleFieldSave = useCallback(async (entryId: string, value: string) => {
    if (savingFields.has(entryId)) return;
    
    setSavingFields((prev) => new Set(prev).add(entryId));
    
    try {
      await api.rfp.changelog.update(projectId, entryId, {
        description: value,
      });
      
      // Reload changelog to get fresh data
      const data = await api.rfp.changelog.list(projectId);
      setEntries(data);

      // Clear editing state
      setEditingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    } catch (err: any) {
      console.error("Error saving changelog entry:", err);
    } finally {
      setSavingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  }, [projectId, savingFields]);

  // Handle clicks outside of editing entries to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any entry container
      let clickedInsideEntry = false;
      Object.values(entryRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideEntry = true;
        }
      });

      if (!clickedInsideEntry) {
        // Save any pending changes before exiting edit mode
        editingFields.forEach((entryId) => {
          const data = formData[entryId];
          const entry = entries.find((e) => e.id === entryId);
          
          if (data && entry && data.trim() !== (entry.description || "").trim()) {
            handleFieldSave(entryId, data);
          } else {
            // No changes, just exit edit mode
            setEditingFields((prev) => {
              const newSet = new Set(prev);
              newSet.delete(entryId);
              return newSet;
            });
          }
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingFields, formData, entries, handleFieldSave]);

  const handleStartEdit = (entry: RFPChangelogEntry) => {
    setEditingFields((prev) => new Set(prev).add(entry.id));
    
    // Focus the textarea after it appears
    requestAnimationFrame(() => {
      setTimeout(() => {
        const textarea = descriptionTextareaRefs.current[entry.id];
        if (textarea) {
          textarea.focus();
          textarea.select();
        }
      }, 0);
    });
  };

  const handleFieldBlur = (entryId: string, _e: React.FocusEvent) => {
    const entry = entries.find((e) => e.id === entryId);
    const data = formData[entryId];
    
    if (entry && data) {
      if (data.trim() !== (entry.description || "").trim()) {
        handleFieldSave(entryId, data);
      } else {
        // No changes, just exit edit mode
        setEditingFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete(entryId);
          return newSet;
        });
      }
    }
  };

  const handleDelete = async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    if (!confirm(`Are you sure you want to delete this changelog entry?`)) {
      return;
    }

    try {
      setDeletingId(entryId);
      await api.rfp.changelog.delete(projectId, entryId);
      await loadChangelog();
      
      // Clear editing state if this entry was being edited
      setEditingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    } catch (err: any) {
      console.error("Error deleting changelog entry:", err);
    } finally {
      setDeletingId(null);
    }
  };


  const getUserName = (entry: RFPChangelogEntry) => {
    if (entry.createdBy) {
      if (entry.createdBy.firstName || entry.createdBy.lastName) {
        return `${entry.createdBy.firstName || ""} ${entry.createdBy.lastName || ""}`.trim();
      }
      return entry.createdBy.name || entry.createdBy.email || "Unknown";
    }
    return "Unknown";
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading changelog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rfp?.status === "Draft" && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> When the RFP is published, all existing changelog entries will be deleted so vendors only see changes made after publishing.
          </p>
        </div>
      )}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Changelog</h2>
        </CardHeader>
        <CardBody>
          {entries.length === 0 ? (
            <EmptyState
              title="No changelog entries yet"
              description="The changelog automatically updates when entries are changed or new ones are made to inform vendors about changes in the RFP."
            />
          ) : (
            <div className="space-y-4">
              {entries.map((entry, index) => {
                const isEditing = editingFields.has(entry.id);
                const entryFormData = formData[entry.id] || entry.description || "";
                const reverseNumber = entries.length - index;

                return (
                  <div
                    key={entry.id}
                    className="border-2 border-primary-500 rounded-lg bg-background-secondary flex items-stretch overflow-hidden"
                    ref={(el) => {
                      entryRefs.current[entry.id] = el;
                    }}
                    data-entry-id={entry.id}
                  >
                    {/* Left side: Green background with number */}
                    <div className="bg-primary-500 text-white flex items-start justify-center min-w-[5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
                      <div className="text-xl font-semibold text-center">
                        {reverseNumber}
                      </div>
                    </div>

                    {/* Right side: Content */}
                    <div className="flex-1 px-4 py-3 bg-background-tertiary">
                      <div className="space-y-3">
                        {/* Date */}
                        <div className="font-bold text-text-primary">
                          {formatISODateTime(entry.createdAt)}
                        </div>

                        {/* Description */}
                        {isEditing ? (
                          <textarea
                            ref={(el) => {
                              descriptionTextareaRefs.current[entry.id] = el;
                            }}
                            value={entryFormData}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                [entry.id]: e.target.value,
                              });
                            }}
                            onBlur={(e) => handleFieldBlur(entry.id, e)}
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
                            rows={4}
                            className="w-full px-2 py-1 text-sm border border-border-primary rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(entry);
                            }}
                            className="text-text-primary whitespace-pre-wrap cursor-text hover:bg-background-secondary px-2 py-1 rounded -mx-2 -my-1"
                          >
                            {entry.description}
                          </div>
                        )}

                        {/* User info (hidden during edit mode) */}
                        {!isEditing && (
                          <div className="text-sm text-text-secondary mt-2">
                            by {getUserName(entry)}
                          </div>
                        )}

                        {/* Delete button (only during edit mode) */}
                        {isEditing && (
                          <div className="flex items-end justify-end">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id || savingFields.has(entry.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

