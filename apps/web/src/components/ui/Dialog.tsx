"use client";

import React, { useEffect, useRef, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";

/* =================================================================
   Types
   ================================================================= */

export type DialogVariant = "modal" | "slideOver";
export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

interface DialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Dialog variant: modal (centered) or slideOver (from right) */
  variant?: DialogVariant;
  /** Dialog size */
  size?: DialogSize;
  /** Content of the dialog */
  children: React.ReactNode;
  /** Footer content (buttons, etc.) */
  footer?: React.ReactNode;
  /** Whether clicking outside closes the dialog */
  closeOnClickOutside?: boolean;
  /** Whether pressing Escape closes the dialog */
  closeOnEscape?: boolean;
  /** Custom class name for the dialog panel */
  className?: string;
}

interface DialogHeaderProps {
  title?: string;
  description?: string;
  onClose: () => void;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

/* =================================================================
   Size Mappings
   ================================================================= */

const sizeClasses: Record<DialogVariant, Record<DialogSize, string>> = {
  modal: {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  },
  slideOver: {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-2xl",
  },
};

/* =================================================================
   Sub-components
   ================================================================= */

function DialogHeader({ title, description, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-start justify-between p-4 sm:p-6 border-b border-border-primary">
      <div className="flex-1 pr-4">
        {title && (
          <h2 className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-1 text-sm text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-2 text-text-tertiary hover:text-text-secondary hover:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
        aria-label="Close"
      >
        <svg
          className="h-5 w-5"
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
  );
}

function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 sm:p-6 border-t border-border-primary bg-background-secondary">
      {children}
    </div>
  );
}

/* =================================================================
   Main Dialog Component
   ================================================================= */

export function Dialog({
  open,
  onClose,
  title,
  description,
  variant = "modal",
  size = "md",
  children,
  footer,
  closeOnClickOutside = true,
  closeOnEscape = true,
  className = "",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnClickOutside && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnClickOutside, onClose]
  );

  // Focus management and body scroll lock
  useEffect(() => {
    if (open) {
      // Store the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Lock body scroll
      document.body.style.overflow = "hidden";

      // Add escape key listener
      document.addEventListener("keydown", handleKeyDown);

      // Focus the first focusable element in the dialog
      requestAnimationFrame(() => {
        const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements?.[0];
        if (firstFocusable) {
          firstFocusable.focus();
        }
      });
    }

    return () => {
      if (open) {
        // Restore body scroll
        document.body.style.overflow = "";

        // Remove escape key listener
        document.removeEventListener("keydown", handleKeyDown);

        // Restore focus to previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      }
    };
  }, [open, handleKeyDown]);

  // Don't render if not open (but keep in DOM for animations)
  if (typeof window === "undefined") {
    return null;
  }

  const dialog = (
    <Fragment>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-black/50 dark:bg-black/70" />
      </div>

      {/* Dialog container */}
      <div
        className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
      >
        {variant === "modal" ? (
          /* Modal variant - centered */
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              ref={dialogRef}
              className={`
                relative w-full ${sizeClasses.modal[size]} 
                transform rounded-lg bg-background-secondary shadow-xl 
                transition-all duration-300
                ${open ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"}
                ${className}
              `}
            >
              {(title || description) && (
                <DialogHeader
                  title={title}
                  description={description}
                  onClose={onClose}
                />
              )}
              <div className="p-4 sm:p-6">{children}</div>
              {footer && <DialogFooter>{footer}</DialogFooter>}
            </div>
          </div>
        ) : (
          /* SlideOver variant - from right */
          <div className="flex min-h-full justify-end">
            <div
              ref={dialogRef}
              className={`
                relative w-full ${sizeClasses.slideOver[size]}
                transform bg-background-secondary shadow-xl 
                transition-transform duration-300 ease-out
                ${open ? "translate-x-0" : "translate-x-full"}
                h-full overflow-y-auto
                ${className}
              `}
            >
              {(title || description) && (
                <DialogHeader
                  title={title}
                  description={description}
                  onClose={onClose}
                />
              )}
              <div className="p-4 sm:p-6 flex-1">{children}</div>
              {footer && <DialogFooter>{footer}</DialogFooter>}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );

  return createPortal(dialog, document.body);
}

/* =================================================================
   Convenience Exports
   ================================================================= */

export { DialogHeader, DialogFooter };

/* =================================================================
   Pre-configured Dialog Variants
   ================================================================= */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  loading = false,
}: ConfirmDialogProps) {
  const variantClasses = {
    danger:
      "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    warning:
      "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 text-white",
    info: "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 text-white",
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-text-primary bg-background-secondary border border-border-primary rounded-md hover:bg-background-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${variantClasses[variant]}`}
          >
            {loading ? "Loading..." : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">{message}</p>
    </Dialog>
  );
}
