"use client";

import React from "react";
import { Dialog } from "./Dialog";

interface SlideOverProps {
  /** Whether the slide-over is open */
  open: boolean;
  /** Callback when slide-over should close */
  onClose: () => void;
  /** Slide-over title */
  title: string;
  /** Optional description */
  description?: string;
  /** Content of the slide-over */
  children: React.ReactNode;
  /** Footer content (buttons, etc.) */
  footer?: React.ReactNode;
  /** Size of the slide-over panel */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

/**
 * SlideOver is a pre-configured Dialog for form-based workflows.
 * It slides in from the right side of the screen.
 */
export function SlideOver({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: SlideOverProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant="slideOver"
      size={size}
      footer={footer}
      closeOnClickOutside={true}
      closeOnEscape={true}
    >
      {children}
    </Dialog>
  );
}

/* =================================================================
   Form-specific SlideOver
   ================================================================= */

interface FormSlideOverProps extends Omit<SlideOverProps, "footer" | "children"> {
  /** Form content */
  children: React.ReactNode;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Delete button text (only shown if onDelete is provided) */
  deleteText?: string;
  /** Form submission handler */
  onSubmit: () => void;
  /** Delete handler (optional - shows delete button if provided) */
  onDelete?: () => void;
  /** Whether form is submitting */
  isSubmitting?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Whether the form has unsaved changes */
  hasChanges?: boolean;
}

export function FormSlideOver({
  open,
  onClose,
  title,
  description,
  children,
  submitText = "Save",
  cancelText = "Cancel",
  deleteText = "Delete",
  onSubmit,
  onDelete,
  isSubmitting = false,
  isDeleting = false,
  hasChanges = false,
  size = "md",
}: FormSlideOverProps) {
  const handleClose = () => {
    if (hasChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      size={size}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between w-full gap-2">
          {/* Delete button on the left (if provided) */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting || isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : deleteText}
            </button>
          )}
          
          {/* Right side buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || isDeleting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-text-primary bg-background-secondary border border-border-primary rounded-md hover:bg-background-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || isDeleting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : submitText}
            </button>
          </div>
        </div>
      }
    >
      {children}
    </SlideOver>
  );
}
