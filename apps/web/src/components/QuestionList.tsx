"use client";

import React, { useState, useEffect } from "react";
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
import { api, RFIQuestion, RFIQuestionType } from "@/lib/api";
import QuestionOptionManager from "./QuestionOptionManager";
import ScaleConfigurator from "./ScaleConfigurator";

interface QuestionListProps {
  projectId: string;
  rfiId: string;
}

interface SortableQuestionItemProps {
  question: RFIQuestion;
  children: (props: { attributes: any; listeners: any; setNodeRef: any; style: any }) => React.ReactNode;
}

function SortableQuestionItem({
  question,
  children,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {children({ attributes, listeners, setNodeRef, style })}
    </div>
  );
}

export default function QuestionList({ projectId, rfiId }: QuestionListProps) {
  const [questions, setQuestions] = useState<RFIQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, { title: string; description: string; type: RFIQuestionType; required: boolean }>>({});
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const scrollPositionRef = React.useRef<number>(0);

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

  useEffect(() => {
    if (rfiId) {
      loadQuestions();
    } else {
      setLoading(false);
      setQuestions([]);
    }
  }, [rfiId, projectId]);

  // Handle clicks outside of editing questions to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check each question that's being edited
      Object.keys(editingFields).forEach((questionId) => {
        const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
        
        // If click is outside the question element, close edit mode
        if (questionElement && !questionElement.contains(target)) {
          const question = questions.find((q) => q.id === questionId);
          const data = formData[questionId];
          
          if (question && data) {
            // Check each field being edited and save if changed
            const fields = editingFields[questionId];
            fields.forEach((field) => {
              let hasChanged = false;
              
              if (field === "title" && data.title.trim() !== question.title.trim()) {
                hasChanged = true;
                handleFieldSave(questionId, field as "title", data.title);
              } else if (field === "description") {
                const currentDesc = (data.description || "").trim();
                const questionDesc = (question.description || "").trim();
                if (currentDesc !== questionDesc) {
                  hasChanged = true;
                  handleFieldSave(questionId, field as "description", data.description);
                }
              } else if (field === "type" && data.type !== question.type) {
                hasChanged = true;
                handleFieldSave(questionId, field as "type", data.type);
              } else if (field === "required" && data.required !== (question.required ?? true)) {
                hasChanged = true;
                handleFieldSave(questionId, field as "required", data.required);
              }
            });
          }
          
          // Clear editing state for this question
          setEditingFields((prev) => {
            const newFields = { ...prev };
            delete newFields[questionId];
            return newFields;
          });
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingFields, questions, formData]);

  // Initialize form data for all questions when they change
  useEffect(() => {
    questions.forEach((question) => {
      if (question && question.id && !formData[question.id]) {
        setFormData((prev) => ({
          ...prev,
          [question.id]: {
            title: question.title,
            description: question.description || "",
            type: question.type,
            required: question.required ?? true,
          },
        }));
      }
    });
  }, [questions]);

  const loadQuestions = async (preserveScroll = false) => {
    if (!rfiId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    
    // Save scroll position if requested
    if (preserveScroll) {
      scrollPositionRef.current = window.scrollY;
    }
    
    try {
      setLoading(true);
      setError("");
      const data = await api.rfi.questions.list(projectId);
      setQuestions(data);
      
      // Restore scroll position after state update
      if (preserveScroll) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPositionRef.current);
        });
      }
    } catch (err: any) {
      console.error("Error loading questions:", err);
      const errorMessage = err.message || err.error?.message || "Failed to load questions";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (
    data: {
      title: string;
      description?: string | null;
      type: RFIQuestionType;
      required?: boolean;
      scaleLabels?: Record<string, string> | null;
    },
    insertAfter?: number
  ) => {
    try {
      // Create the question (it will be added at the end)
      const newQuestion = await api.rfi.questions.create(projectId, data);
      
      // If we need to insert at a specific position, reorder
      if (insertAfter !== undefined && insertAfter !== null) {
        // Get current questions
        const currentQuestions = await api.rfi.questions.list(projectId);
        
        // Find the new question (it should be at the end)
        const newQuestionIndex = currentQuestions.findIndex((q) => q.id === newQuestion.id);
        
        if (newQuestionIndex !== -1) {
          // Calculate target index: insertAfter + 1
          // If insertAfter is -1 (beginning), target is 0
          // If insertAfter is 0, target is 1, etc.
          const targetIndex = insertAfter + 1;
          
          // Only reorder if the new question is not already in the right position
          if (newQuestionIndex !== targetIndex) {
            // Create a new array with the question in the correct position
            const reordered = [...currentQuestions];
            const [moved] = reordered.splice(newQuestionIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            
            // Send the reorder request
            await api.rfi.questions.reorder(projectId, {
              questionIds: reordered.map((q) => q.id),
            });
          }
        }
      }
      
      // Reload questions to get updated order numbers from the backend
      await loadQuestions(true);
      setInsertAfterIndex(null);
    } catch (err: any) {
      throw err;
    }
  };


  const handleFieldSave = async (
    questionId: string,
    field: "title" | "description" | "type" | "required",
    value: string | RFIQuestionType | boolean
  ) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    // Prevent duplicate saves
    const saveKey = `${questionId}-${field}`;
    if (savingFields.has(saveKey)) {
      console.log("Save already in progress, skipping:", saveKey);
      return;
    }

    const updatePayload: {
      title?: string;
      description?: string | null;
      type?: RFIQuestionType;
      required?: boolean;
    } = {};

    if (field === "title") {
      updatePayload.title = (value as string).trim();
    } else if (field === "description") {
      // Convert empty string to null for consistency with API
      const descValue = value as string;
      updatePayload.description = descValue === null || descValue === undefined || descValue.trim() === "" 
        ? null 
        : descValue.trim();
    } else if (field === "type") {
      updatePayload.type = value as RFIQuestionType;
    } else if (field === "required") {
      updatePayload.required = value as boolean;
    }

    setSavingFields((prev) => new Set(prev).add(saveKey));

    try {
      console.log("Updating question field:", { questionId, field, updatePayload });
      await api.rfi.questions.update(projectId, questionId, updatePayload);
      await loadQuestions(true);
      
      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[questionId]) {
          const fields = new Set(newFields[questionId]);
          fields.delete(field);
          if (fields.size === 0) {
            delete newFields[questionId];
          } else {
            newFields[questionId] = fields;
          }
        }
        return newFields;
      });
    } catch (err: any) {
      console.error("Error updating question field:", err);
      console.error("Error details:", {
        message: err.message,
        error: err.error,
        stack: err.stack,
        updatePayload,
        questionId,
        field,
      });
      
      // Check if it's a network/CORS error
      if (err.message?.includes("Failed to fetch") || err.message?.includes("CORS") || err.message?.includes("NetworkError")) {
        setError("Network error: Could not connect to server. Please check your connection and try again.");
      } else {
        const errorMessage = err.message || err.error?.message || "Failed to update question";
        setError(errorMessage);
      }
      // Don't clear editing state on error so user can retry
    } finally {
      setSavingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(saveKey);
        return newSet;
      });
    }
  };

  const handleFieldFocus = (questionId: string, field: "title" | "description" | "type" | "required") => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    
    if (!formData[questionId]) {
      setFormData((prev) => ({
        ...prev,
        [questionId]: {
          title: question.title,
          description: question.description || "",
          type: question.type,
          required: question.required ?? true,
        },
      }));
    }

    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[questionId]) {
        newFields[questionId] = new Set();
      }
      newFields[questionId].add(field);
      return newFields;
    });
  };

  const handleFieldBlur = (
    questionId: string,
    field: "title" | "description" | "type" | "required",
    event?: React.FocusEvent
  ) => {
    // Check if focus is moving to an element within the same question's editing area
    // This prevents closing the question when clicking on option manager elements
    if (event?.relatedTarget) {
      const relatedTarget = event.relatedTarget as HTMLElement;
      const questionElement = event.currentTarget.closest('[data-question-id]') as HTMLElement;
      if (questionElement && questionElement.contains(relatedTarget)) {
        // Focus is moving within the same question, don't close it
        return;
      }
    }

    // Use a small delay to ensure the blur event completes and any focus changes are processed
    // This is especially important for textarea which might expand/collapse
    const timeoutId = setTimeout(() => {
      // Double-check that focus hasn't moved to an element within the question
      const activeElement = document.activeElement;
      const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
      if (questionElement && activeElement && questionElement.contains(activeElement)) {
        // Focus is still within the question, don't close it
        return;
      }

      const question = questions.find((q) => q.id === questionId);
      if (!question) return;

      const data = formData[questionId];
      if (!data) return;

      let hasChanged = false;
      if (field === "title" && data.title.trim() !== question.title.trim()) {
        hasChanged = true;
      } else if (field === "description") {
        const currentDesc = (data.description || "").trim();
        const questionDesc = (question.description || "").trim();
        if (currentDesc !== questionDesc) {
          hasChanged = true;
        }
      } else if (field === "type" && data.type !== question.type) {
        hasChanged = true;
      } else if (field === "required" && data.required !== (question.required ?? true)) {
        hasChanged = true;
      }

      if (hasChanged) {
        handleFieldSave(questionId, field, data[field]);
      } else {
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[questionId]) {
            const fields = new Set(newFields[questionId]);
            fields.delete(field);
            if (fields.size === 0) {
              delete newFields[questionId];
            } else {
              newFields[questionId] = fields;
            }
          }
          return newFields;
        });
      }
    }, 200);

    // Store timeout ID for potential cleanup (though not strictly necessary here)
    return () => clearTimeout(timeoutId);
  };

  const updateFormField = (
    questionId: string,
    field: "title" | "description" | "type" | "required",
    value: string | RFIQuestionType | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {
          title: "",
          description: "",
          type: "SingleText" as RFIQuestionType,
          required: true,
        }),
        [field]: value,
      },
    }));
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }
    try {
      await api.rfi.questions.delete(projectId, questionId);
      
      // After deletion, reload questions and reorder to ensure sequential numbering
      const remainingQuestions = await api.rfi.questions.list(projectId);
      
      // Reorder all remaining questions to ensure they're numbered 1, 2, 3, etc.
      if (remainingQuestions.length > 0) {
        await api.rfi.questions.reorder(projectId, {
          questionIds: remainingQuestions.map((q) => q.id),
        });
      }
      
      // Reload to get the updated order
      await loadQuestions(true);
    } catch (err: any) {
      setError(err.message || "Failed to delete question");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);

    try {
      // Send reorder request to backend
      await api.rfi.questions.reorder(projectId, {
        questionIds: reorderedQuestions.map((q) => q.id),
      });
      
      // Reload questions from backend to get correct order numbers (1, 2, 3, ...)
      await loadQuestions(true);
    } catch (err: any) {
      setError(err.message || "Failed to reorder questions");
      // Reload on error to restore correct order
      await loadQuestions(true);
    }
  };

  const toggleDescription = (questionId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading questions...</p>
      </div>
    );
  }

  const getTypeLabel = (type: RFIQuestionType) => {
    const labels: Record<RFIQuestionType, string> = {
      YesNo: "Yes/No",
      Dropdown: "Dropdown",
      MultipleChoice: "Multiple Choice",
      Scale: "Scale",
      ContactDetails: "Contact Details",
      SingleText: "Single Text",
      MultilineText: "Multiline Text",
    };
    return labels[type];
  };

  // New question form component with inline layout
  const NewQuestionForm = ({
    projectId,
    insertAfterIndex,
    onSubmit,
    onCancel,
    getTypeLabel,
    questions,
  }: {
    projectId: string;
    insertAfterIndex: number;
    onSubmit: (data: {
      title: string;
      description?: string | null;
      type: RFIQuestionType;
      required?: boolean;
      scaleLabels?: Record<string, string> | null;
    }) => Promise<void>;
    onCancel: () => void;
    getTypeLabel: (type: RFIQuestionType) => string;
    questions: RFIQuestion[];
  }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<RFIQuestionType>("SingleText");
    const [required, setRequired] = useState(true);
    const [scaleLabels, setScaleLabels] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const formRef = React.useRef<HTMLDivElement>(null);

    const needsOptions = type === "Dropdown" || type === "MultipleChoice";
    const needsScaleConfig = type === "Scale";

    const handleSubmit = React.useCallback(async () => {
      setError("");

      if (!title.trim()) {
        setError("Title is required");
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit({
          title: title.trim(),
          description: description.trim() || null,
          type,
          required,
          scaleLabels: type === "Scale" ? scaleLabels : null,
        });
        // Form will close via onCancel after successful submission
      } catch (err: any) {
        setError(err.message || "Failed to save question");
        setSubmitting(false);
      }
    }, [title, description, type, required, scaleLabels, onSubmit]);

    // Handle click outside - save and close if there's content, otherwise just close
    React.useEffect(() => {
      const handleClickOutside = async (event: MouseEvent) => {
        const target = event.target as Node;
        if (formRef.current && !formRef.current.contains(target)) {
          if (title.trim()) {
            // Has content, save before closing
            await handleSubmit();
          } else {
            // No content, just close
            onCancel();
          }
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [title, handleSubmit, onCancel]);

    // Calculate the next order number based on insertAfterIndex
    // The order should always be the position in the array (1-indexed)
    const calculateNextOrder = () => {
      if (insertAfterIndex === -1) {
        // Inserting at the beginning, so order is 1
        return 1;
      } else if (insertAfterIndex >= 0 && insertAfterIndex < questions.length) {
        // Inserting after a specific question at index insertAfterIndex
        // The new question will be at position insertAfterIndex + 1
        // So its order number will be insertAfterIndex + 2 (since order is 1-indexed)
        return insertAfterIndex + 2;
      } else {
        // Inserting at the end
        return questions.length + 1;
      }
    };
    const nextOrder = calculateNextOrder();

    return (
      <div ref={formRef} className="border-2 border-primary-600 rounded-lg bg-white flex items-stretch overflow-hidden">
        {/* Left side: Number with solid background */}
        <div className="bg-primary-600 text-white flex items-center justify-center min-w-[3.5rem] px-3 py-4 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
          <span className="font-semibold text-lg">
            {nextOrder}
          </span>
        </div>

        {/* Right side: Question content */}
        <div className="flex-1 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (title.trim()) {
                        await handleSubmit();
                      }
                    } else if (e.key === "Escape") {
                      onCancel();
                    }
                  }}
                  placeholder="Question title"
                  className="flex-1 text-lg font-semibold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as RFIQuestionType;
                  setType(newType);
                }}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="YesNo">Yes/No</option>
                <option value="Dropdown">Dropdown</option>
                <option value="MultipleChoice">Multiple Choice</option>
                <option value="Scale">Scale</option>
                <option value="ContactDetails">Contact Details</option>
                <option value="SingleText">Single Text</option>
                <option value="MultilineText">Multiline Text</option>
              </select>
            </div>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                // Auto-resize textarea
                e.currentTarget.style.height = "auto";
                const newHeight = Math.min(e.currentTarget.scrollHeight, 4.5 * 1.5 * 16);
                e.currentTarget.style.height = `${newHeight}px`;
              }}
              onFocus={(e) => {
                requestAnimationFrame(() => {
                  e.currentTarget.style.height = "auto";
                  const targetHeight = Math.min(e.currentTarget.scrollHeight || 4.5 * 1.5 * 16, 4.5 * 1.5 * 16);
                  e.currentTarget.style.height = `${targetHeight}px`;
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              rows={1}
              placeholder="Add description here..."
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 resize-none overflow-hidden"
              style={{
                minHeight: "1.5rem",
                maxHeight: `${4.5 * 1.5}rem`,
              }}
            />

            {/* Required toggle and Cancel button - always shown */}
            <div className="mt-3 space-y-3">
              {/* Required/Optional toggle with Cancel button on same line */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex border border-gray-300 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setRequired(false)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        !required
                          ? "bg-primary-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Optional
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequired(true)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        required
                          ? "bg-primary-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      Required
                    </button>
                  </div>
                </div>
                {/* Cancel button - always shown, on same line as toggle */}
                <button
                  onClick={onCancel}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>

              {/* Options manager for MultipleChoice and Dropdown - shown after question is created */}
              {/* Note: Options can only be managed after the question is created, so this will be handled after submission */}

              {/* Scale configurator */}
              {needsScaleConfig && (
                <ScaleConfigurator
                  scaleLabels={scaleLabels}
                  onChange={setScaleLabels}
                />
              )}

              {type === "ContactDetails" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    Contact Details questions will display vendor information and allow
                    editing of contact person fields (first name, last name, email,
                    phone).
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {questions.length === 0 && insertAfterIndex === null ? (
        <div className="space-y-2 text-center py-2">
          <button
            onClick={() => setInsertAfterIndex(-1)}
            className="text-sm text-primary-600 hover:text-primary-700 transition-colors inline-block"
          >
            + Add question here
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {/* Show form at the beginning if insertAfterIndex is -1 */}
              {insertAfterIndex === -1 && (
                <NewQuestionForm
                  projectId={projectId}
                  insertAfterIndex={insertAfterIndex}
                  onSubmit={async (data) => {
                    await handleCreateQuestion(data, insertAfterIndex);
                  }}
                  onCancel={() => setInsertAfterIndex(null)}
                  getTypeLabel={getTypeLabel}
                  questions={questions}
                />
              )}

              {questions.map((question, index) => (
                <div key={question.id} className="space-y-2">
                  {/* Add question link before this question - hide if form is shown here or at the beginning */}
                  {insertAfterIndex !== index - 1 && !(index === 0 && insertAfterIndex === -1) && (
                    <div className="text-center py-2">
                      <button
                        onClick={() => setInsertAfterIndex(index - 1)}
                        className="text-sm text-gray-400 hover:text-primary-600 transition-colors inline-block"
                      >
                        + Add question here
                      </button>
                    </div>
                  )}

                  {/* Show form before this question if insertAfterIndex matches (but not if it's -1, as that's handled above) */}
                  {insertAfterIndex === index - 1 && insertAfterIndex !== -1 && (
                    <NewQuestionForm
                      projectId={projectId}
                      insertAfterIndex={insertAfterIndex}
                      onSubmit={async (data) => {
                        await handleCreateQuestion(data, insertAfterIndex);
                      }}
                      onCancel={() => setInsertAfterIndex(null)}
                      getTypeLabel={getTypeLabel}
                      questions={questions}
                    />
                  )}

                  <SortableQuestionItem question={question}>
                    {({ attributes, listeners }) => {
                      const isEditingTitle = editingFields[question.id]?.has("title");
                      const isEditingDescription = editingFields[question.id]?.has("description");
                      const isEditingType = editingFields[question.id]?.has("type");
                      const isEditingRequired = editingFields[question.id]?.has("required");
                      const isEditing = isEditingTitle || isEditingDescription || isEditingType || isEditingRequired;
                      
                      const questionFormData = formData[question.id] || {
                        title: question.title,
                        description: question.description || "",
                        type: question.type,
                        required: question.required ?? true,
                      };

                      const titleRef = React.useRef<HTMLHeadingElement>(null);
                      const [titleWidth, setTitleWidth] = React.useState<number | undefined>(undefined);

                      const [lastFocusedField, setLastFocusedField] = React.useState<string | null>(null);

                      const handleTitleClick = () => {
                        if (titleRef.current && !isEditingTitle) {
                          const width = titleRef.current.offsetWidth;
                          setTitleWidth(Math.max(width, 200)); // Minimum width of 200px
                        }
                        // Put all fields in edit mode
                        handleFieldFocus(question.id, "title");
                        handleFieldFocus(question.id, "description");
                        handleFieldFocus(question.id, "type");
                        setLastFocusedField("title");
                      };

                      const handleDescriptionClick = () => {
                        // Put all fields in edit mode
                        handleFieldFocus(question.id, "title");
                        handleFieldFocus(question.id, "description");
                        handleFieldFocus(question.id, "type");
                        setLastFocusedField("description");
                      };

                      const handleTypeClick = () => {
                        // Put all fields in edit mode
                        handleFieldFocus(question.id, "title");
                        handleFieldFocus(question.id, "description");
                        handleFieldFocus(question.id, "type");
                        setLastFocusedField("type");
                      };

                      React.useEffect(() => {
                        if (!isEditingTitle) {
                          setTitleWidth(undefined);
                        }
                      }, [isEditingTitle]);

                      // Calculate display number accounting for active insert form
                      const getDisplayNumber = () => {
                        let displayNumber = index + 1;
                        // If there's an active form being inserted before this question, increment the display number
                        if (insertAfterIndex !== null) {
                          if (insertAfterIndex === -1 && index >= 0) {
                            // Form at the beginning, shift all questions down
                            displayNumber += 1;
                          } else if (index > insertAfterIndex) {
                            // Form inserted before this question
                            displayNumber += 1;
                          }
                        }
                        return displayNumber;
                      };

                      return (
                        <div className="border-2 border-primary-600 rounded-lg bg-white flex items-stretch overflow-hidden" data-question-id={question.id}>
                          {/* Left side: Number with solid background (drag handle) */}
                          <div
                            {...attributes}
                            {...listeners}
                            className="bg-primary-600 text-white flex items-center justify-center min-w-[3.5rem] px-3 py-4 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg cursor-grab active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <span className="font-semibold text-lg">
                              {getDisplayNumber()}
                            </span>
                          </div>

                          {/* Right side: Question content */}
                          <div className="flex-1 p-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isEditingTitle ? (
                                    <input
                                      type="text"
                                      value={questionFormData.title}
                                      onChange={(e) => updateFormField(question.id, "title", e.target.value)}
                                      onFocus={() => handleFieldFocus(question.id, "title")}
                                      onBlur={(e) => handleFieldBlur(question.id, "title", e)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="flex-1 text-lg font-semibold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus={lastFocusedField === "title"}
                                    />
                                  ) : (
                                    <h4
                                      ref={titleRef}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTitleClick();
                                      }}
                                      className="text-lg font-semibold cursor-pointer hover:text-primary-600 transition-colors"
                                    >
                                      {question.title}
                                    </h4>
                                  )}
                                  {question.required && (
                                    <span 
                                      className={`px-2 py-1 text-xs bg-red-100 text-red-700 rounded transition-opacity duration-200 ${
                                        isEditing ? 'opacity-0 pointer-events-none' : 'opacity-100'
                                      }`}
                                    >
                                      Required
                                    </span>
                                  )}
                                  {question.description && !isEditing && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDescription(question.id);
                                      }}
                                      className="flex-shrink-0 text-gray-500 hover:text-gray-700"
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
                                {isEditingType ? (
                                  <select
                                    value={questionFormData.type}
                                    onChange={(e) => {
                                      const newType = e.target.value as RFIQuestionType;
                                      updateFormField(question.id, "type", newType);
                                      handleFieldSave(question.id, "type", newType);
                                    }}
                                    onFocus={() => handleFieldFocus(question.id, "type")}
                                    onBlur={(e) => handleFieldBlur(question.id, "type", e)}
                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus={lastFocusedField === "type"}
                                  >
                                    <option value="YesNo">Yes/No</option>
                                    <option value="Dropdown">Dropdown</option>
                                    <option value="MultipleChoice">Multiple Choice</option>
                                    <option value="Scale">Scale</option>
                                    <option value="ContactDetails">Contact Details</option>
                                    <option value="SingleText">Single Text</option>
                                    <option value="MultilineText">Multiline Text</option>
                                  </select>
                                ) : (
                                  <span
                                    onClick={handleTypeClick}
                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded cursor-pointer hover:opacity-80"
                                  >
                                    {getTypeLabel(question.type)}
                                  </span>
                                )}
                              </div>
                              {isEditingDescription ? (
                                <textarea
                                  value={questionFormData.description}
                                  onChange={(e) => {
                                    updateFormField(question.id, "description", e.target.value);
                                    // Auto-resize textarea
                                    e.currentTarget.style.height = "auto";
                                    const newHeight = Math.min(e.currentTarget.scrollHeight, 4.5 * 1.5 * 16);
                                    e.currentTarget.style.height = `${newHeight}px`;
                                  }}
                                  onFocus={(e) => {
                                    handleFieldFocus(question.id, "description");
                                    // Expand to 3 rows on focus with animation
                                    requestAnimationFrame(() => {
                                      e.currentTarget.style.height = "auto";
                                      const targetHeight = Math.min(e.currentTarget.scrollHeight || 4.5 * 1.5 * 16, 4.5 * 1.5 * 16);
                                      e.currentTarget.style.height = `${targetHeight}px`;
                                    });
                                  }}
                                  onBlur={(e) => {
                                    handleFieldBlur(question.id, "description", e);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  rows={1}
                                  placeholder="Add description here..."
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200 resize-none overflow-hidden"
                                  style={{
                                    minHeight: "1.5rem",
                                    maxHeight: `${4.5 * 1.5}rem`,
                                  }}
                                  autoFocus={lastFocusedField === "description"}
                                />
                              ) : question.description && expandedDescriptions.has(question.id) ? (
                                <p className="text-sm text-gray-600 mb-2">
                                  {question.description}
                                </p>
                              ) : question.description ? (
                                <button
                                  type="button"
                                  onClick={handleDescriptionClick}
                                  className="text-sm text-gray-400 hover:text-primary-600 transition-colors text-left"
                                >
                                  {question.description}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleDescriptionClick}
                                  className="text-sm text-gray-400 hover:text-primary-600 transition-colors"
                                >
                                  + Add description
                                </button>
                              )}

                              {/* Required toggle and Options manager - shown when editing */}
                              {isEditing && (
                                <div className="mt-3 space-y-3">
                                  {/* Required/Optional toggle with Delete link on same line */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <div className="flex border border-gray-300 rounded-md overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            updateFormField(question.id, "required", false);
                                            handleFieldSave(question.id, "required", false);
                                          }}
                                          onFocus={() => handleFieldFocus(question.id, "required")}
                                          className={`px-3 py-1 text-xs font-medium transition-colors ${
                                            !questionFormData.required
                                              ? "bg-primary-600 text-white"
                                              : "bg-white text-gray-700 hover:bg-gray-50"
                                          }`}
                                        >
                                          Optional
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            updateFormField(question.id, "required", true);
                                            handleFieldSave(question.id, "required", true);
                                          }}
                                          onFocus={() => handleFieldFocus(question.id, "required")}
                                          className={`px-3 py-1 text-xs font-medium transition-colors ${
                                            questionFormData.required
                                              ? "bg-primary-600 text-white"
                                              : "bg-white text-gray-700 hover:bg-gray-50"
                                          }`}
                                        >
                                          Required
                                        </button>
                                      </div>
                                    </div>
                                    {/* Delete button - shown when editing title or description, on same line as toggle */}
                                    {(isEditingTitle || isEditingDescription) && (
                                      <button
                                        onClick={() => handleDeleteQuestion(question.id)}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>

                                  {/* Options manager for MultipleChoice and Dropdown */}
                                  {(question.type === "MultipleChoice" || question.type === "Dropdown") && (
                                    <QuestionOptionManager
                                      questionId={question.id}
                                      questionType={question.type}
                                      projectId={projectId}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </SortableQuestionItem>
                </div>
              ))}

              {/* Add question link at the bottom - hide if form is shown here */}
              {insertAfterIndex !== questions.length - 1 && (
                <div className="text-center py-2">
                  <button
                    onClick={() => setInsertAfterIndex(questions.length - 1)}
                    className="text-sm text-primary-600 hover:text-primary-700 transition-colors inline-block"
                  >
                    + Add question here
                  </button>
                </div>
              )}

              {/* Show form at the end if insertAfterIndex is the last index */}
              {insertAfterIndex === questions.length - 1 && (
                <NewQuestionForm
                  projectId={projectId}
                  insertAfterIndex={insertAfterIndex}
                  onSubmit={async (data) => {
                    await handleCreateQuestion(data, insertAfterIndex);
                  }}
                  onCancel={() => setInsertAfterIndex(null)}
                  getTypeLabel={getTypeLabel}
                  questions={questions}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

