"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/* =================================================================
   Collapsible Component
   ================================================================= */

interface CollapsibleProps {
  /** Whether the section is initially open */
  defaultOpen?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element (clickable header) */
  trigger: React.ReactNode;
  /** Content to show when expanded */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Whether to persist state to localStorage */
  storageKey?: string;
  /** Disable the collapsible functionality */
  disabled?: boolean;
}

export function Collapsible({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  trigger,
  children,
  className = "",
  storageKey,
  disabled = false,
}: CollapsibleProps) {
  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(() => {
    // Check localStorage first if storageKey is provided
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(`collapsible-${storageKey}`);
      if (stored !== null) {
        return stored === "true";
      }
    }
    return defaultOpen;
  });

  const isOpen = isControlled ? controlledOpen : internalOpen;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Update content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  // Persist to localStorage
  useEffect(() => {
    if (storageKey && !isControlled) {
      localStorage.setItem(`collapsible-${storageKey}`, String(internalOpen));
    }
  }, [storageKey, internalOpen, isControlled]);

  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newState = !isOpen;
    
    if (!isControlled) {
      setInternalOpen(newState);
    }
    
    onOpenChange?.(newState);
  }, [disabled, isOpen, isControlled, onOpenChange]);

  return (
    <div className={className}>
      {/* Trigger */}
      <div
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-disabled={disabled}
        className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
      >
        {trigger}
      </div>

      {/* Content with animation */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? contentHeight : 0,
          opacity: isOpen ? 1 : 0,
        }}
        aria-hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}

/* =================================================================
   CollapsibleTrigger - Pre-styled trigger component
   ================================================================= */

interface CollapsibleTriggerProps {
  /** Title text */
  title: string;
  /** Subtitle/description text */
  subtitle?: string;
  /** Whether the section is open */
  isOpen: boolean;
  /** Additional class names */
  className?: string;
  /** Icon to show (optional, defaults to chevron) */
  icon?: React.ReactNode;
}

export function CollapsibleTrigger({
  title,
  subtitle,
  isOpen,
  className = "",
  icon,
}: CollapsibleTriggerProps) {
  return (
    <div
      className={`flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${className}`}
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="ml-4 flex-shrink-0">
        {icon || (
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

/* =================================================================
   DismissibleBanner - For hero banners and announcements
   ================================================================= */

interface DismissibleBannerProps {
  /** Unique key for localStorage persistence */
  storageKey: string;
  /** Banner content */
  children: React.ReactNode;
  /** Dismiss button text */
  dismissText?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
  /** Variant for styling */
  variant?: "info" | "success" | "warning" | "neutral";
}

const bannerVariantClasses = {
  info: "bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-700",
  success: "bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-primary-200 dark:border-primary-700",
  warning: "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700",
  neutral: "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-gray-200 dark:border-gray-700",
};

export function DismissibleBanner({
  storageKey,
  children,
  dismissText = "Got it",
  onDismiss,
  className = "",
  variant = "info",
}: DismissibleBannerProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`banner-${storageKey}-dismissed`) === "true";
    }
    return false;
  });
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsAnimatingOut(true);
    
    // Wait for animation to complete
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(`banner-${storageKey}-dismissed`, "true");
      onDismiss?.();
    }, 300);
  }, [storageKey, onDismiss]);

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`
        border rounded-lg p-6 shadow-sm
        transition-all duration-300 ease-out
        ${isAnimatingOut ? "opacity-0 -translate-y-4 h-0 p-0 overflow-hidden" : "opacity-100 translate-y-0"}
        ${bannerVariantClasses[variant]}
        ${className}
      `}
    >
      <div className="flex flex-col">
        <div className="flex-1">{children}</div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            {dismissText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   useCollapsible - Hook for external control
   ================================================================= */

interface UseCollapsibleOptions {
  /** Initial open state */
  defaultOpen?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

export function useCollapsible(options: UseCollapsibleOptions = {}) {
  const { defaultOpen = false, storageKey } = options;

  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(`collapsible-${storageKey}`);
      if (stored !== null) {
        return stored === "true";
      }
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`collapsible-${storageKey}`, String(isOpen));
    }
  }, [storageKey, isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    toggle,
    open,
    close,
    setIsOpen,
  };
}
