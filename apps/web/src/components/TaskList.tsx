"use client";

import { useState, useRef, useEffect } from "react";
import { Task, api, Project, Comment } from "@/lib/api";
import WysiwygEditor, { WysiwygEditorRef } from "./WysiwygEditor";
import { UserAvatar } from "./UserAvatar";
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

interface TaskListProps {
  projectId: string;
  phaseId: string;
  tasks: Task[];
  projectMembers: Project["members"];
  onTaskUpdate: () => void;
  phaseTitle?: string;
  /** Hide the internal "New Task" button (use when providing external button) */
  hideNewTaskButton?: boolean;
  /** Controlled mode: external state for creating new task */
  isCreatingNewTaskExternal?: boolean;
  /** Callback when internal isCreatingNewTask state changes */
  onIsCreatingNewTaskChange?: (value: boolean) => void;
}

type FilterType = "all" | "completed" | "remaining";

interface TaskFormData {
  name: string;
  description: string;
  ownerId: string | null;
  startDate: string | null;
  plannedCompletionDate: string | null;
}

interface SortableTaskItemProps {
  task: Task;
  isCompleted: boolean;
  isDraggable: boolean;
  children: (props: { attributes: any; listeners: any }) => React.ReactNode;
}

function SortableTaskItem({
  task,
  isCompleted,
  isDraggable,
  children,
}: SortableTaskItemProps) {
  // Always call the hook (React rule), but disable when not draggable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !isDraggable || isCompleted,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // For non-draggable tasks, just return the children without drag functionality
  if (!isDraggable || isCompleted) {
    return <div>{children({ attributes: {}, listeners: {} })}</div>;
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {children({ attributes, listeners })}
    </div>
  );
}

export default function TaskList({
  projectId,
  phaseId,
  tasks,
  projectMembers,
  onTaskUpdate,
  phaseTitle,
  hideNewTaskButton = false,
  isCreatingNewTaskExternal,
  onIsCreatingNewTaskChange,
}: TaskListProps) {
  const [filter, setFilter] = useState<FilterType>("remaining");
  const [isCreatingNewTaskInternal, setIsCreatingNewTaskInternal] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isCreatingNewTask = isCreatingNewTaskExternal !== undefined 
    ? isCreatingNewTaskExternal 
    : isCreatingNewTaskInternal;
  
  const setIsCreatingNewTask = (value: boolean) => {
    if (onIsCreatingNewTaskChange) {
      onIsCreatingNewTaskChange(value);
    }
    setIsCreatingNewTaskInternal(value);
  };
  const [newTaskName, setNewTaskName] = useState("");
  const [newlyCreatedTaskId, setNewlyCreatedTaskId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, TaskFormData>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [newCommentNotifyOption, setNewCommentNotifyOption] = useState<Record<string, "task_owner" | "task_owner_mentions" | "all_members" | "none">>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
  const [isNewTaskAnimating, setIsNewTaskAnimating] = useState(false);
  const [hoveredOwnerButtonId, setHoveredOwnerButtonId] = useState<string | null>(null);
  const [deletingTaskIds, setDeletingTaskIds] = useState<Set<string>>(new Set());
  const [descriptionFocusSource, setDescriptionFocusSource] = useState<Record<string, "title" | "direct">>({});
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startDateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const endDateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);
  const commentEditorRefs = useRef<Record<string, WysiwygEditorRef | null>>({});

  // Set up drag-and-drop sensors
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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any task container
      let clickedInsideTask = false;
      Object.values(taskRefs.current).forEach((ref) => {
        if (ref && ref.contains(target)) {
          clickedInsideTask = true;
        }
      });

      // Also check if clicking on the create form
      if (isCreatingNewTask) {
        // The new task form is part of the main container, so we don't need special handling
        // But we should check if clicking on the new task input area
        if (newTaskInputRef.current && newTaskInputRef.current.contains(target)) {
          clickedInsideTask = true;
        }
      }

      if (!clickedInsideTask) {
        // Save any pending changes before exiting edit mode
        Object.entries(editingFields).forEach(([taskId, fields]) => {
          const data = formData[taskId];
          const task = tasks.find((t) => t.id === taskId);
          
          if (data && task) {
            fields.forEach((field) => {
              if (field === "name" && data.name !== task.name) {
                handleFieldSave(taskId, "name", data.name);
              } else if (field === "ownerId" && data.ownerId !== task.ownerId) {
                handleFieldSave(taskId, "ownerId", data.ownerId);
              } else if (field === "startDate" && data.startDate !== formatDate(task.startDate)) {
                handleFieldSave(taskId, "startDate", data.startDate);
              } else if (field === "plannedCompletionDate" && data.plannedCompletionDate !== formatDate(task.plannedCompletionDate)) {
                handleFieldSave(taskId, "plannedCompletionDate", data.plannedCompletionDate);
              }
            });
          }
        });

        // Save any pending description changes
        Object.keys(editingDescriptions).forEach((taskId) => {
          const data = formData[taskId];
          const task = tasks.find((t) => t.id === taskId);
          
          if (data && task && data.description !== (task.description || "")) {
            handleFieldSave(taskId, "description", data.description);
          }
        });

        // Exit all edit modes
        setEditingFields({});
        setEditingDescriptions(new Set());
        // Don't collapse expanded descriptions - let user toggle those manually
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreatingNewTask, editingFields, editingDescriptions, formData, tasks]);

  // Handle external new task trigger
  useEffect(() => {
    if (isCreatingNewTaskExternal && !isNewTaskAnimating) {
      setNewTaskName("");
      // Trigger animation after element is in DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsNewTaskAnimating(true);
          // Focus the input after animation starts
          setTimeout(() => {
            newTaskInputRef.current?.focus();
          }, 50);
        });
      });
    }
  }, [isCreatingNewTaskExternal, isNewTaskAnimating]);

  // Scroll to and animate newly created task when it appears in the list
  useEffect(() => {
    if (newlyCreatedTaskId) {
      // Wait for the task to be rendered in the DOM
      const scrollTimeout = setTimeout(() => {
        const taskElement = taskRefs.current[newlyCreatedTaskId];
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);

      // Remove the highlight after animation completes
      const clearHighlightTimeout = setTimeout(() => {
        setNewlyCreatedTaskId(null);
      }, 2000);

      return () => {
        clearTimeout(scrollTimeout);
        clearTimeout(clearHighlightTimeout);
      };
    }
  }, [newlyCreatedTaskId, tasks]);

  // Initialize form data for all tasks when they change
  useEffect(() => {
    tasks.forEach((task) => {
      if (task && task.id && !formData[task.id]) {
        const normalizeDate = (dateString: string | null): string | null => {
          if (!dateString) return null;
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
          return dateString;
        };
        
        setFormData((prev) => ({
          ...prev,
          [task.id]: {
            name: task.name || "",
            description: task.description || "",
            ownerId: task.ownerId || null,
            startDate: normalizeDate(task.startDate),
            plannedCompletionDate: normalizeDate(task.plannedCompletionDate),
          },
        }));
      }
    });
  }, [tasks]);

  // Load comment counts for all tasks when tasks change
  useEffect(() => {
    const loadAllCommentCounts = async () => {
      const tasksToLoad = tasks.filter(
        (task) => task && task.id && !comments[task.id] && !loadingComments.has(task.id)
      );

      if (tasksToLoad.length === 0) return;

      // Mark tasks as loading to prevent duplicate requests
      setLoadingComments((prev) => {
        const newSet = new Set(prev);
        tasksToLoad.forEach((task) => newSet.add(task.id));
        return newSet;
      });

      // Load comments for all tasks in parallel
      const loadPromises = tasksToLoad.map(async (task) => {
        try {
          const taskComments = await api.projects.phases.tasks.comments.list(
            projectId,
            phaseId,
            task.id
          );
          return { taskId: task.id, comments: taskComments };
        } catch (err) {
          console.error(`Failed to load comments for task ${task.id}:`, err);
          return { taskId: task.id, comments: [] };
        }
      });

      const results = await Promise.all(loadPromises);
      
      // Update comments state with all loaded comments
      setComments((prev) => {
        const newComments = { ...prev };
        results.forEach(({ taskId, comments: taskComments }) => {
          newComments[taskId] = taskComments;
        });
        return newComments;
      });

      // Clear loading state
      setLoadingComments((prev) => {
        const newSet = new Set(prev);
        tasksToLoad.forEach((task) => newSet.delete(task.id));
        return newSet;
      });
    };

    loadAllCommentCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, projectId, phaseId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split("T")[0];
  };

  const formatDateDisplay = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDateTimeISO = (dateString: string | null): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Filter tasks based on selected filter
  // Keep completing tasks visible during fade-out animation
  const filteredTasks = tasks.filter((task) => {
    // In remaining mode, keep completing tasks visible during fade-out
    if (filter === "remaining") {
      // Show if not completed, OR if it's currently completing (fading out)
      return task.actualCompletionDate === null || completingTaskIds.has(task.id);
    }
    if (filter === "completed") {
      return task.actualCompletionDate !== null;
    }
    return true; // "all"
  });

  // Sort tasks based on filter
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (filter === "all") {
      // Completed tasks sorted by actualCompletionDate (ascending)
      if (a.actualCompletionDate && b.actualCompletionDate) {
        return new Date(a.actualCompletionDate).getTime() - new Date(b.actualCompletionDate).getTime();
      }
      if (a.actualCompletionDate) return 1;
      if (b.actualCompletionDate) return -1;

      // Other tasks sorted by plannedCompletionDate (ascending)
      if (a.plannedCompletionDate && b.plannedCompletionDate) {
        return new Date(a.plannedCompletionDate).getTime() - new Date(b.plannedCompletionDate).getTime();
      }
      if (a.plannedCompletionDate) return -1;
      if (b.plannedCompletionDate) return 1;
      return 0;
    }
    return a.order - b.order;
  });

  const handleStartNewTask = () => {
    setIsCreatingNewTask(true);
    setNewTaskName("");
    // Trigger animation after element is in DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsNewTaskAnimating(true);
        // Focus the input after animation starts
        setTimeout(() => {
          newTaskInputRef.current?.focus();
        }, 50);
      });
    });
  };

  const handleCancelNewTask = () => {
    setIsNewTaskAnimating(false);
    // Wait for exit animation to complete before removing from DOM
    setTimeout(() => {
      setIsCreatingNewTask(false);
      setNewTaskName("");
    }, 300);
  };

  const handleCreateTask = async (name: string) => {
    if (!name.trim()) {
      handleCancelNewTask();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const newTask = await api.projects.phases.createTask(projectId, phaseId, {
        name: name.trim(),
      });

      setIsNewTaskAnimating(false);
      setIsCreatingNewTask(false);
      setNewTaskName("");
      
      // Set the newly created task ID for animation
      // The useEffect will handle scrolling and clearing the highlight
      setNewlyCreatedTaskId(newTask.id);
      
      onTaskUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const handleNewTaskBlur = () => {
    // Small delay to allow for potential click events on other elements
    setTimeout(() => {
      if (newTaskName.trim()) {
        handleCreateTask(newTaskName);
      } else {
        handleCancelNewTask();
      }
    }, 150);
  };

  const handleNewTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Ctrl-A/Command-A to select all text
    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
      e.preventDefault();
      e.currentTarget.select();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (newTaskName.trim()) {
        handleCreateTask(newTaskName);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelNewTask();
    }
  };

  // Initialize form data for a task if not already present
  const ensureFormData = (task: Task) => {
    if (!task || !task.id) return;
    if (!formData[task.id]) {
      const normalizeDate = (dateString: string | null): string | null => {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
        return dateString;
      };
      
      setFormData((prev) => ({
        ...prev,
        [task.id]: {
          name: task.name || "",
          description: task.description || "",
          ownerId: task.ownerId || null,
          startDate: normalizeDate(task.startDate),
          plannedCompletionDate: normalizeDate(task.plannedCompletionDate),
        },
      }));
    }
  };

  // Check if an element is within the same task container
  const isWithinSameTask = (taskId: string, element: EventTarget | null): boolean => {
    if (!element || !(element instanceof Node)) return false;
    const taskContainer = taskRefs.current[taskId];
    if (!taskContainer) return false;
    return taskContainer.contains(element);
  };

  const handleFieldSave = async (
    taskId: string,
    field: keyof TaskFormData,
    value: string | null
  ) => {
    const timeoutKey = `${taskId}-${field}`;
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
      delete saveTimeouts.current[timeoutKey];
    }

    setLoading(true);
    setError("");

    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const updatePayload: {
        name?: string;
        description?: string | null;
        ownerId?: string | null;
        startDate?: string | null;
        plannedCompletionDate?: string | null;
      } = {};

      if (field === "name") {
        updatePayload.name = value || "";
      } else if (field === "description") {
        updatePayload.description = value && value.trim() ? value.trim() : null;
      } else if (field === "ownerId") {
        updatePayload.ownerId = value || null;
      } else if (field === "startDate") {
        if (value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            updatePayload.startDate = date.toISOString();
          } else {
            updatePayload.startDate = value;
          }
        } else {
          updatePayload.startDate = null;
        }
      } else if (field === "plannedCompletionDate") {
        if (value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            updatePayload.plannedCompletionDate = date.toISOString();
          } else {
            updatePayload.plannedCompletionDate = value;
          }
        } else {
          updatePayload.plannedCompletionDate = null;
        }
      }

      await api.projects.phases.updateTask(projectId, phaseId, taskId, updatePayload);

      setEditingFields((prev) => {
        const newFields = { ...prev };
        if (newFields[taskId]) {
          const fields = new Set(newFields[taskId]);
          fields.delete(field);
          if (fields.size === 0) {
            delete newFields[taskId];
          } else {
            newFields[taskId] = fields;
          }
        }
        return newFields;
      });

      onTaskUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldBlur = (
    taskId: string,
    field: keyof TaskFormData,
    _e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const timeoutKey = `${taskId}-${field}`;
    
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
    }

    const delayedSaveTimeout = setTimeout(() => {
      const activeElement = document.activeElement;
      if (isWithinSameTask(taskId, activeElement)) {
        return;
      }

      const data = formData[taskId];
      if (!data) return;

      const currentValue = data[field];
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      let hasChanged = false;
      if (field === "name" && currentValue !== task.name) {
        hasChanged = true;
      } else if (field === "description" && currentValue !== (task.description || "")) {
        hasChanged = true;
      } else if (field === "ownerId" && currentValue !== task.ownerId) {
        hasChanged = true;
      } else if (field === "startDate" && currentValue !== formatDate(task.startDate)) {
        hasChanged = true;
      } else if (
        field === "plannedCompletionDate" &&
        currentValue !== formatDate(task.plannedCompletionDate)
      ) {
        hasChanged = true;
      }

      if (hasChanged) {
        handleFieldSave(taskId, field, currentValue);
      } else {
        setEditingFields((prev) => {
          const newFields = { ...prev };
          if (newFields[taskId]) {
            const fields = new Set(newFields[taskId]);
            fields.delete(field);
            if (fields.size === 0) {
              delete newFields[taskId];
            } else {
              newFields[taskId] = fields;
            }
          }
          return newFields;
        });
      }
    }, 150);

    saveTimeouts.current[timeoutKey] = delayedSaveTimeout;
  };

  const handleFieldFocus = (taskId: string, field: keyof TaskFormData, task: Task) => {
    const timeoutKey = `${taskId}-${field}`;
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
      delete saveTimeouts.current[timeoutKey];
    }

    ensureFormData(task);

    setEditingFields((prev) => {
      const newFields = { ...prev };
      if (!newFields[taskId]) {
        newFields[taskId] = new Set();
      }
      newFields[taskId].add(field);
      return newFields;
    });
  };

  const updateFormField = (
    taskId: string,
    field: keyof TaskFormData,
    value: string | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          name: "",
          description: "",
          ownerId: null,
          startDate: null,
          plannedCompletionDate: null,
        }),
        [field]: value || null,
      },
    }));
  };

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
        setEditingDescriptions((prevEdit) => {
          const newEdit = new Set(prevEdit);
          newEdit.delete(taskId);
          return newEdit;
        });
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleDescriptionBlur = (taskId: string, _e: React.FocusEvent<HTMLTextAreaElement>) => {
    const timeoutKey = `${taskId}-description`;
    
    if (saveTimeouts.current[timeoutKey]) {
      clearTimeout(saveTimeouts.current[timeoutKey]);
    }

    const delayedSaveTimeout = setTimeout(() => {
      const activeElement = document.activeElement;
      if (isWithinSameTask(taskId, activeElement)) {
        return;
      }

      setEditingDescriptions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });

      const data = formData[taskId];
      if (!data) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      if (data.description !== (task.description || "")) {
        handleFieldSave(taskId, "description", data.description).then(() => {
          // Collapse description after saving
          setExpandedDescriptions((prev) => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        });
      } else {
        // No changes, just collapse if it was expanded
        setExpandedDescriptions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    }, 150);

    saveTimeouts.current[timeoutKey] = delayedSaveTimeout;
  };


  const getOwnerDisplay = (task: Task) => {
    if (task.owner) {
      return task.owner;
    }
    if (task.ownerId) {
      return projectMembers?.find((m) => m.id === task.ownerId) || null;
    }
    return null;
  };

  const handleMarkAsDone = async (taskId: string) => {
    setLoading(true);
    setError("");

    try {
      const today = new Date().toISOString();
      await api.projects.phases.updateTask(projectId, phaseId, taskId, {
        actualCompletionDate: today,
      });

      // If in "remaining" filter mode, add fade-out animation
      if (filter === "remaining") {
        setCompletingTaskIds((prev) => new Set(prev).add(taskId));
        // Remove from completing set after animation completes (slightly longer than animation)
        setTimeout(() => {
          setCompletingTaskIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }, 350);
      }

      // Small delay before updating to allow fade-out to start
      setTimeout(() => {
        onTaskUpdate();
      }, 50);
    } catch (err: any) {
      setError(err.message || "Failed to mark task as done");
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async (taskId: string) => {
    setLoading(true);
    setError("");

    try {
      await api.projects.phases.updateTask(projectId, phaseId, taskId, {
        actualCompletionDate: null,
      });

      onTaskUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reopen task");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveDragId(null);
      return;
    }

    // Only allow reordering when filter is "remaining" or "all"
    if (filter === "completed") {
      setActiveDragId(null);
      return;
    }

    // Get all non-completed tasks from the original tasks array (sorted by order)
    const allNonCompletedTasks = tasks
      .filter((task) => task.phaseId === phaseId && task.actualCompletionDate === null)
      .sort((a, b) => a.order - b.order);

    // Find the indices in the non-completed tasks array
    const oldIndex = allNonCompletedTasks.findIndex((task) => task.id === active.id);
    const newIndex = allNonCompletedTasks.findIndex((task) => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveDragId(null);
      return;
    }

    // Reorder the non-completed tasks array
    const reorderedTasks = arrayMove(allNonCompletedTasks, oldIndex, newIndex);

    setLoading(true);
    setError("");

    try {
      // Get all tasks in the phase
      const allPhaseTasks = tasks.filter((task) => task.phaseId === phaseId);
      const completedTasks = allPhaseTasks
        .filter((task) => task.actualCompletionDate !== null)
        .sort((a, b) => a.order - b.order);

      // Create a map of task IDs to new order
      const taskOrderMap = new Map<string, number>();

      // Assign new orders to non-completed tasks based on reordered array
      reorderedTasks.forEach((task, index) => {
        taskOrderMap.set(task.id, index + 1);
      });

      // Keep completed tasks at the end with their relative order preserved
      const maxNonCompletedOrder = reorderedTasks.length;
      completedTasks.forEach((task, index) => {
        taskOrderMap.set(task.id, maxNonCompletedOrder + index + 1);
      });

      // Update all tasks that need their order changed
      const updatePromises = Array.from(taskOrderMap.entries())
        .filter(([taskId, newOrder]) => {
          const task = allPhaseTasks.find((t) => t.id === taskId);
          return task && task.order !== newOrder;
        })
        .map(([taskId, newOrder]) =>
          api.projects.phases.updateTask(projectId, phaseId, taskId, {
            order: newOrder,
          })
        );

      await Promise.all(updatePromises);
      onTaskUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to reorder tasks");
    } finally {
      setLoading(false);
      setActiveDragId(null);
    }
  };

  const isTaskDelayed = (task: Task) => {
    if (!task.plannedCompletionDate) return false;
    const now = new Date();
    const planned = new Date(task.plannedCompletionDate);
    if (task.actualCompletionDate) {
      const actual = new Date(task.actualCompletionDate);
      return actual > planned;
    }
    return now > planned && !task.actualCompletionDate;
  };

  const loadComments = async (taskId: string, markAsViewed: boolean = false): Promise<void> => {
    if (loadingComments.has(taskId)) return;
    
    setLoadingComments((prev) => new Set(prev).add(taskId));
    try {
      const taskComments = await api.projects.phases.tasks.comments.list(projectId, phaseId, taskId);
      setComments((prev) => ({
        ...prev,
        [taskId]: taskComments,
      }));
      // Only mark as viewed if explicitly requested (when user expands comments)
      if (markAsViewed) {
        setLastViewedComments(taskId);
      }
    } catch (err: any) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoadingComments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const toggleComments = (taskId: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
        // Load comments if not already loaded, and mark as viewed when expanding
        if (!comments[taskId]) {
          loadComments(taskId, true).then(() => {
            // Focus after comments are loaded and editor is rendered
            setTimeout(() => {
              commentEditorRefs.current[taskId]?.focus();
            }, 100);
          });
        } else {
          // Comments already loaded, just mark as viewed
          setLastViewedComments(taskId);
          // Focus the comment editor after a short delay to ensure it's rendered
          setTimeout(() => {
            commentEditorRefs.current[taskId]?.focus();
          }, 100);
        }
      }
      return newSet;
    });
  };

  const handleCreateComment = async (taskId: string) => {
    const content = newCommentContent[taskId]?.trim();
    if (!content) return;

    const notifyOption = newCommentNotifyOption[taskId] || "task_owner_mentions";

    setLoadingComments((prev) => new Set(prev).add(taskId));
    try {
      const newComment = await api.projects.phases.tasks.comments.create(projectId, phaseId, taskId, {
        content,
        notifyOption,
      });
      
      setComments((prev) => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), newComment],
      }));
      
      // Update last viewed when comment is created (user sees it immediately)
      setLastViewedComments(taskId);
      
      // Clear form
      setNewCommentContent((prev) => {
        const newContent = { ...prev };
        delete newContent[taskId];
        return newContent;
      });
      setNewCommentNotifyOption((prev) => {
        const newOptions = { ...prev };
        delete newOptions[taskId];
        return newOptions;
      });
    } catch (err: any) {
      console.error("Failed to create comment:", err);
      setError(err.message || "Failed to create comment");
    } finally {
      setLoadingComments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getCommentCount = (taskId: string): number => {
    return comments[taskId]?.length || 0;
  };

  // Track last viewed comments timestamp per task
  const getLastViewedComments = (taskId: string): Date | null => {
    if (typeof window === "undefined") return null;
    const key = `lastViewedComments_${taskId}`;
    const timestamp = localStorage.getItem(key);
    return timestamp ? new Date(timestamp) : null;
  };

  const setLastViewedComments = (taskId: string) => {
    if (typeof window === "undefined") return;
    const key = `lastViewedComments_${taskId}`;
    localStorage.setItem(key, new Date().toISOString());
  };

  // Check if there are new comments since last view
  const hasNewComments = (taskId: string): boolean => {
    const lastViewed = getLastViewedComments(taskId);
    if (!comments[taskId] || comments[taskId].length === 0) {
      return false;
    }
    // If never viewed before, all comments are "new"
    if (!lastViewed) {
      return true;
    }
    // Check if any comment was created after last viewed time
    return comments[taskId].some(
      (comment) => new Date(comment.createdAt) > lastViewed
    );
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start fade-out animation
      setDeletingTaskIds((prev) => new Set(prev).add(taskId));
      // Wait for animation to complete before deleting
      setTimeout(async () => {
        await api.projects.phases.deleteTask(projectId, phaseId, taskId);
        setDeletingTaskIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        onTaskUpdate();
        setLoading(false);
      }, 300);
    } catch (err: any) {
      setError(err.message || "Failed to delete task");
      setDeletingTaskIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-secondary rounded-lg shadow-md p-6 border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{phaseTitle || "Tasks"}</h2>
        <div className="flex items-center gap-3">
          {/* Filter Toggle - Connected Button Group */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              onClick={() => setFilter("remaining")}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filter === "remaining"
                  ? "bg-primary-600 text-white"
                  : "bg-background-secondary text-text-primary hover:bg-background-tertiary"
              }`}
            >
              Remaining Tasks
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <button
              onClick={() => setFilter("completed")}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filter === "completed"
                  ? "bg-primary-600 text-white"
                  : "bg-background-secondary text-text-primary hover:bg-background-tertiary"
              }`}
            >
              Completed Tasks
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filter === "all"
                  ? "bg-primary-600 text-white"
                  : "bg-background-secondary text-text-primary hover:bg-background-tertiary"
              }`}
            >
              All Tasks
            </button>
          </div>
          {!hideNewTaskButton && (
            <button
              onClick={handleStartNewTask}
              disabled={isCreatingNewTask}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:opacity-50"
            >
              New Task
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {/* New Task - Inline Edit Mode */}
        {isCreatingNewTask && (
          <div
            className={`border-2 border-primary-500 rounded-lg bg-background-secondary flex items-stretch overflow-hidden transition-all duration-300 ease-out ${
              isNewTaskAnimating
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-4"
            }`}
          >
            {/* Left side: Plus indicator */}
            <div className="bg-primary-500 text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>

            {/* Right side: Task form */}
            <div className="flex-1 px-4 py-3 bg-background-tertiary">
              <div className="flex items-center gap-3 mb-1">
                {/* Checkmark button for marking as done */}
                <button
                  disabled
                  className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 opacity-50 cursor-not-allowed"
                  title="Save task to enable"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Owner Avatar */}
                <div className="flex-shrink-0 relative">
                  <button
                    type="button"
                    disabled
                    className="w-7 h-7 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 cursor-not-allowed opacity-50"
                    title="Save task to assign owner"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                </div>

                {/* Task Name - In Edit Mode */}
                <input
                  ref={newTaskInputRef}
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onBlur={handleNewTaskBlur}
                  onKeyDown={handleNewTaskKeyDown}
                  placeholder="Enter task name..."
                  className="flex-1 min-w-0 px-2 py-1 rounded text-sm font-semibold border border-border-primary bg-background-secondary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />

                {/* Right-aligned icons: Description and Dates */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Description icon */}
                  <button
                    type="button"
                    disabled
                    className="flex-shrink-0 text-gray-500 opacity-50 cursor-not-allowed"
                    title="Save task to add description"
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

                  {/* Date icons */}
                  <div className="flex items-center gap-3 text-sm">
                    {/* Start Date */}
                    <div className="relative flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled
                        className="flex items-center gap-1.5 cursor-not-allowed opacity-50"
                      >
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-gray-500 whitespace-nowrap">Start date</span>
                      </button>
                    </div>

                    {/* End Date (Planned Completion) */}
                    <div className="relative flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled
                        className="flex items-center gap-1.5 cursor-not-allowed opacity-50"
                      >
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-gray-500 whitespace-nowrap">End date</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {sortedTasks.length === 0 ? (
            <div>
              <p className="text-gray-500 text-center py-8">
                {filter === "completed"
                  ? "No completed tasks"
                  : filter === "remaining"
                  ? "No remaining tasks"
                  : "No tasks"}
              </p>
            </div>
          ) : (
            <>
            {filter !== "completed" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(event) => setActiveDragId(event.active.id as string)}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedTasks
                    .filter((task) => task.actualCompletionDate === null)
                    .map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedTasks.map((task) => {
                if (!task || !task.id) return null;
                
                const isDelayed = isTaskDelayed(task);
                const isCompleted = task.actualCompletionDate !== null;
                const owner = getOwnerDisplay(task);
                
                // Get form data or use task data as fallback
                const taskFormData = formData[task.id] || {
                  name: task.name || "",
                  description: task.description || "",
                  ownerId: task.ownerId || null,
                  startDate: task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : null,
                  plannedCompletionDate: task.plannedCompletionDate ? new Date(task.plannedCompletionDate).toISOString().split("T")[0] : null,
                };

                const isNewlyCreated = newlyCreatedTaskId === task.id;
                const isDraggable = !isCompleted; // filter is already not "completed" in this branch
                const isDragging = activeDragId === task.id;
                const isCompleting = completingTaskIds.has(task.id);
                
                return (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    isCompleted={isCompleted}
                    isDraggable={isDraggable}
                  >
                    {({ attributes, listeners }) => (
                    <div
                      ref={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      className={`
                        border-2 border-primary-500 rounded-lg bg-background-secondary flex items-stretch overflow-hidden transition-all duration-300 ease-out
                        ${isCompleting ? "opacity-0 scale-95" : ""}
                        ${deletingTaskIds.has(task.id) ? "opacity-0 scale-95" : ""}
                        ${isNewlyCreated ? "shadow-lg scale-105" : ""}
                        ${isDragging ? "opacity-50 shadow-md" : ""}
                        ${isDelayed && !isNewlyCreated && !isDragging && !isCompleting && !deletingTaskIds.has(task.id) ? "border-red-400" : ""}
                        ${isCompleted && !isNewlyCreated && !isDragging ? "border-primary-400" : ""}
                      `}
                    >
                      {/* Left side: Drag handle panel */}
                      {isDraggable && !isCompleted ? (
                        <div 
                          {...attributes}
                          {...listeners}
                          className="bg-primary-500 text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
                          title="Drag to reorder"
                        >
                          {/* White grip dots (2x4 pattern) - smaller size */}
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
                      ) : (
                        <div className={`${isCompleted ? 'bg-primary-500' : 'bg-primary-500'} text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg`}>
                          {isCompleted ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-4 h-4"></div>
                          )}
                        </div>
                      )}

                      {/* Right side: Task content */}
                      <div className="flex-1 px-4 py-3 bg-background-tertiary">
                        <div className="flex items-center gap-3 mb-1">
                          {/* Checkmark button for marking as done */}
                          {!isCompleted && (
                            <button
                              onClick={() => handleMarkAsDone(task.id)}
                              disabled={loading}
                              className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50 transition-colors"
                              title="Mark as done"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                          {isCompleted && (
                            <button
                              onClick={() => handleReopen(task.id)}
                              disabled={loading}
                              className="flex-shrink-0 w-7 h-7 rounded-full border border-primary-300 bg-primary-100 flex items-center justify-center text-primary-600 hover:border-primary-500 hover:bg-primary-200 disabled:opacity-50 transition-colors"
                              title="Reopen task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}

                          {/* Owner Avatar */}
                          <div 
                            className="flex-shrink-0 relative"
                            onMouseEnter={() => setHoveredOwnerButtonId(task.id)}
                            onMouseLeave={() => setHoveredOwnerButtonId(null)}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const select = document.getElementById(`owner-select-${task.id}`);
                                select?.click();
                              }}
                              className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-selection transition-colors relative z-10 ${
                                hoveredOwnerButtonId === task.id
                                  ? "border-selection"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                              title={owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : "No owner - click to assign"}
                            >
                              {owner ? (
                                <UserAvatar user={owner} size="xs" />
                              ) : (
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                              )}
                            </button>
                            <select
                              id={`owner-select-${task.id}`}
                              value={taskFormData.ownerId ?? ""}
                              onChange={(e) => {
                                updateFormField(task.id, "ownerId", e.target.value || null);
                                handleFieldSave(task.id, "ownerId", e.target.value || null);
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer z-20"
                            >
                              <option value="">No owner</option>
                              {projectMembers?.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName && member.lastName
                                    ? `${member.firstName} ${member.lastName}`
                                    : member.firstName || member.lastName || member.name || member.email}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Task Name */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {editingFields[task.id]?.has("name") ? (
                                <input
                                  type="text"
                                  value={taskFormData.name}
                                  onChange={(e) => updateFormField(task.id, "name", e.target.value)}
                                  onBlur={(e) => {
                                    handleFieldBlur(task.id, "name", e);
                                    // Clear focus source after blur
                                    setDescriptionFocusSource((prev) => {
                                      const newSource = { ...prev };
                                      delete newSource[task.id];
                                      return newSource;
                                    });
                                  }}
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
                                  className={`w-full px-2 py-1 rounded text-sm font-semibold border border-border-primary bg-background-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                    isCompleted ? "line-through" : ""
                                  }`}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span
                                    className={`text-sm font-semibold px-2 py-1 ${
                                      isCompleted ? "line-through" : ""
                                    }`}
                                    onClick={() => {
                                      // Put all fields in edit mode when title is clicked
                                      ensureFormData(task);
                                      handleFieldFocus(task.id, "name", task);
                                      handleFieldFocus(task.id, "description", task);
                                      handleFieldFocus(task.id, "ownerId", task);
                                      handleFieldFocus(task.id, "startDate", task);
                                      handleFieldFocus(task.id, "plannedCompletionDate", task);
                                      // Expand description so it's visible for editing
                                      setExpandedDescriptions((prev) => new Set(prev).add(task.id));
                                      setEditingDescriptions((prev) => new Set(prev).add(task.id));
                                      // Mark that we entered edit mode via title click
                                      setDescriptionFocusSource((prev) => ({ ...prev, [task.id]: "title" }));
                                    }}
                                  >
                                    {taskFormData.name || task.name}
                                  </span>
                                  {/* Description icon - only show when description exists, inline after title */}
                                  {task.description && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDescription(task.id);
                                      }}
                                      className="flex-shrink-0 text-text-secondary hover:text-text-primary self-center"
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
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right-aligned icons: Comments and Dates */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Comment icon */}
                            {getCommentCount(task.id) > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(task.id);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background-secondary border border-border-primary hover:bg-background-primary transition-colors relative z-10"
                                title="Comments"
                              >
                                <svg
                                  className={`w-4 h-4 ${
                                    hasNewComments(task.id)
                                      ? "text-primary-600 fill-primary-600"
                                      : "text-gray-500 fill-gray-500"
                                  }`}
                                  fill="currentColor"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                                <span className="text-xs text-text-primary font-medium">
                                  {getCommentCount(task.id)}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(task.id);
                                }}
                                className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity relative z-10"
                                title="Comments"
                              >
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                              </button>
                            )}

                            {/* Date icons */}
                            <div className="flex items-center gap-3 text-sm">
                              {/* Start Date */}
                              <div className="relative flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const input = startDateInputRefs.current[task.id];
                                    if (input) {
                                      // Try showPicker() first (modern browsers)
                                      if (typeof (input as any).showPicker === 'function') {
                                        try {
                                          const pickerResult = (input as any).showPicker();
                                          // Check if it returns a Promise
                                          if (pickerResult && typeof pickerResult.catch === 'function') {
                                            pickerResult.catch(() => {
                                              // Fallback to click if showPicker fails
                                              input.click();
                                            });
                                          } else {
                                            // If showPicker doesn't return a Promise, just use click
                                            input.click();
                                          }
                                        } catch (error) {
                                          // If showPicker throws, fallback to click
                                          input.click();
                                        }
                                      } else {
                                        // Fallback to click
                                        input.click();
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity relative z-10"
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  {task.startDate ? (
                                    <span className="text-text-primary whitespace-nowrap">{formatDateDisplay(task.startDate)}</span>
                                  ) : (
                                    <span className="text-gray-500 whitespace-nowrap">Start date</span>
                                  )}
                                </button>
                                <input
                                  ref={(el) => {
                                    startDateInputRefs.current[task.id] = el;
                                  }}
                                  type="date"
                                  value={taskFormData.startDate || ""}
                                  onChange={(e) => {
                                    updateFormField(task.id, "startDate", e.target.value || null);
                                    handleFieldSave(task.id, "startDate", e.target.value || null);
                                  }}
                                  className="absolute top-full left-0 mt-1 opacity-0 pointer-events-none"
                                  id={`start-date-${task.id}`}
                                  tabIndex={-1}
                                  style={{ width: '200px', height: '40px' }}
                                />
                              </div>

                              {/* End Date (Planned Completion) */}
                              <div className="relative flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const input = endDateInputRefs.current[task.id];
                                    if (input) {
                                      // Try showPicker() first (modern browsers)
                                      if (typeof (input as any).showPicker === 'function') {
                                        try {
                                          const pickerResult = (input as any).showPicker();
                                          // Check if it returns a Promise
                                          if (pickerResult && typeof pickerResult.catch === 'function') {
                                            pickerResult.catch(() => {
                                              // Fallback to click if showPicker fails
                                              input.click();
                                            });
                                          } else {
                                            // If showPicker doesn't return a Promise, just use click
                                            input.click();
                                          }
                                        } catch (error) {
                                          // If showPicker throws, fallback to click
                                          input.click();
                                        }
                                      } else {
                                        // Fallback to click
                                        input.click();
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity relative z-10"
                                >
                                  <svg
                                    className="w-4 h-4 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  {task.plannedCompletionDate ? (
                                    <span className="text-gray-900 whitespace-nowrap">{formatDateDisplay(task.plannedCompletionDate)}</span>
                                  ) : (
                                    <span className="text-gray-500 whitespace-nowrap">End date</span>
                                  )}
                                </button>
                                <input
                                  ref={(el) => {
                                    endDateInputRefs.current[task.id] = el;
                                  }}
                                  type="date"
                                  value={taskFormData.plannedCompletionDate || ""}
                                  onChange={(e) => {
                                    updateFormField(task.id, "plannedCompletionDate", e.target.value || null);
                                    handleFieldSave(task.id, "plannedCompletionDate", e.target.value || null);
                                  }}
                                  className="absolute top-full left-0 mt-1 opacity-0 pointer-events-none"
                                  id={`end-date-${task.id}`}
                                  tabIndex={-1}
                                  style={{ width: '200px', height: '40px' }}
                                />
                              </div>
                            </div>

                            {/* Status badges */}
                            <div className="flex items-center gap-2">
                              {isDelayed && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded whitespace-nowrap">
                                  Delayed
                                </span>
                              )}
                              {isCompleted && (
                                <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded whitespace-nowrap">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description content (shown when expanded or in edit mode) */}
                        {(expandedDescriptions.has(task.id) || editingDescriptions.has(task.id)) && (
                          <div className={`${editingDescriptions.has(task.id) ? "mb-3" : task.description ? "mb-3" : ""}`}>
                            {editingDescriptions.has(task.id) ? (
                              <div className="flex items-end gap-2">
                                {/* Spacer to align with title field container (checkmark w-7 + gap-3 + owner w-7 + gap-2) */}
                                <div className="w-[4.75rem] flex-shrink-0"></div>
                                <div className="flex-1 min-w-0">
                                  <textarea
                                    value={formData[task.id]?.description ?? task.description ?? ""}
                                    onChange={(e) => updateFormField(task.id, "description", e.target.value)}
                                    onFocus={() => {
                                      ensureFormData(task);
                                      setEditingDescriptions((prev) => new Set(prev).add(task.id));
                                      // Mark that we entered edit mode directly via description
                                      setDescriptionFocusSource((prev) => ({ ...prev, [task.id]: "direct" }));
                                    }}
                                    onBlur={(e) => {
                                      handleDescriptionBlur(task.id, e);
                                      // Clear focus source after blur
                                      setDescriptionFocusSource((prev) => {
                                        const newSource = { ...prev };
                                        delete newSource[task.id];
                                        return newSource;
                                      });
                                    }}
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
                                    rows={3}
                                    placeholder="Add a description..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus={descriptionFocusSource[task.id] === "direct"}
                                  />
                                </div>
                                {/* Delete button in lower right corner during edit mode */}
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  disabled={loading || deletingTaskIds.has(task.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : task.description ? (
                              <p className="text-sm text-text-primary whitespace-pre-wrap ml-[5.625rem]">
                                {task.description}
                              </p>
                            ) : null}
                          </div>
                        )}

                        {/* Comments section (shown when expanded) */}
                        {expandedComments.has(task.id) && (
                          <div className="mb-3 ml-0 border-t border-gray-200 pt-3 mt-3">
                            <h4 className="text-sm font-semibold text-text-primary mb-3">Comments</h4>
                            
                            {/* Existing comments */}
                            {loadingComments.has(task.id) && (!comments[task.id] || comments[task.id].length === 0) ? (
                              <div className="text-sm text-text-secondary mb-3">Loading comments...</div>
                            ) : comments[task.id] && comments[task.id].length > 0 ? (
                              <div className="space-y-3 mb-4">
                                {comments[task.id].map((comment) => {
                                  const displayName = comment.createdBy.firstName && comment.createdBy.lastName
                                    ? `${comment.createdBy.firstName} ${comment.createdBy.lastName}`
                                    : comment.createdBy.firstName || comment.createdBy.lastName || comment.createdBy.name || comment.createdBy.email;
                                  const date = formatDateTimeISO(comment.createdAt);
                                  
                                  return (
                                    <div key={comment.id} className="bg-background-tertiary rounded-md p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-text-primary">
                                          {displayName}
                                        </span>
                                        <span className="text-xs text-text-secondary">{date}</span>
                                      </div>
                                      <div
                                        className="text-sm text-text-primary prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: comment.content }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-text-secondary mb-3">No comments yet.</div>
                            )}

                            {/* New comment form */}
                            <div className="space-y-3">
                              <WysiwygEditor
                                ref={(el) => {
                                  commentEditorRefs.current[task.id] = el;
                                }}
                                value={newCommentContent[task.id] || ""}
                                onChange={(value) => {
                                  setNewCommentContent((prev) => ({
                                    ...prev,
                                    [task.id]: value,
                                  }));
                                }}
                                placeholder="Add a comment... Use @ to mention team members"
                                projectMembers={projectMembers}
                                onSubmit={() => handleCreateComment(task.id)}
                              />
                              <div className="flex items-center justify-between">
                                <select
                                  value={newCommentNotifyOption[task.id] || "task_owner_mentions"}
                                  onChange={(e) => {
                                    setNewCommentNotifyOption((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value as "task_owner" | "task_owner_mentions" | "all_members" | "none",
                                    }));
                                  }}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded bg-background-secondary text-text-primary"
                                >
                                  <option value="task_owner">Task owner</option>
                                  <option value="task_owner_mentions">Task owner + @-mentions</option>
                                  <option value="all_members">All project members</option>
                                  <option value="none">None</option>
                                </select>
                                <button
                                  onClick={() => handleCreateComment(task.id)}
                                  disabled={loadingComments.has(task.id) || !newCommentContent[task.id]?.trim()}
                                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {loadingComments.has(task.id) ? "Posting..." : "Post comment"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </SortableTaskItem>
                );
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              sortedTasks.map((task) => {
                if (!task || !task.id) return null;
                
                const isDelayed = isTaskDelayed(task);
                const isCompleted = task.actualCompletionDate !== null;
                const owner = getOwnerDisplay(task);
                
                const taskFormData = formData[task.id] || {
                  name: task.name || "",
                  description: task.description || "",
                  ownerId: task.ownerId || null,
                  startDate: task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : null,
                  plannedCompletionDate: task.plannedCompletionDate ? new Date(task.plannedCompletionDate).toISOString().split("T")[0] : null,
                };

                const isNewlyCreated = newlyCreatedTaskId === task.id;
                
                return (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    isCompleted={isCompleted}
                    isDraggable={false}
                  >
                    {({ attributes: _attributes, listeners: _listeners }) => (
                    <div
                      ref={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      className={`
                        border-2 rounded-lg bg-background-secondary flex items-stretch overflow-hidden transition-all duration-500 ease-out
                        ${deletingTaskIds.has(task.id) ? "opacity-0 scale-95" : ""}
                        ${isNewlyCreated ? "border-primary-500 shadow-lg scale-105" : ""}
                        ${isDelayed && !isNewlyCreated && !deletingTaskIds.has(task.id) ? "border-red-400" : ""}
                        ${isCompleted && !isNewlyCreated ? "border-primary-400" : ""}
                        ${!isNewlyCreated && !isDelayed && !isCompleted ? "border-gray-200" : ""}
                      `}
                    >
                      {/* Left side panel - shows checkmark for completed */}
                      <div className={`${isCompleted ? 'bg-primary-500' : 'bg-primary-500'} text-white flex items-center justify-center min-w-[2.5rem] px-2 -ml-[2px] -mt-[2px] -mb-[2px] rounded-tl-lg rounded-bl-lg`}>
                        {isCompleted ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}
                      </div>

                      {/* Right side: Task content */}
                      <div className="flex-1 px-4 py-3 bg-background-tertiary">
                        <div className="flex items-center gap-3 mb-1">
                          {isCompleted && (
                            <button
                              onClick={() => handleReopen(task.id)}
                              disabled={loading}
                              className="flex-shrink-0 w-7 h-7 rounded-full border border-primary-300 bg-primary-100 flex items-center justify-center text-primary-600 hover:border-primary-500 hover:bg-primary-200 disabled:opacity-50 transition-colors"
                              title="Reopen task"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}

                          <div 
                            className="flex-shrink-0 relative"
                            onMouseEnter={() => setHoveredOwnerButtonId(task.id)}
                            onMouseLeave={() => setHoveredOwnerButtonId(null)}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const select = document.getElementById(`owner-select-${task.id}`);
                                select?.click();
                              }}
                              className={`rounded-full border flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-selection transition-colors relative z-10 ${
                                hoveredOwnerButtonId === task.id
                                  ? "border-selection"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                              title={owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : "No owner - click to assign"}
                            >
                              {owner ? (
                                <UserAvatar user={owner} size="xs" />
                              ) : (
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                              )}
                            </button>
                            <select
                              id={`owner-select-${task.id}`}
                              value={taskFormData.ownerId ?? ""}
                              onChange={(e) => {
                                updateFormField(task.id, "ownerId", e.target.value || null);
                                handleFieldSave(task.id, "ownerId", e.target.value || null);
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer z-20"
                            >
                              <option value="">No owner</option>
                              {projectMembers?.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName && member.lastName
                                    ? `${member.firstName} ${member.lastName}`
                                    : member.firstName || member.lastName || member.name || member.email}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {editingFields[task.id]?.has("name") ? (
                                <input
                                  type="text"
                                  value={taskFormData.name}
                                  onChange={(e) => updateFormField(task.id, "name", e.target.value)}
                                  onBlur={(e) => {
                                    handleFieldBlur(task.id, "name", e);
                                    // Clear focus source after blur
                                    setDescriptionFocusSource((prev) => {
                                      const newSource = { ...prev };
                                      delete newSource[task.id];
                                      return newSource;
                                    });
                                  }}
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
                                  className={`w-full px-2 py-1 rounded text-sm font-semibold border border-border-primary bg-background-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                    isCompleted ? "line-through" : ""
                                  }`}
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span
                                    className={`text-sm font-semibold px-2 py-1 ${
                                      isCompleted ? "line-through" : ""
                                    }`}
                                    onClick={() => {
                                      // Put all fields in edit mode when title is clicked
                                      ensureFormData(task);
                                      handleFieldFocus(task.id, "name", task);
                                      handleFieldFocus(task.id, "description", task);
                                      handleFieldFocus(task.id, "ownerId", task);
                                      handleFieldFocus(task.id, "startDate", task);
                                      handleFieldFocus(task.id, "plannedCompletionDate", task);
                                      // Expand description so it's visible for editing
                                      setExpandedDescriptions((prev) => new Set(prev).add(task.id));
                                      setEditingDescriptions((prev) => new Set(prev).add(task.id));
                                      // Mark that we entered edit mode via title click
                                      setDescriptionFocusSource((prev) => ({ ...prev, [task.id]: "title" }));
                                    }}
                                  >
                                    {taskFormData.name || task.name}
                                  </span>
                                  {/* Description icon - only show when description exists, inline after title */}
                                  {task.description && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDescription(task.id);
                                      }}
                                      className="flex-shrink-0 text-text-secondary hover:text-text-primary self-center"
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
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right-aligned icons: Comments and Dates */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Comment icon */}
                            {getCommentCount(task.id) > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(task.id);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background-secondary border border-border-primary hover:bg-background-primary transition-colors relative z-10"
                                title="Comments"
                              >
                                <svg
                                  className={`w-4 h-4 ${
                                    hasNewComments(task.id)
                                      ? "text-primary-600 fill-primary-600"
                                      : "text-gray-500 fill-gray-500"
                                  }`}
                                  fill="currentColor"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                                <span className="text-xs text-text-primary font-medium">
                                  {getCommentCount(task.id)}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleComments(task.id);
                                }}
                                className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity relative z-10"
                                title="Comments"
                              >
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Description content (shown when expanded or in edit mode) */}
                        {(expandedDescriptions.has(task.id) || editingDescriptions.has(task.id)) && (
                          <div className={`${editingDescriptions.has(task.id) ? "mb-3" : task.description ? "mb-3" : ""}`}>
                            {editingDescriptions.has(task.id) ? (
                              <div className="flex items-end gap-2">
                                {/* Spacer to align with title field container (checkmark w-7 + gap-3 + owner w-7 + gap-2) */}
                                <div className="w-[4.75rem] flex-shrink-0"></div>
                                <div className="flex-1 min-w-0">
                                  <textarea
                                    value={formData[task.id]?.description ?? task.description ?? ""}
                                    onChange={(e) => updateFormField(task.id, "description", e.target.value)}
                                    onFocus={() => {
                                      ensureFormData(task);
                                      setEditingDescriptions((prev) => new Set(prev).add(task.id));
                                      // Mark that we entered edit mode directly via description
                                      setDescriptionFocusSource((prev) => ({ ...prev, [task.id]: "direct" }));
                                    }}
                                    onBlur={(e) => {
                                      handleDescriptionBlur(task.id, e);
                                      // Clear focus source after blur
                                      setDescriptionFocusSource((prev) => {
                                        const newSource = { ...prev };
                                        delete newSource[task.id];
                                        return newSource;
                                      });
                                    }}
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
                                    rows={3}
                                    placeholder="Add a description..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus={descriptionFocusSource[task.id] === "direct"}
                                  />
                                </div>
                                {/* Delete button in lower right corner during edit mode */}
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  disabled={loading || deletingTaskIds.has(task.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : task.description ? (
                              <p className="text-sm text-text-primary whitespace-pre-wrap ml-[5.625rem]">
                                {task.description}
                              </p>
                            ) : null}
                          </div>
                        )}

                        {/* Comments section (shown when expanded) */}
                        {expandedComments.has(task.id) && (
                          <div className="mb-3 ml-0 border-t border-gray-200 pt-3 mt-3">
                            <h4 className="text-sm font-semibold text-text-primary mb-3">Comments</h4>
                            
                            {/* Existing comments */}
                            {loadingComments.has(task.id) && (!comments[task.id] || comments[task.id].length === 0) ? (
                              <div className="text-sm text-text-secondary mb-3">Loading comments...</div>
                            ) : comments[task.id] && comments[task.id].length > 0 ? (
                              <div className="space-y-3 mb-4">
                                {comments[task.id].map((comment) => {
                                  const displayName = comment.createdBy.firstName && comment.createdBy.lastName
                                    ? `${comment.createdBy.firstName} ${comment.createdBy.lastName}`
                                    : comment.createdBy.firstName || comment.createdBy.lastName || comment.createdBy.name || comment.createdBy.email;
                                  const date = formatDateTimeISO(comment.createdAt);
                                  
                                  return (
                                    <div key={comment.id} className="bg-background-tertiary rounded-md p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-text-primary">
                                          {displayName}
                                        </span>
                                        <span className="text-xs text-text-secondary">{date}</span>
                                      </div>
                                      <div
                                        className="text-sm text-text-primary prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: comment.content }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-text-secondary mb-3">No comments yet.</div>
                            )}

                            {/* New comment form */}
                            <div className="space-y-3">
                              <WysiwygEditor
                                ref={(el) => {
                                  commentEditorRefs.current[task.id] = el;
                                }}
                                value={newCommentContent[task.id] || ""}
                                onChange={(value) => {
                                  setNewCommentContent((prev) => ({
                                    ...prev,
                                    [task.id]: value,
                                  }));
                                }}
                                placeholder="Add a comment... Use @ to mention team members"
                                projectMembers={projectMembers}
                                onSubmit={() => handleCreateComment(task.id)}
                              />
                              <div className="flex items-center justify-between">
                                <select
                                  value={newCommentNotifyOption[task.id] || "task_owner_mentions"}
                                  onChange={(e) => {
                                    setNewCommentNotifyOption((prev) => ({
                                      ...prev,
                                      [task.id]: e.target.value as "task_owner" | "task_owner_mentions" | "all_members" | "none",
                                    }));
                                  }}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded bg-background-secondary text-text-primary"
                                >
                                  <option value="task_owner">Task owner</option>
                                  <option value="task_owner_mentions">Task owner + @-mentions</option>
                                  <option value="all_members">All project members</option>
                                  <option value="none">None</option>
                                </select>
                                <button
                                  onClick={() => handleCreateComment(task.id)}
                                  disabled={loadingComments.has(task.id) || !newCommentContent[task.id]?.trim()}
                                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {loadingComments.has(task.id) ? "Posting..." : "Post comment"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </SortableTaskItem>
                );
              })
            )}
          </>
        )}
      </div>
      {loading && (
        <div className="mt-4 text-center text-sm text-gray-600">Updating...</div>
      )}
    </div>
  );
}
