"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether the search is expandable (icon -> full input) */
  expandable?: boolean;
  /** Additional class names */
  className?: string;
  /** Auto focus when expanded */
  autoFocus?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    input: "h-8 text-sm",
    icon: "w-4 h-4",
    padding: "pl-8 pr-8",
    collapsedWidth: "w-8",
    expandedWidth: "w-48 sm:w-64",
  },
  md: {
    input: "h-10 text-sm",
    icon: "w-5 h-5",
    padding: "pl-10 pr-10",
    collapsedWidth: "w-10",
    expandedWidth: "w-56 sm:w-72",
  },
  lg: {
    input: "h-12 text-base",
    icon: "w-6 h-6",
    padding: "pl-12 pr-12",
    collapsedWidth: "w-12",
    expandedWidth: "w-64 sm:w-80",
  },
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  expandable = false,
  className = "",
  autoFocus = false,
  size = "md",
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isExpanded, setIsExpanded] = useState(!expandable || !!value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizes = sizeClasses[size];

  // Sync internal value with external value
  useEffect(() => {
    setInternalValue(value);
    if (value && expandable) {
      setIsExpanded(true);
    }
  }, [value, expandable]);

  // Debounced onChange
  const debouncedOnChange = useCallback(
    (newValue: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          onChange(newValue);
        }, debounceMs);
      } else {
        onChange(newValue);
      }
    },
    [onChange, debounceMs]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    debouncedOnChange(newValue);
  };

  // Handle clear
  const handleClear = () => {
    setInternalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  // Handle expand click
  const handleExpandClick = () => {
    setIsExpanded(true);
    // Focus after animation
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // Handle collapse on blur (only if expandable and no value)
  const handleBlur = () => {
    setIsFocused(false);
    if (expandable && !internalValue) {
      // Small delay to allow for click events
      setTimeout(() => {
        if (!inputRef.current?.matches(":focus")) {
          setIsExpanded(false);
        }
      }, 150);
    }
  };

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus search (when not already in an input)
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        if (expandable && !isExpanded) {
          setIsExpanded(true);
        }
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
      // Escape to clear and blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        if (internalValue) {
          handleClear();
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandable, isExpanded, internalValue]);

  // Auto focus on mount if specified
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Expandable collapsed state - just an icon button
  if (expandable && !isExpanded) {
    return (
      <button
        type="button"
        onClick={handleExpandClick}
        className={`
          ${sizes.collapsedWidth} ${sizes.input}
          flex items-center justify-center
          rounded-md border border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800
          text-gray-400 hover:text-gray-500 dark:hover:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-primary-500
          transition-all duration-200
          ${className}
        `}
        title="Search (press /)"
        aria-label="Open search"
      >
        <svg className={sizes.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`
        relative
        ${expandable ? `transition-all duration-200 ${isExpanded ? sizes.expandedWidth : sizes.collapsedWidth}` : "w-full"}
        ${className}
      `}
    >
      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg
          className={`${sizes.icon} text-gray-400 dark:text-gray-500`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`
          w-full ${sizes.input} ${sizes.padding}
          rounded-md border
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          ${isFocused
            ? "border-primary-500 ring-2 ring-primary-500"
            : "border-gray-300 dark:border-gray-600"
          }
          focus:outline-none
          transition-colors
        `}
        aria-label="Search"
      />

      {/* Clear button */}
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          aria-label="Clear search"
        >
          <svg className={sizes.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Keyboard hint */}
      {!internalValue && !isFocused && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            /
          </kbd>
        </div>
      )}
    </div>
  );
}
