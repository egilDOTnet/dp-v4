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
  onQuestionsChange?: () => void;
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

export default function QuestionList({ projectId, rfiId, onQuestionsChange }: QuestionListProps) {
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
      
      // Don't close if clicking on a delete button
      if (target.closest('button') && target.textContent?.trim() === 'Delete') {
        return;
      }
      
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
              if (field === "title" && data.title.trim() !== question.title.trim()) {
                handleFieldSave(questionId, field as "title", data.title);
              } else if (field === "description") {
                const currentDesc = (data.description || "").trim();
                const questionDesc = (question.description || "").trim();
                if (currentDesc !== questionDesc) {
                  handleFieldSave(questionId, field as "description", data.description);
                }
              } else if (field === "type" && data.type !== question.type) {
                handleFieldSave(questionId, field as "type", data.type);
              } else if (field === "required" && data.required !== (question.required ?? true)) {
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
    insertAfter?: number,
    skipReload?: boolean
  ): Promise<RFIQuestion> => {
    try {
      // Create the question (it will be added at the end)
      const newQuestion = await api.rfi.questions.create(projectId, data);
      
      // Don't close the form if this is a Dropdown or MultipleChoice question
      // (options need to be managed)
      const needsOptions = data.type === "Dropdown" || data.type === "MultipleChoice";
      
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
      
      // Only reload questions if not skipping (skip reload for auto-create to preserve focus)
      if (!skipReload) {
        await loadQuestions(true);
        // Only close form for non-options types
        if (!needsOptions) {
          setInsertAfterIndex(null);
        }
      } else {
        // For auto-create, DON'T update the questions state at all
        // This prevents any re-renders that could affect the form
        // The question exists in the backend, but we don't add it to local state yet
        // It will be added when the form is actually saved/closed
      }
      
      // Return the created question so the form can use its ID
      return newQuestion;
      
      // Notify parent component that questions have changed
      if (onQuestionsChange) {
        onQuestionsChange();
      }
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
      scaleLabels?: Record<string, string> | null;
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
      // If changing type, clean up old options/scale labels
      if (field === "type") {
        const oldType = question.type;
        const newType = value as RFIQuestionType;
        
        // Get current question state to check for existing options
        const currentQuestions = await api.rfi.questions.list(projectId);
        const currentQuestion = currentQuestions.find((q) => q.id === questionId);
        const hasOptions = currentQuestion?.options && currentQuestion.options.length > 0;
        
        // If switching TO Scale, delete all options (Scale doesn't use options)
        const newTypeIsScale = newType === "Scale";
        if (newTypeIsScale && hasOptions) {
          try {
            // Delete all options when switching to Scale
            await Promise.all(
              currentQuestion!.options!.map((option) =>
                api.rfi.questions.options.delete(projectId, questionId, option.id)
              )
            );
          } catch (err: any) {
            console.error("Error deleting old options when switching to Scale:", err);
            // Continue with type update even if option deletion fails
          }
        }
        
        // If switching FROM Dropdown/MultipleChoice to something else (not Scale, already handled above), delete all options
        const oldTypeUsesOptions = oldType === "Dropdown" || oldType === "MultipleChoice";
        const newTypeUsesOptions = newType === "Dropdown" || newType === "MultipleChoice";
        
        if (oldTypeUsesOptions && !newTypeUsesOptions && !newTypeIsScale && hasOptions) {
          // Switching away from options-based type (but not to Scale, which is handled above), delete all options
          try {
            await Promise.all(
              currentQuestion!.options!.map((option) =>
                api.rfi.questions.options.delete(projectId, questionId, option.id)
              )
            );
          } catch (err: any) {
            console.error("Error deleting old options:", err);
            // Continue with type update even if option deletion fails
          }
        } else if (oldTypeUsesOptions && newTypeUsesOptions && oldType !== newType && hasOptions) {
          // Switching between Dropdown and MultipleChoice, delete all options (different structures)
          try {
            await Promise.all(
              currentQuestion!.options!.map((option) =>
                api.rfi.questions.options.delete(projectId, questionId, option.id)
              )
            );
          } catch (err: any) {
            console.error("Error deleting old options:", err);
            // Continue with type update even if option deletion fails
          }
        }
        
        // If switching FROM Scale to something else, clear scaleLabels and delete any existing options
        const oldTypeIsScale = oldType === "Scale";
        
        if (oldTypeIsScale && !newTypeIsScale) {
          // Clear scaleLabels when switching away from Scale
          updatePayload.scaleLabels = null;
          
          // Also delete any options that might exist (in case question had options before being changed to Scale)
          if (hasOptions) {
            try {
              await Promise.all(
                currentQuestion!.options!.map((option) =>
                  api.rfi.questions.options.delete(projectId, questionId, option.id)
                )
              );
            } catch (err: any) {
              console.error("Error deleting old options when switching from Scale:", err);
              // Continue with type update even if option deletion fails
            }
          }
        }
      }
      
      console.log("Updating question field:", { questionId, field, updatePayload });
      await api.rfi.questions.update(projectId, questionId, updatePayload);
      await loadQuestions(true);
      
      // Notify parent component that questions have changed
      if (onQuestionsChange) {
        onQuestionsChange();
      }
      
      // Check if the new type needs options (for Dropdown/MultipleChoice) or scale config
      const currentFormData = formData[questionId];
      const newType = field === "type" ? (value as RFIQuestionType) : (currentFormData?.type || question.type);
      const needsOptions = newType === "Dropdown" || newType === "MultipleChoice";
      const needsScaleConfig = newType === "Scale";
      
      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[questionId]) {
          const fields = new Set(newFields[questionId]);
          fields.delete(field);
          
          // If changing type to Dropdown/MultipleChoice/Scale, keep form open to allow options/scale editing
          // Also keep form open if it's already one of these types (for editing options/scale)
          if (fields.size === 0 && !needsOptions && !needsScaleConfig) {
            // Only close if no other fields are being edited AND it's not an options/scale type
            delete newFields[questionId];
          } else {
            // Keep form open - either other fields are being edited or it's an options/scale type
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
        // Get the question to check the new type
        const updatedQuestion = questions.find((q) => q.id === questionId);
        // Use formData type (current selection) to determine if options are needed
        const currentFormData = formData[questionId];
        const newType = field === "type" ? (data.type as RFIQuestionType) : (currentFormData?.type || updatedQuestion?.type || "SingleText");
        const needsOptions = newType === "Dropdown" || newType === "MultipleChoice";
        const needsScaleConfig = newType === "Scale";
        
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[questionId]) {
            const fields = new Set(newFields[questionId]);
            fields.delete(field);
            
            // If changing type to Dropdown/MultipleChoice/Scale, keep form open to allow options/scale editing
            // Also keep form open if it's already one of these types (for editing options/scale)
            if (fields.size === 0 && !needsOptions && !needsScaleConfig) {
              // Only close if no other fields are being edited AND it's not an options/scale type
              delete newFields[questionId];
            } else {
              // Keep form open - either other fields are being edited or it's an options/scale type
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
    
    // Close any editing state for this question after confirmation
    setEditingFields((prev) => {
      const newFields = { ...prev };
      delete newFields[questionId];
      return newFields;
    });
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
      
      // Notify parent component that questions have changed
      if (onQuestionsChange) {
        onQuestionsChange();
      }
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
      
      // Notify parent component that questions have changed
      if (onQuestionsChange) {
        onQuestionsChange();
      }
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
    insertAfterIndex,
    onSubmit,
    onCancel,
    questions,
    onReload,
  }: {
    insertAfterIndex: number;
    onSubmit: (data: {
      title: string;
      description?: string | null;
      type: RFIQuestionType;
      required?: boolean;
      scaleLabels?: Record<string, string> | null;
    }) => Promise<RFIQuestion | void>;
    onCancel: () => void;
    questions: RFIQuestion[];
    onReload?: () => Promise<void>;
  }) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<RFIQuestionType>("SingleText");
    const [required, setRequired] = useState(true);
    const [scaleLabels, setScaleLabels] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [createdQuestionId, setCreatedQuestionId] = useState<string | null>(null);
    const formRef = React.useRef<HTMLDivElement>(null);
    const typeSelectRef = React.useRef<HTMLSelectElement>(null);

    const needsScaleConfig = type === "Scale";
    const needsOptions = type === "Dropdown" || type === "MultipleChoice";
    const previousTypeRef = React.useRef<RFIQuestionType>(type);

    // Silently create question in background when type changes to Dropdown/MultipleChoice
    // This allows the options manager to appear without interrupting the user's editing
    // Create even without a title (use placeholder title)
    React.useEffect(() => {
      const typeJustChanged = previousTypeRef.current !== type;
      previousTypeRef.current = type;

      if (needsOptions && !createdQuestionId && !isSubmitting) {
        // Only create when type just changed, not on every title change
        if (typeJustChanged) {
          const createQuestionSilently = async () => {
            // Don't set isSubmitting to avoid showing loading state
            try {
              // Use title if available, otherwise use placeholder
              const questionTitle = title.trim() || "New Question";
              const newQuestion = await onSubmit({
                title: questionTitle,
                description: description.trim() || null,
                type,
                required,
                scaleLabels: type === "Scale" ? scaleLabels : null,
              });
              
              // Set the question ID silently without any UI changes
              if (newQuestion && newQuestion.id) {
                setCreatedQuestionId(newQuestion.id);
                // If we used a placeholder title and user hasn't entered one yet, update the local title
                // so it matches what was created
                if (!title.trim()) {
                  setTitle(questionTitle);
                }
              }
            } catch (err: any) {
              // Silently handle error - don't show error state that interrupts editing
              console.error("Failed to create question for options:", err);
            }
          };
          
          // Small delay to ensure type change is processed first
          const timeoutId = setTimeout(createQuestionSilently, 100);
          return () => clearTimeout(timeoutId);
        }
      }
    }, [type, needsOptions, createdQuestionId, isSubmitting, title, description, required, scaleLabels, onSubmit]);

    // Watch for the newly created question in the questions list
    React.useEffect(() => {
      if (needsOptions && title.trim() && !createdQuestionId) {
        const newQuestion = questions.find(
          (q) => q.title === title.trim() && q.type === type
        );
        if (newQuestion) {
          setCreatedQuestionId(newQuestion.id);
          setIsSubmitting(false);
        }
      }
    }, [questions, needsOptions, title, type, createdQuestionId]);

    const handleSubmit = React.useCallback(async () => {
      setError("");

      if (!title.trim()) {
        setError("Title is required");
        return;
      }

      setIsSubmitting(true);
      try {
        // If question was already created silently for options, update it
        if (createdQuestionId) {
          await api.rfi.questions.update(projectId, createdQuestionId, {
            title: title.trim(),
            description: description.trim() || null,
            type,
            required,
            scaleLabels: type === "Scale" ? scaleLabels : null,
          });
          setIsSubmitting(false);
          
          // Return the updated question so parent can reload properly
          const updatedQuestions = await api.rfi.questions.list(projectId);
          const updatedQuestion = updatedQuestions.find(q => q.id === createdQuestionId);
          return updatedQuestion;
        } else {
          // Question doesn't exist yet, create it normally
          const newQuestion = await onSubmit({
            title: title.trim(),
            description: description.trim() || null,
            type,
            required,
            scaleLabels: type === "Scale" ? scaleLabels : null,
          });
          
          // Form will close via parent component for non-options types
          if (!needsOptions) {
            setIsSubmitting(false);
          }
          
          return newQuestion;
        }
      } catch (err: any) {
        setError(err.message || "Failed to save question");
        setIsSubmitting(false);
        throw err;
      }
    }, [title, description, type, required, scaleLabels, needsOptions, createdQuestionId, onSubmit, projectId]);

    // Handle click outside - save and close if there's content, otherwise just close
    React.useEffect(() => {
      const handleClickOutside = async (event: MouseEvent) => {
        const target = event.target as Node;
        if (formRef.current && !formRef.current.contains(target)) {
          if (title.trim()) {
            // Has content, save before closing
            try {
              await handleSubmit();
              
              // If question was created silently (for options), we need to reload questions
              // to make it appear in the list
              if (createdQuestionId && onReload) {
                await onReload();
              }
            } catch (err) {
              // If save fails, don't close the form
              return;
            }
            // Close the form after saving
            onCancel();
          } else {
            // No content, just close
            // If question was created silently, delete it
            if (createdQuestionId) {
              try {
                await api.rfi.questions.delete(projectId, createdQuestionId);
              } catch (err) {
                // Ignore delete errors
              }
            }
            onCancel();
          }
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [title, handleSubmit, onCancel, createdQuestionId, projectId, onReload]);

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
      <div ref={formRef} className="border-2 border-primary-600 rounded-lg bg-background-tertiary flex items-stretch overflow-hidden">
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
                    // Handle Ctrl-A/Command-A to select all text
                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                      e.preventDefault();
                      e.currentTarget.select();
                      return;
                    }
                    // Allow other Ctrl/Cmd combinations (copy, paste, cut, etc.)
                    if (e.ctrlKey || e.metaKey) {
                      return; // Let browser handle these
                    }
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
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700 font-medium">Type:</label>
                <select
                  ref={typeSelectRef}
                  value={type}
                  onChange={async (e) => {
                    const newType = e.target.value as RFIQuestionType;
                    const oldType = type;
                    setType(newType);
                    
                    // If question is already created, update it in the backend
                    if (createdQuestionId) {
                      try {
                        const updatePayload: {
                          type: RFIQuestionType;
                          scaleLabels?: Record<string, string> | null;
                        } = {
                          type: newType,
                        };
                        
                        // Get current question state to check for existing options
                        const currentQuestions = await api.rfi.questions.list(projectId);
                        const currentQuestion = currentQuestions.find((q) => q.id === createdQuestionId);
                        const hasOptions = currentQuestion?.options && currentQuestion.options.length > 0;
                        
                        // If switching TO Scale, delete all options (Scale doesn't use options)
                        const newTypeIsScale = newType === "Scale";
                        if (newTypeIsScale && hasOptions) {
                          try {
                            // Delete all options when switching to Scale
                            await Promise.all(
                              currentQuestion!.options!.map((option) =>
                                api.rfi.questions.options.delete(projectId, createdQuestionId, option.id)
                              )
                            );
                          } catch (err: any) {
                            console.error("Error deleting old options when switching to Scale:", err);
                            // Continue with type update even if option deletion fails
                          }
                        }
                        
                        // If switching FROM Dropdown/MultipleChoice to something else (not Scale, already handled above), delete all options
                        const oldTypeUsesOptions = oldType === "Dropdown" || oldType === "MultipleChoice";
                        const newTypeUsesOptions = newType === "Dropdown" || newType === "MultipleChoice";
                        
                        if (oldTypeUsesOptions && !newTypeUsesOptions && !newTypeIsScale && hasOptions) {
                          // Switching away from options-based type (but not to Scale, which is handled above), delete all options
                          try {
                            await Promise.all(
                              currentQuestion!.options!.map((option) =>
                                api.rfi.questions.options.delete(projectId, createdQuestionId, option.id)
                              )
                            );
                          } catch (err: any) {
                            console.error("Error deleting old options:", err);
                            // Continue with type update even if option deletion fails
                          }
                        } else if (oldTypeUsesOptions && newTypeUsesOptions && oldType !== newType && hasOptions) {
                          // Switching between Dropdown and MultipleChoice, delete all options (different structures)
                          try {
                            await Promise.all(
                              currentQuestion!.options!.map((option) =>
                                api.rfi.questions.options.delete(projectId, createdQuestionId, option.id)
                              )
                            );
                          } catch (err: any) {
                            console.error("Error deleting old options:", err);
                            // Continue with type update even if option deletion fails
                          }
                        }
                        
                        // If switching FROM Scale to something else, clear scaleLabels and delete any existing options
                        const oldTypeIsScale = oldType === "Scale";
                        
                        if (oldTypeIsScale && !newTypeIsScale) {
                          // Clear scaleLabels when switching away from Scale
                          updatePayload.scaleLabels = null;
                          
                          // Also delete any options that might exist (in case question had options before being changed to Scale)
                          if (hasOptions) {
                            try {
                              await Promise.all(
                                currentQuestion!.options!.map((option) =>
                                  api.rfi.questions.options.delete(projectId, createdQuestionId, option.id)
                                )
                              );
                            } catch (err: any) {
                              console.error("Error deleting old options when switching from Scale:", err);
                              // Continue with type update even if option deletion fails
                            }
                          }
                        }
                        
                        await api.rfi.questions.update(projectId, createdQuestionId, updatePayload);
                        // Parent component will reload questions automatically
                      } catch (err: any) {
                        setError(err.message || "Failed to update question type");
                      }
                    }
                    
                    // Reset created question ID if type changes away from options types
                    if (newType !== "Dropdown" && newType !== "MultipleChoice") {
                      setCreatedQuestionId(null);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="YesNo">Yes/No</option>
                  <option value="Dropdown">Dropdown</option>
                  <option value="MultipleChoice">Multiple Choice</option>
                  <option value="Scale">Scale</option>
                  <option value="SingleText">Single Text</option>
                  <option value="MultilineText">Multiline Text</option>
                </select>
              </div>
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
                const textarea = e.currentTarget;
                requestAnimationFrame(() => {
                  if (!textarea) return;
                  textarea.style.height = "auto";
                  const targetHeight = Math.min(textarea.scrollHeight || 4.5 * 1.5 * 16, 4.5 * 1.5 * 16);
                  textarea.style.height = `${targetHeight}px`;
                });
              }}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
                // Allow other Ctrl/Cmd combinations (copy, paste, cut, etc.)
                if (e.ctrlKey || e.metaKey) {
                  return; // Let browser handle these
                }
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
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
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
                          : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                      }`}
                    >
                      Required
                    </button>
                  </div>
                </div>
                {/* Cancel button - always shown, on same line as toggle */}
                <button
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Cancel"}
                </button>
              </div>

              {/* Options manager for MultipleChoice and Dropdown - shown when type is selected */}
              {needsOptions && createdQuestionId && (
                <QuestionOptionManager
                  questionId={createdQuestionId}
                  questionType={type}
                  projectId={projectId}
                />
              )}

              {/* Scale configurator */}
              {needsScaleConfig && (
                <ScaleConfigurator
                  scaleLabels={scaleLabels}
                  onChange={setScaleLabels}
                />
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
        <div className="space-y-2">
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-2">
              Create questions for your RFI questionnaire. You need at least 1 question before you can preview or publish the RFI.
            </p>
          </div>
          <div className="text-center py-2">
            <button
              onClick={() => setInsertAfterIndex(-1)}
              className="text-sm text-primary-600 hover:text-primary-700 transition-colors inline-block"
            >
              + Add question here
            </button>
          </div>
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
                  insertAfterIndex={insertAfterIndex}
                  onSubmit={async (data) => {
                    // Skip reload for auto-create to preserve focus
                    return await handleCreateQuestion(data, insertAfterIndex, true);
                  }}
                  onCancel={() => setInsertAfterIndex(null)}
                  questions={questions}
                  onReload={() => loadQuestions(true)}
                />
              )}

              {questions.map((question, index) => (
                <div key={question?.id || `question-${index}`} className="space-y-2">
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
                      insertAfterIndex={insertAfterIndex}
                      onSubmit={async (data) => {
                        await handleCreateQuestion(data, insertAfterIndex);
                      }}
                      onCancel={() => setInsertAfterIndex(null)}
                      questions={questions}
                      onReload={() => loadQuestions(true)}
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

                      const [lastFocusedField, setLastFocusedField] = React.useState<string | null>(null);

                      const handleTitleClick = () => {
                        // Put all fields in edit mode
                        handleFieldFocus(question.id, "title");
                        handleFieldFocus(question.id, "description");
                        handleFieldFocus(question.id, "type");
                        setLastFocusedField("title");
                      };

                      const handleTypeClick = () => {
                        // Put all fields in edit mode
                        handleFieldFocus(question.id, "title");
                        handleFieldFocus(question.id, "description");
                        handleFieldFocus(question.id, "type");
                        setLastFocusedField("type");
                      };

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
                        <div className="border-2 border-primary-600 rounded-lg bg-background-tertiary flex items-stretch overflow-hidden" data-question-id={question.id}>
                          {/* Left side: Number with solid background (drag handle) */}
                          <div
                            {...attributes}
                            {...listeners}
                            className="bg-primary-600 text-white flex items-center justify-center min-w-[3.5rem] px-3 pt-3 pb-3 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg cursor-grab active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <span className="font-semibold text-lg">
                              {getDisplayNumber()}
                            </span>
                          </div>

                          {/* Right side: Question content */}
                          <div className="flex-1 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className={`flex items-center justify-between gap-2 flex-wrap ${isEditing ? 'mb-2' : ''}`}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isEditingTitle ? (
                                    <input
                                      type="text"
                                      value={questionFormData.title}
                                      onChange={(e) => updateFormField(question.id, "title", e.target.value)}
                                      onFocus={() => handleFieldFocus(question.id, "title")}
                                      onBlur={(e) => handleFieldBlur(question.id, "title", e)}
                                      onKeyDown={(e) => {
                                        // Handle Ctrl-A/Command-A to select all text
                                        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                          e.preventDefault();
                                          e.currentTarget.select();
                                          return;
                                        }
                                        // Allow other Ctrl/Cmd combinations (copy, paste, cut, etc.)
                                        if (e.ctrlKey || e.metaKey) {
                                          return; // Let browser handle these
                                        }
                                        if (e.key === "Escape") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="flex-1 text-lg font-semibold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus={lastFocusedField === "title"}
                                    />
                                  ) : (
                                    <h4
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTitleClick();
                                      }}
                                      className="text-lg font-semibold cursor-pointer hover:text-primary-600 transition-colors"
                                    >
                                      {question.title}
                                    </h4>
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
                                  {question.required && (
                                    <span 
                                      className={`px-2 py-1 text-xs bg-red-100 text-red-700 rounded transition-opacity duration-200 ${
                                        isEditing ? 'opacity-0 pointer-events-none' : 'opacity-100'
                                      }`}
                                    >
                                      Required
                                    </span>
                                  )}
                                </div>
                                {isEditingType ? (
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-700 font-medium">Type:</label>
                                    <select
                                      value={questionFormData.type}
                                      onChange={(e) => {
                                        const newType = e.target.value as RFIQuestionType;
                                        updateFormField(question.id, "type", newType);
                                        // Don't auto-save when changing type - keep form open for editing
                                        // User can continue editing and options manager will appear if needed
                                        // The type will be saved when user clicks outside or blurs
                                      }}
                                      onFocus={() => handleFieldFocus(question.id, "type")}
                                      onBlur={(e) => {
                                        // Save type change when blurring, but keep form open if it's Dropdown/MultipleChoice
                                        const newType = questionFormData.type;
                                        const needsOptions = newType === "Dropdown" || newType === "MultipleChoice";
                                        if (!needsOptions) {
                                          // For non-options types, save and close as before
                                          handleFieldBlur(question.id, "type", e);
                                        } else {
                                          // For options types, save but keep form open
                                          handleFieldSave(question.id, "type", newType);
                                          // Don't close the form - keep editing mode open
                                        }
                                      }}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus={lastFocusedField === "type"}
                                    >
                                      <option value="YesNo">Yes/No</option>
                                      <option value="Dropdown">Dropdown</option>
                                      <option value="MultipleChoice">Multiple Choice</option>
                                      <option value="Scale">Scale</option>
                                      <option value="SingleText">Single Text</option>
                                      <option value="MultilineText">Multiline Text</option>
                                    </select>
                                  </div>
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
                                    const textarea = e.currentTarget;
                                    requestAnimationFrame(() => {
                                      if (!textarea) return;
                                      textarea.style.height = "auto";
                                      const targetHeight = Math.min(textarea.scrollHeight || 4.5 * 1.5 * 16, 4.5 * 1.5 * 16);
                                      textarea.style.height = `${targetHeight}px`;
                                    });
                                  }}
                                  onBlur={(e) => {
                                    handleFieldBlur(question.id, "description", e);
                                  }}
                                  onKeyDown={(e) => {
                                    // Handle Ctrl-A/Command-A to select all text
                                    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                      e.preventDefault();
                                      e.currentTarget.select();
                                      return;
                                    }
                                    // Allow other Ctrl/Cmd combinations (copy, paste, cut, etc.)
                                    if (e.ctrlKey || e.metaKey) {
                                      return; // Let browser handle these
                                    }
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
                                <p className="text-sm text-gray-600 mt-1">
                                  {question.description}
                                </p>
                              ) : null}

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
                                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
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
                                              : "bg-background-tertiary text-text-primary hover:bg-background-primary"
                                          }`}
                                        >
                                          Required
                                        </button>
                                      </div>
                                    </div>
                                    {/* Delete button - shown when editing any field, on same line as toggle */}
                                    {isEditing && (
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          // Use onMouseDown to catch before click outside handler
                                          e.stopPropagation(); // Prevent event from bubbling
                                          e.preventDefault(); // Prevent any default behavior
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent click from bubbling to parent handlers
                                          e.preventDefault(); // Prevent any default behavior
                                          handleDeleteQuestion(question.id);
                                        }}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>

                                  {/* Options manager for MultipleChoice and Dropdown */}
                                  {/* Show only if current form data type is MultipleChoice or Dropdown (not Scale) */}
                                  {(questionFormData.type === "MultipleChoice" || questionFormData.type === "Dropdown") && (
                                    <QuestionOptionManager
                                      questionId={question.id}
                                      questionType={questionFormData.type}
                                      projectId={projectId}
                                    />
                                  )}

                                  {/* Scale configurator for Scale type */}
                                  {/* Show only if current form data type is Scale (not MultipleChoice or Dropdown) */}
                                  {questionFormData.type === "Scale" && (
                                    <div className="mt-4">
                                      <ScaleConfigurator
                                        scaleLabels={(question.scaleLabels as Record<string, string>) || {}}
                                        onChange={async (newScaleLabels) => {
                                          // Update scale labels in the backend
                                          await api.rfi.questions.update(projectId, question.id, {
                                            scaleLabels: newScaleLabels,
                                          });
                                          // Reload questions to get updated data
                                          await loadQuestions(true);
                                        }}
                                      />
                                    </div>
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

              {/* Show form at the end if insertAfterIndex is the last index (but not -1, which is handled above) */}
              {insertAfterIndex === questions.length - 1 && insertAfterIndex !== -1 && (
                <NewQuestionForm
                  insertAfterIndex={insertAfterIndex}
                  onSubmit={async (data) => {
                    // Skip reload for auto-create to preserve focus
                    return await handleCreateQuestion(data, insertAfterIndex, true);
                  }}
                  onCancel={() => setInsertAfterIndex(null)}
                  questions={questions}
                  onReload={() => loadQuestions(true)}
                />
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

