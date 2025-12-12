"use client";

import { useEffect, useState, useRef } from "react";
import { api, RFP, RFPDocument } from "@/lib/api";
import { Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
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

interface RFPDocumentsProps {
  projectId: string;
  rfp: RFP;
}

function SortableDocumentItem({
  document,
  children,
}: {
  document: RFPDocument;
  children: (props: { attributes: any; listeners: any }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id });

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

export default function RFPDocuments({ projectId, rfp }: RFPDocumentsProps) {
  const [documents, setDocuments] = useState<RFPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, { description: string; url: string; type: "Document" | "Link" }>>({});
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isNewDocAnimating, setIsNewDocAnimating] = useState(false);
  const [newDocType, setNewDocType] = useState<"Document" | "Link">("Link");
  const [newDocData, setNewDocData] = useState({
    description: "",
    url: "",
    file: null as File | null,
  });
  const [saving, setSaving] = useState(false);
  const [removedFiles, setRemovedFiles] = useState<Set<string>>(new Set());
  const newDocInputRef = useRef<HTMLInputElement | null>(null);
  const newDocUrlInputRef = useRef<HTMLInputElement | null>(null);
  const newDocFormRef = useRef<HTMLDivElement | null>(null);
  const newDocFileInputRef = useRef<HTMLInputElement | null>(null);
  const docRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const descriptionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  // Initialize form data for all documents when they change
  useEffect(() => {
    documents.forEach((doc) => {
      if (doc && doc.id && !formData[doc.id]) {
        setFormData((prev) => ({
          ...prev,
          [doc.id]: {
            description: doc.description || "",
            url: doc.url || "",
            type: doc.type,
          },
        }));
      }
    });
  }, [documents]);

  // Handle animation for new document form
  useEffect(() => {
    if (isCreatingNew && !isNewDocAnimating) {
      setNewDocData({ description: "", url: "", file: null });
      setNewDocType("Link");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsNewDocAnimating(true);
          setTimeout(() => {
            newDocInputRef.current?.focus();
          }, 50);
        });
      });
    }
  }, [isCreatingNew, isNewDocAnimating]);

  // Handle clicks outside of editing documents to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any document container
      let clickedInsideDoc = false;
      Object.values(docRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideDoc = true;
        }
      });

      // Also check if clicking on the create form
      if (isCreatingNew && newDocFormRef.current && newDocFormRef.current.contains(target)) {
        clickedInsideDoc = true;
      }

      if (!clickedInsideDoc) {
        // If creating new, handle blur logic
        if (isCreatingNew) {
          handleNewDocBlur();
        }

        // Save any pending changes before exiting edit mode
        Object.entries(editingFields).forEach(([docId, fields]) => {
          const data = formData[docId];
          const doc = documents.find((d) => d.id === docId);
          
          if (data && doc) {
            fields.forEach((field) => {
              if (field === "description" && data.description.trim() !== (doc.description || "").trim()) {
                handleFieldSave(docId, field, data.description);
              } else if (field === "url" && doc.type === "Link" && data.url.trim() !== (doc.url || "").trim()) {
                handleFieldSave(docId, field, data.url);
              }
            });
          }
        });

        // Exit all edit modes
        setEditingFields({});
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCreatingNew, editingFields, formData, documents]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await api.rfp.documents.list(projectId);
      setDocuments(data);
    } catch (err: any) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = documents.findIndex((d) => d.id === active.id);
    const newIndex = documents.findIndex((d) => d.id === over.id);
    const newOrder = arrayMove(documents, oldIndex, newIndex);

    setDocuments(newOrder);

    try {
      await api.rfp.documents.reorder(projectId, {
        documentIds: newOrder.map((d) => d.id),
      });
    } catch (err: any) {
      console.error("Error reordering documents:", err);
      await loadDocuments(); // Revert on error
    }
  };

  const handleStartEdit = (doc: RFPDocument, field?: string) => {
    // Put editable fields in edit mode
    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[doc.id]) {
        newFields[doc.id] = new Set();
      }
      // If a specific field is provided, only edit that field
      // Otherwise, edit all fields (for backwards compatibility)
      if (field) {
        newFields[doc.id].add(field);
      } else {
        newFields[doc.id].add("description");
        if (doc.type === "Link") {
          newFields[doc.id].add("url");
        }
      }
      return newFields;
    });
    
    // Clear removed files state when starting to edit
    setRemovedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.delete(doc.id);
      return newSet;
    });
  };

  const handleFieldBlur = (docId: string, field: string, e: React.FocusEvent) => {
    const doc = documents.find((d) => d.id === docId);
    const data = formData[docId];
    
    if (doc && data) {
      if (field === "description" && data.description.trim() !== (doc.description || "").trim()) {
        handleFieldSave(docId, field, data.description);
      } else if (field === "url" && doc.type === "Link" && data.url.trim() !== (doc.url || "").trim()) {
        handleFieldSave(docId, field, data.url);
      } else {
        // No changes, just exit edit mode for this field
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[docId]) {
            newFields[docId].delete(field);
            if (newFields[docId].size === 0) {
              delete newFields[docId];
              // Clear removed files state when exiting edit mode
              setRemovedFiles((prev) => {
                const newSet = new Set(prev);
                newSet.delete(docId);
                return newSet;
              });
            }
          }
          return newFields;
        });
      }
    }
  };

  const handleFieldSave = async (docId: string, field: string, value: string) => {
    if (savingFields.has(docId)) return;
    
    setSavingFields((prev) => new Set(prev).add(docId));
    
    try {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;

      const updatePayload: { description?: string; url?: string } = {};
      if (field === "description") {
        updatePayload.description = value;
      } else if (field === "url" && doc.type === "Link") {
        updatePayload.url = value;
      }

      await api.rfp.documents.update(projectId, docId, updatePayload);
      await loadDocuments();

      // Clear editing state for this field
      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[docId]) {
          newFields[docId].delete(field);
          if (newFields[docId].size === 0) {
            delete newFields[docId];
          }
        }
        return newFields;
      });
    } catch (err: any) {
      console.error("Error saving document:", err);
    } finally {
      setSavingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(docId);
        return newSet;
      });
    }
  };

  const handleDelete = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    if (!confirm(`Are you sure you want to delete "${doc.description}"?`)) {
      return;
    }

    try {
      await api.rfp.documents.delete(projectId, docId);
      await loadDocuments();
    } catch (err: any) {
      console.error("Error deleting document:", err);
    }
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setNewDocData({ description: "", url: "", file: null });
    setNewDocType("Link");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsNewDocAnimating(true);
        setTimeout(() => {
          newDocInputRef.current?.focus();
        }, 50);
      });
    });
  };

  const handleCancelNew = () => {
    setIsNewDocAnimating(false);
    setTimeout(() => {
      setIsCreatingNew(false);
      setNewDocData({ description: "", url: "", file: null });
      setNewDocType("Link");
    }, 300);
  };

  const handleCreateNew = async () => {
    // Validate before creating
    if (newDocType === "Link" && !newDocData.url.trim()) {
      // If URL is required but not provided, cancel instead of showing alert
      handleCancelNew();
      return;
    }
    if (newDocType === "Document" && !newDocData.file) {
      // If file is required but not provided, cancel instead of showing alert
      handleCancelNew();
      return;
    }

    try {
      setSaving(true);
      if (newDocType === "Link") {
        await api.rfp.documents.create(projectId, {
          type: "Link",
          description: newDocData.description.trim() || "Link",
          url: newDocData.url.trim(),
        });
        setIsNewDocAnimating(false);
        setTimeout(async () => {
          setIsCreatingNew(false);
          setNewDocData({ description: "", url: "", file: null });
          await loadDocuments();
        }, 300);
      } else {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          await api.rfp.documents.create(projectId, {
            type: "Document",
            description: newDocData.description.trim() || newDocData.file!.name,
            fileName: newDocData.file!.name,
            fileType: newDocData.file!.type,
            fileData: base64,
            fileSize: newDocData.file!.size,
          });
          setIsNewDocAnimating(false);
          setTimeout(async () => {
            setIsCreatingNew(false);
            setNewDocData({ description: "", url: "", file: null });
            await loadDocuments();
          }, 300);
        };
        reader.readAsDataURL(newDocData.file);
        return;
      }
    } catch (err: any) {
      console.error("Error adding document:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNewDocBlur = () => {
    // Small delay to allow for potential click events on other elements
    setTimeout(() => {
      // Check if focus moved to another element within the form
      const activeElement = document.activeElement;
      if (newDocFormRef.current && activeElement && newDocFormRef.current.contains(activeElement)) {
        // Focus is still within the form, don't cancel
        return;
      }

      const hasContent = newDocData.description.trim() || 
        (newDocType === "Link" && newDocData.url.trim()) ||
        (newDocType === "Document" && newDocData.file !== null);
      
      if (hasContent) {
        handleCreateNew();
      } else {
        handleCancelNew();
      }
    }, 150);
  };

  const handleNewDocKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const hasContent = newDocData.description.trim() || 
        (newDocType === "Link" && newDocData.url.trim()) ||
        (newDocType === "Document" && newDocData.file !== null);
      
      if (hasContent) {
        handleCreateNew();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelNew();
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stripFileExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) return filename;
    return filename.substring(0, lastDotIndex);
  };

  const handleFileDownload = (doc: RFPDocument) => {
    if (!doc.fileData || !doc.fileName || !doc.fileType) return;
    
    // Create data URL from base64
    const dataUrl = `data:${doc.fileType};base64,${doc.fileData}`;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render document form (used for both new and edit)
  const renderDocumentForm = (
    doc: RFPDocument | null,
    isNew: boolean,
    docFormData: { description: string; url: string; type: "Document" | "Link" },
    isEditing: boolean,
    attributes?: any,
    listeners?: any
  ) => {
    const isEditingDescription = isEditing && (editingFields[doc?.id || ""]?.has("description") || isNew);
    const isEditingUrl = isEditing && docFormData.type === "Link" && (editingFields[doc?.id || ""]?.has("url") || isNew);
    const canEditType = isNew;

    return (
      <div
        className={`
          border-2 border-primary-500 rounded-lg bg-background-secondary flex items-stretch overflow-hidden transition-all duration-300 ease-out
          ${isNew 
            ? (isNewDocAnimating ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4")
            : ""
          }
        `}
        ref={doc ? (el) => { docRefs.current[doc.id] = el; } : (el) => { newDocFormRef.current = el; }}
        data-document-id={doc?.id}
      >
        {/* Left side: Drag handle or plus icon */}
        {isNew ? (
          <div className="bg-primary-500 text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        ) : (
          <div
            {...attributes}
            {...listeners}
            className="bg-primary-500 text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
            title="Drag to reorder"
          >
            {/* White grip dots (2x4 pattern) */}
            <div className="flex flex-col items-center justify-center gap-0.5">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
              </div>
              <div className="flex gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
              </div>
              <div className="flex gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
              </div>
              <div className="flex gap-0.5">
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
                <div className="w-0.5 h-0.5 bg-white rounded-full opacity-80"></div>
              </div>
            </div>
          </div>
        )}

        {/* Right side: Document content */}
        <div className="flex-1 px-4 py-3 bg-background-tertiary">
          <div className="space-y-3">
            {/* Description with Type toggle (for new items) */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isEditingDescription ? (
                  <input
                    ref={(el) => {
                      if (isNew) {
                        newDocInputRef.current = el;
                      } else if (doc) {
                        descriptionInputRefs.current[doc.id] = el;
                      }
                    }}
                    type="text"
                    value={docFormData.description}
                    onChange={(e) => {
                      if (isNew) {
                        setNewDocData({ ...newDocData, description: e.target.value });
                      } else if (doc) {
                        setFormData({
                          ...formData,
                          [doc.id]: {
                            ...docFormData,
                            description: e.target.value,
                          },
                        });
                      }
                    }}
                    onBlur={isNew ? handleNewDocBlur : (e) => handleFieldBlur(doc!.id, "description", e)}
                    onKeyDown={isNew ? handleNewDocKeyDown : (e) => {
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm font-semibold border border-border-primary rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter description"
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isNew && doc) {
                        // Blur any other inputs first
                        if (isEditingUrl) {
                          const urlInput = docRefs.current[doc.id]?.querySelector('input[type="url"]') as HTMLInputElement;
                          urlInput?.blur();
                        }
                        if (!isEditingDescription) {
                          handleStartEdit(doc, "description");
                        }
                        // Focus the description input after it appears
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            const input = descriptionInputRefs.current[doc.id];
                            if (input) {
                              input.focus();
                              input.select();
                            }
                          }, 0);
                        });
                      }
                    }}
                    className="flex-1 text-sm font-semibold text-text-primary cursor-text hover:bg-background-secondary px-2 py-1 rounded -mx-2 -my-1"
                  >
                    {docFormData.description || (isNew ? "Enter description" : "")}
                  </div>
                )}
                
                {/* Type rocker toggle (only for new items) */}
                {canEditType && (
                  <div className="flex border border-gray-300 rounded-md overflow-hidden flex-shrink-0">
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        // Prevent blur on the input when clicking toggle
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setNewDocType("Link");
                        // Clear file when switching to Link
                        if (newDocData.file) {
                          setNewDocData({ ...newDocData, file: null });
                        }
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        docFormData.type === "Link"
                          ? "bg-primary-600 text-white"
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                      }`}
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        // Prevent blur on the input when clicking toggle
                        e.preventDefault();
                      }}
                      onClick={() => {
                        setNewDocType("Document");
                        // Clear URL when switching to Document
                        if (newDocData.url) {
                          setNewDocData({ ...newDocData, url: "" });
                        }
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        docFormData.type === "Document"
                          ? "bg-primary-600 text-white"
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                      }`}
                    >
                      File
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* URL or File info */}
            {docFormData.type === "Link" ? (
              <div>
                {isEditingUrl ? (
                  <input
                    ref={isNew ? newDocUrlInputRef : undefined}
                    type="url"
                    value={docFormData.url}
                    onChange={(e) => {
                      if (isNew) {
                        setNewDocData({ ...newDocData, url: e.target.value });
                      } else if (doc) {
                        setFormData({
                          ...formData,
                          [doc.id]: {
                            ...docFormData,
                            url: e.target.value,
                          },
                        });
                      }
                    }}
                    onBlur={isNew ? handleNewDocBlur : (e) => handleFieldBlur(doc!.id, "url", e)}
                    onKeyDown={isNew ? handleNewDocKeyDown : (e) => {
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border border-border-primary rounded-md bg-background-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                ) : (
                  <div className="text-sm text-text-secondary">
                    {isNew ? (
                      <span className="text-text-tertiary">URL will appear here</span>
                    ) : (
                      <a
                        href={docFormData.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline cursor-pointer"
                      >
                        {docFormData.url}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {isNew ? (
                  <div
                    className="relative border-2 border-dashed border-border-primary rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const droppedFile = e.dataTransfer.files[0];
                        if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".zip"))) {
                          setNewDocData({
                            ...newDocData,
                            file: droppedFile,
                            description: stripFileExtension(droppedFile.name) || newDocData.description,
                          });
                        }
                      }}
                      onMouseDown={(e) => {
                        // Prevent blur on the description input when clicking file container
                        e.preventDefault();
                      }}
                      onClick={() => {
                        newDocFileInputRef.current?.click();
                      }}
                    >
                      <input
                        ref={newDocFileInputRef}
                        type="file"
                        accept=".pdf,.zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setNewDocData({
                              ...newDocData,
                              file,
                              description: stripFileExtension(file.name) || newDocData.description,
                            });
                          }
                        }}
                        className="hidden"
                      />
                      {newDocData.file ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center">
                            <svg
                              className="h-8 w-8 text-primary-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="text-sm text-text-primary">
                            <span className="font-medium">{newDocData.file.name}</span>
                          </div>
                          <p className="text-xs text-text-secondary">
                            {formatFileSize(newDocData.file.size)}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewDocData({
                                ...newDocData,
                                file: null,
                              });
                            }}
                            className="text-xs text-text-tertiary hover:text-text-primary mt-2"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <svg
                            className="mx-auto h-12 w-12 text-text-tertiary"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="text-sm text-text-primary">
                            <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
                          </div>
                          <p className="text-xs text-text-secondary">
                            PDF or ZIP files only
                          </p>
                        </div>
                      )}
                    </div>
                ) : (
                  <div>
                    {isEditing && (removedFiles.has(doc?.id || "") || !doc?.fileData) ? (
                      <div
                        className="relative border-2 border-dashed border-border-primary rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const droppedFile = e.dataTransfer.files[0];
                          if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".zip"))) {
                            // TODO: File replacement requires API support for updating fileData
                            // For now, update description only
                            handleFieldSave(doc.id, "description", stripFileExtension(droppedFile.name));
                            console.warn("File replacement requires API support for updating fileData");
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => {
                          editFileInputRefs.current[doc.id]?.click();
                        }}
                      >
                        <input
                          ref={(el) => { editFileInputRefs.current[doc.id] = el; }}
                          type="file"
                          accept=".pdf,.zip"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file) {
                              // TODO: File replacement requires API support for updating fileData
                              // For now, update description only
                              handleFieldSave(doc.id, "description", stripFileExtension(file.name));
                              console.warn("File replacement requires API support for updating fileData");
                            }
                          }}
                          className="hidden"
                        />
                        <div className="space-y-2">
                          <svg
                            className="mx-auto h-12 w-12 text-text-tertiary"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="text-sm text-text-primary">
                            <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
                          </div>
                          <p className="text-xs text-text-secondary">
                            PDF or ZIP files only
                          </p>
                        </div>
                      </div>
                    ) : doc?.fileData ? (
                      <div className="text-sm text-text-secondary">
                        <div className="flex items-center gap-2">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleFileDownload(doc);
                            }}
                            className="text-primary-600 hover:underline cursor-pointer"
                          >
                            {doc.fileName} ({formatFileSize(doc.fileSize || null)})
                          </a>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemovedFiles((prev) => {
                                  const newSet = new Set(prev);
                                  newSet.add(doc.id);
                                  return newSet;
                                });
                              }}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary">
                        {doc?.fileName} ({formatFileSize(doc?.fileSize || null)})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delete button (only for editing existing items) */}
            {!isNew && isEditing && doc && (
              <div className="flex items-end justify-end">
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={savingFields.has(doc.id)}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 underline text-sm mb-1 flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-text-primary">Documents & Links</h2>
            {!isCreatingNew && (
              <Button onClick={handleStartNew} variant="primary">
                Add Document/Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {documents.length === 0 && !isCreatingNew ? (
            <EmptyState
              title="No documents or links yet"
              description="Add documents or links to share important information with vendors. You can upload PDF or ZIP files, or add links to external resources."
              action={{
                label: "Add Document/Link",
                onClick: handleStartNew,
              }}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={documents.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {/* New document form */}
                  {isCreatingNew && renderDocumentForm(
                    null,
                    true,
                    { description: newDocData.description, url: newDocData.url, type: newDocType },
                    true
                  )}

                  {/* Existing documents */}
                  {documents.map((doc) => {
                    const isEditing = editingFields[doc.id]?.size > 0;
                    const docFormData = formData[doc.id] || {
                      description: doc.description || "",
                      url: doc.url || "",
                      type: doc.type,
                    };

                    return (
                      <SortableDocumentItem key={doc.id} document={doc}>
                        {({ attributes, listeners }) =>
                          renderDocumentForm(
                            doc,
                            false,
                            docFormData,
                            isEditing,
                            attributes,
                            listeners
                          )
                        }
                      </SortableDocumentItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
