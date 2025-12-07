"use client";

import { useState, useRef, useEffect } from "react";
import { Task, api, Project } from "@/lib/api";
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
  children: React.ReactNode;
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
    return <div>{children}</div>;
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle - grip pattern (::), appears on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-5 top-1/2 -translate-y-1/2 w-2.5 flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:opacity-100"
        title="Drag to reorder"
      >
        {/* Four rows of two dots each (2x4 grid) */}
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

export default function TaskList({
  projectId,
  phaseId,
  tasks,
  projectMembers,
  onTaskUpdate,
  phaseTitle,
}: TaskListProps) {
  const [filter, setFilter] = useState<FilterType>("remaining");
  const [isCreatingNewTask, setIsCreatingNewTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newlyCreatedTaskId, setNewlyCreatedTaskId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [formData, setFormData] = useState<Record<string, TaskFormData>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [editingDescriptions, setEditingDescriptions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
  const [isNewTaskAnimating, setIsNewTaskAnimating] = useState(false);
  const [hoveredOwnerButtonId, setHoveredOwnerButtonId] = useState<string | null>(null);
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startDateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const endDateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split("T")[0];
  };

  const formatDateDisplay = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
            updatePayload.startDate = date.toISOString().split("T")[0];
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
            updatePayload.plannedCompletionDate = date.toISOString().split("T")[0];
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

  const handleDescriptionClick = (task: Task) => {
    ensureFormData(task);
    if (!task.description) {
      // No description, go directly to edit mode
      setEditingDescriptions((prev) => new Set(prev).add(task.id));
      setExpandedDescriptions((prev) => new Set(prev).add(task.id));
    } else {
      // Has description, toggle show/hide
      toggleDescription(task.id);
    }
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
        handleFieldSave(taskId, "description", data.description);
      }
    }, 150);

    saveTimeouts.current[timeoutKey] = delayedSaveTimeout;
  };

  const getInitials = (user: { firstName: string | null; lastName: string | null; name: string | null }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user.lastName) {
      return user.lastName[0].toUpperCase();
    }
    if (user.name) {
      const parts = user.name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.name[0].toUpperCase();
    }
    return "?";
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
      const today = new Date().toISOString().split("T")[0];
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
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
                  : "bg-white text-gray-700 hover:bg-gray-50"
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
                  : "bg-white text-gray-700 hover:bg-gray-50"
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
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All Tasks
            </button>
          </div>
          <button
            onClick={handleStartNewTask}
            disabled={isCreatingNewTask}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
          >
            New Task
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        {/* New Task - Inline Edit Mode */}
        {isCreatingNewTask && (
          <div
            className={`border rounded-lg p-4 border-gray-200 transition-all duration-300 ease-out ${
              isNewTaskAnimating
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-4"
            }`}
          >
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
                className="flex-1 min-w-0 px-2 py-1 rounded text-sm font-semibold border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                const isDescriptionExpanded = expandedDescriptions.has(task.id);
                const isDescriptionEditing = editingDescriptions.has(task.id);
                
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
                    <div
                      ref={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      className={`
                        border rounded-lg p-4 transition-all duration-300 ease-out
                        ${isCompleting ? "opacity-0 scale-95" : ""}
                        ${isNewlyCreated ? "border-primary-500 bg-primary-50 shadow-lg scale-105" : ""}
                        ${isDragging ? "opacity-50 shadow-md" : ""}
                        ${isDelayed && !isNewlyCreated && !isDragging && !isCompleting ? "border-red-300 bg-red-50" : ""}
                        ${isCompleted && !isNewlyCreated && !isDragging ? "border-green-300 bg-green-50" : ""}
                        ${!isNewlyCreated && !isDelayed && !isCompleted && !isDragging && !isCompleting ? "border-gray-200" : ""}
                      `}
                    >
                <div className="flex items-center gap-3 mb-1">
                  {/* Checkmark button for marking as done */}
                  {!isCompleted && (
                    <button
                      onClick={() => handleMarkAsDone(task.id)}
                      disabled={loading}
                      className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 hover:border-green-500 hover:bg-green-50 disabled:opacity-50 transition-colors"
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
                      className="flex-shrink-0 w-7 h-7 rounded-full border border-green-300 bg-green-100 flex items-center justify-center text-green-600 hover:border-green-500 hover:bg-green-200 disabled:opacity-50 transition-colors"
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
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors relative z-10 ${
                        hoveredOwnerButtonId === task.id
                          ? "border-primary-500 bg-primary-50 text-gray-600"
                          : "border-gray-300 bg-gray-100 text-gray-600"
                      }`}
                      title={owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : "No owner - click to assign"}
                    >
                      {owner ? (
                        <span className="text-[10px]">{getInitials(owner)}</span>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
                  <input
                    type="text"
                    value={taskFormData.name}
                    onChange={(e) => updateFormField(task.id, "name", e.target.value)}
                    onFocus={() => handleFieldFocus(task.id, "name", task)}
                    onBlur={(e) => handleFieldBlur(task.id, "name", e)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.currentTarget.blur();
                      }
                    }}
                    className={`flex-1 min-w-0 px-2 py-1 rounded text-sm font-semibold border ${
                      editingFields[task.id]?.has("name")
                        ? "border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        : "border-transparent bg-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-gray-300 focus:bg-white"
                    } ${
                      isCompleted ? "line-through" : ""
                    }`}
                  />

                  {/* Right-aligned icons: Description and Dates */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Description icon */}
                    <button
                      type="button"
                      onClick={() => handleDescriptionClick(task)}
                      className="flex-shrink-0 text-gray-500 hover:text-gray-700"
                      title="Description"
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
                            <span className="text-gray-900 whitespace-nowrap">{formatDateDisplay(task.startDate)}</span>
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
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded whitespace-nowrap">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description content (shown when expanded) */}
                {isDescriptionExpanded && (
                  <div className="mb-3 ml-10">
                    {isDescriptionEditing ? (
                      <textarea
                        value={formData[task.id]?.description ?? task.description ?? ""}
                        onChange={(e) => updateFormField(task.id, "description", e.target.value)}
                        onFocus={() => {
                          ensureFormData(task);
                          setEditingDescriptions((prev) => new Set(prev).add(task.id));
                        }}
                        onBlur={(e) => handleDescriptionBlur(task.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.currentTarget.blur();
                          }
                        }}
                        rows={3}
                        placeholder="Add a description..."
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:text-gray-900"
                        onClick={() => {
                          ensureFormData(task);
                          setEditingDescriptions((prev) => new Set(prev).add(task.id));
                        }}
                      >
                        {task.description || "Click to add description"}
                      </p>
                    )}
                  </div>
                )}
                    </div>
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
                    <div
                      ref={(el) => {
                        taskRefs.current[task.id] = el;
                      }}
                      className={`
                        border rounded-lg p-4 transition-all duration-500 ease-out
                        ${isNewlyCreated ? "border-primary-500 bg-primary-50 shadow-lg scale-105" : ""}
                        ${isDelayed && !isNewlyCreated ? "border-red-300 bg-red-50" : ""}
                        ${isCompleted && !isNewlyCreated ? "border-green-300 bg-green-50" : ""}
                        ${!isNewlyCreated && !isDelayed && !isCompleted ? "border-gray-200" : ""}
                      `}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        {isCompleted && (
                          <button
                            onClick={() => handleReopen(task.id)}
                            disabled={loading}
                            className="flex-shrink-0 w-7 h-7 rounded-full border border-green-300 bg-green-100 flex items-center justify-center text-green-600 hover:border-green-500 hover:bg-green-200 disabled:opacity-50 transition-colors"
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
                            className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors relative z-10 ${
                              hoveredOwnerButtonId === task.id
                                ? "border-primary-500 bg-primary-50 text-gray-600"
                                : "border-gray-300 bg-gray-100 text-gray-600"
                            }`}
                            title={owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : "No owner - click to assign"}
                          >
                            {owner ? (
                              <span className="text-[10px]">{getInitials(owner)}</span>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

                        <input
                          type="text"
                          value={taskFormData.name}
                          onChange={(e) => updateFormField(task.id, "name", e.target.value)}
                          onFocus={() => handleFieldFocus(task.id, "name", task)}
                          onBlur={(e) => handleFieldBlur(task.id, "name", e)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.currentTarget.blur();
                            }
                          }}
                          className={`flex-1 min-w-0 px-2 py-1 rounded text-sm font-semibold border ${
                            editingFields[task.id]?.has("name")
                              ? "border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              : "border-transparent bg-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-gray-300 focus:bg-white"
                          } ${isCompleted ? "line-through" : ""}`}
                        />
                      </div>
                    </div>
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
