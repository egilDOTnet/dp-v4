"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Button } from "./FormField";

export interface EntityFormProps {
  /** Whether this is editing an existing entity (vs creating new) */
  isEdit?: boolean;
  /** Form is currently saving */
  isSaving?: boolean;
  /** Error message to display */
  error?: string;
  /** Called when save button is clicked or Enter is pressed */
  onSave: () => void;
  /** Called when cancel button is clicked or Escape is pressed */
  onCancel: () => void;
  /** Called when delete button is clicked (only shown in edit mode) */
  onDelete?: () => void;
  /** Save button text */
  saveLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Delete button text */
  deleteLabel?: string;
  /** Whether to show the delete button */
  showDelete?: boolean;
  /** Whether to auto-focus the first input */
  autoFocus?: boolean;
  /** Additional class names */
  className?: string;
  /** Form content */
  children: React.ReactNode;
}

/**
 * EntityForm provides a unified wrapper for New and Edit forms with:
 * - Consistent button layout (Save, Cancel, Delete)
 * - Auto-focus first input
 * - Keyboard shortcuts (Enter to save, Escape to cancel)
 * - Loading and error states
 */
export const EntityForm: React.FC<EntityFormProps> = ({
  isEdit = false,
  isSaving = false,
  error,
  onSave,
  onCancel,
  onDelete,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  deleteLabel = "Delete",
  showDelete = true,
  autoFocus = true,
  className = "",
  children,
}) => {
  const formRef = useRef<HTMLDivElement>(null);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && formRef.current) {
      const firstInput = formRef.current.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );

      if (firstInput) {
        // Small delay to ensure the form is rendered
        setTimeout(() => {
          firstInput.focus();
        }, 50);
      }
    }
  }, [autoFocus]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSaving) return;

      // Escape to cancel
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      // Enter to save (only for non-textarea elements)
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        // Check if Ctrl/Cmd is pressed for explicit save
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSave();
        }
      }
    },
    [isSaving, onSave, onCancel]
  );

  const handleDelete = () => {
    if (onDelete && window.confirm("Are you sure you want to delete this?")) {
      onDelete();
    }
  };

  return (
    <div
      ref={formRef}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Form Content */}
      <div className="space-y-4">{children}</div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={onSave}
            loading={isSaving}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : saveLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            {cancelLabel}
          </Button>
        </div>

        {isEdit && showDelete && onDelete && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isSaving}
          >
            {deleteLabel}
          </Button>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
          Esc
        </kbd>{" "}
        to cancel
        <span className="mx-2">·</span>
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
          ⌘
        </kbd>
        +
        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
          Enter
        </kbd>{" "}
        to save
      </div>
    </div>
  );
};
