"use client";

import { useState, useEffect, useRef } from "react";
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
import { api, RFIQuestionOption, RFIQuestionType } from "@/lib/api";

interface QuestionOptionManagerProps {
  questionId: string;
  questionType: RFIQuestionType;
  projectId: string;
}

interface SortableOptionItemProps {
  option: RFIQuestionOption;
  children: React.ReactNode;
}

function SortableOptionItem({ option, children }: SortableOptionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: option.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {children}
      </div>
    </div>
  );
}

export default function QuestionOptionManager({
  questionId,
  questionType,
  projectId,
}: QuestionOptionManagerProps) {
  const [options, setOptions] = useState<RFIQuestionOption[]>([]);
  const [error, setError] = useState("");
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const addRowInputRef = useRef<HTMLInputElement>(null);

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
    loadOptions();
  }, [questionId]);

  // Auto-focus add input after options reload (when adding a new option)
  useEffect(() => {
    if (showAddRow && addRowInputRef.current) {
      addRowInputRef.current.focus();
    }
  }, [showAddRow, options.length]);

  const loadOptions = async () => {
    try {
      const question = await api.rfi.questions.list(projectId);
      const currentQuestion = question.find((q) => q.id === questionId);
      if (currentQuestion?.options) {
        setOptions(currentQuestion.options);
      }
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load options");
    }
  };

  const handleAddRow = async () => {
    if (!newOptionLabel.trim()) {
      setError("Row label is required");
      return;
    }
    try {
      await api.rfi.questions.options.create(projectId, questionId, {
        label: newOptionLabel.trim(),
        value: null,
        xAxis: false,
        yAxis: isDropdown ? false : true, // For dropdown, don't set axis properties
      });
      setNewOptionLabel("");
      // Keep showAddRow true so user can continue adding options
      // Focus will be restored by useEffect after options reload
      await loadOptions();
    } catch (err: any) {
      setError(err.message || "Failed to add row");
    }
  };

  const handleAddColumn = async () => {
    if (!newOptionLabel.trim()) {
      setError("Column label is required");
      return;
    }
    try {
      await api.rfi.questions.options.create(projectId, questionId, {
        label: newOptionLabel.trim(),
        value: null,
        xAxis: true,
        yAxis: false,
      });
      setNewOptionLabel("");
      setShowAddColumn(false);
      await loadOptions();
    } catch (err: any) {
      setError(err.message || "Failed to add column");
    }
  };

  const handleUpdateOptionLabel = async (optionId: string, newLabel: string) => {
    const option = options.find((o) => o.id === optionId);
    if (!option || newLabel.trim() === option.label) {
      return;
    }
    try {
      await api.rfi.questions.options.update(projectId, questionId, optionId, {
        label: newLabel.trim(),
      });
      await loadOptions();
    } catch (err: any) {
      setError(err.message || "Failed to update option");
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    try {
      await api.rfi.questions.options.delete(projectId, questionId, optionId);
      await loadOptions();
    } catch (err: any) {
      setError(err.message || "Failed to delete option");
    }
  };

  const handleDragEnd = async (event: DragEndEvent, axis: "x" | "y") => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    let axisOptions: RFIQuestionOption[];
    if (isDropdown) {
      // For dropdown, use all options
      axisOptions = options;
    } else {
      axisOptions = axis === "x" 
        ? options.filter((o) => o.xAxis)
        : options.filter((o) => o.yAxis);
    }

    const oldIndex = axisOptions.findIndex((o) => o.id === active.id);
    const newIndex = axisOptions.findIndex((o) => o.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedOptions = arrayMove(axisOptions, oldIndex, newIndex);

    try {
      await api.rfi.questions.options.reorder(projectId, questionId, {
        optionIds: reorderedOptions.map((o) => o.id),
      });
      await loadOptions();
    } catch (err: any) {
      setError(err.message || "Failed to reorder options");
      await loadOptions();
    }
  };

  const startEditing = (optionId: string) => {
    const option = options.find((o) => o.id === optionId);
    if (option) {
      setEditingOptionId(optionId);
      setEditingLabel(option.label);
    }
  };

  const saveEditing = async (optionId: string) => {
    if (editingLabel.trim()) {
      await handleUpdateOptionLabel(optionId, editingLabel);
    }
    setEditingOptionId(null);
    setEditingLabel("");
  };

  const cancelEditing = () => {
    setEditingOptionId(null);
    setEditingLabel("");
  };

  const xAxisOptions = options.filter((o) => o.xAxis);
  const yAxisOptions = options.filter((o) => o.yAxis);
  
  // For Dropdown questions, use all options (single dimension list)
  const dropdownOptions = questionType === "Dropdown" ? options : [];

  // Only show for MultipleChoice and Dropdown questions
  if (questionType !== "MultipleChoice" && questionType !== "Dropdown") {
    return null;
  }

  const isDropdown = questionType === "Dropdown";

  return (
    <div 
      className="space-y-6 border-t pt-4 mt-4"
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      onBlur={(e) => e.stopPropagation()}
    >
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className={isDropdown ? "" : "grid grid-cols-2 gap-6"}>
        {/* Rows Section (or Options for Dropdown) */}
        <div className={isDropdown ? "w-1/3" : ""}>
          <h5 className="font-semibold mb-3">{isDropdown ? "Options" : "Rows"}</h5>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, "y")}
          >
            <SortableContext
              items={(isDropdown ? dropdownOptions : yAxisOptions).map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {(isDropdown ? dropdownOptions : yAxisOptions).map((option, index) => (
                  <SortableOptionItem key={option.id} option={option}>
                    <div className={isDropdown ? "flex items-center justify-between gap-1 group" : "flex items-center gap-2 group"}>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-sm flex-shrink-0">
                          {index + 1}.
                        </span>
                        {editingOptionId === option.id ? (
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onBlur={() => saveEditing(option.id)}
                            onKeyDown={(e) => {
                              // Handle Ctrl-A/Command-A to select all text
                              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                                e.preventDefault();
                                e.currentTarget.select();
                                return;
                              }
                              if (e.key === "Enter") {
                                saveEditing(option.id);
                              } else if (e.key === "Escape") {
                                cancelEditing();
                              }
                            }}
                            autoFocus
                            className={isDropdown ? "px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left" : "flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"}
                          />
                        ) : (
                          <span
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(option.id);
                            }}
                            className={isDropdown ? "text-gray-900 cursor-pointer hover:text-primary-600 transition-colors text-left px-2 py-1 border border-transparent" : "flex-1 text-gray-900 cursor-pointer hover:text-primary-600 transition-colors"}
                          >
                            {option.label}
                          </span>
                        )}
                      </div>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOption(option.id);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                        title={isDropdown ? "Delete option" : "Delete row"}
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </SortableOptionItem>
                ))}
                {showAddRow ? (
                  <div className={isDropdown ? "flex items-center gap-1" : "flex items-center gap-2"}>
                    <span className="text-gray-400 text-sm flex-shrink-0">
                      {(isDropdown ? dropdownOptions : yAxisOptions).length + 1}.
                    </span>
                    <input
                      ref={addRowInputRef}
                      type="text"
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        e.stopPropagation();
                        if (newOptionLabel.trim()) {
                          handleAddRow();
                        } else {
                          setShowAddRow(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        // Handle Ctrl-A/Command-A to select all text
                        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                          e.preventDefault();
                          e.currentTarget.select();
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRow();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setShowAddRow(false);
                          setNewOptionLabel("");
                        }
                      }}
                      placeholder={isDropdown ? "Option label" : "Row label"}
                      autoFocus
                      className={isDropdown ? "px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left" : "flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"}
                    />
                  </div>
                ) : (
                  <div className={isDropdown ? "flex items-center gap-1" : "flex items-center gap-2"}>
                    <span className="text-gray-400 text-sm flex-shrink-0">
                      {(isDropdown ? dropdownOptions : yAxisOptions).length + 1}.
                    </span>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddRow(true);
                      }}
                      className={isDropdown ? "text-sm text-gray-400 hover:text-primary-600 transition-colors text-left" : "text-sm text-gray-400 hover:text-primary-600 transition-colors"}
                    >
                      {isDropdown ? "Add option" : "Add row"}
                    </button>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Columns Section - only for MultipleChoice */}
        {!isDropdown && (
        <div>
          <h5 className="font-semibold mb-3">Columns</h5>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, "x")}
          >
            <SortableContext
              items={xAxisOptions.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {xAxisOptions.map((option) => (
                  <SortableOptionItem key={option.id} option={option}>
                    <div className="flex items-center gap-2 group">
                      <input
                        type="radio"
                        className="flex-shrink-0"
                        disabled
                      />
                      {editingOptionId === option.id ? (
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onBlur={() => saveEditing(option.id)}
                          onKeyDown={(e) => {
                            // Handle Ctrl-A/Command-A to select all text
                            if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                              e.preventDefault();
                              e.currentTarget.select();
                              return;
                            }
                            if (e.key === "Enter") {
                              saveEditing(option.id);
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      ) : (
                        <>
                          <span
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(option.id);
                            }}
                            className="flex-1 text-gray-900 cursor-pointer hover:text-primary-600 transition-colors"
                          >
                            {option.label}
                          </span>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOption(option.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity flex-shrink-0"
                            title="Delete column"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </SortableOptionItem>
                ))}
                {showAddColumn ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="flex-shrink-0"
                      disabled
                    />
                    <input
                      type="text"
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        e.stopPropagation();
                        if (newOptionLabel.trim()) {
                          handleAddColumn();
                        } else {
                          setShowAddColumn(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        // Handle Ctrl-A/Command-A to select all text
                        if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                          e.preventDefault();
                          e.currentTarget.select();
                          return;
                        }
                        if (e.key === "Enter" && newOptionLabel.trim()) {
                          e.preventDefault();
                          handleAddColumn();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setShowAddColumn(false);
                          setNewOptionLabel("");
                        }
                      }}
                      placeholder="Column label"
                      autoFocus
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ) : (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddColumn(true);
                    }}
                    className="text-sm text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-2"
                  >
                    <input
                      type="radio"
                      className="flex-shrink-0"
                      disabled
                    />
                    <span>Add column</span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        )}
      </div>
    </div>
  );
}

