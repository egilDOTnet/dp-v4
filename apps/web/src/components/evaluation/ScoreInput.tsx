"use client";

import { useState, useRef, useEffect } from "react";

interface ScoreInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function ScoreInput({
  value,
  onChange,
  placeholder = "Click to score",
  className = "",
}: ScoreInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Use setTimeout to ensure the input is in the DOM and can receive focus
      const timeoutId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing]);

  const handleClick = () => {
    setIsEditing(true);
    setInputValue(value?.toString() || "");
  };

  const handleBlur = () => {
    setIsEditing(false);
    const numValue = inputValue.trim() === "" ? null : parseInt(inputValue, 10);
    if (numValue !== null && (numValue < 1 || numValue > 5)) {
      // Invalid score, revert
      setInputValue(value?.toString() || "");
      return;
    }
    // Only call onChange if the value has actually changed
    if (numValue !== value) {
      onChange(numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setInputValue(value?.toString() || "");
      setIsEditing(false);
    }
    // Allow Tab to move to next field naturally (default behavior)
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty, or numbers 1-5
    if (val === "" || /^[1-5]$/.test(val)) {
      setInputValue(val);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-12 h-8 text-center border border-primary-600 rounded-full px-2 py-1 ${className}`}
        maxLength={1}
      />
    );
  }

  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    // Automatically enter edit mode when focused via Tab
    // This ensures the input is ready to receive keyboard input immediately
    if (!isEditing) {
      setIsEditing(true);
      setInputValue(value?.toString() || "");
    }
    // Ensure focus event bubbles to parent (td element)
    // This allows the parent to track which cell is focused
  };

  return (
    <div
      onClick={handleClick}
      onFocus={handleFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        } else if (/^[1-5]$/.test(e.key)) {
          // If a number key is pressed while div is focused, enter edit mode and set the value
          e.preventDefault();
          setIsEditing(true);
          setInputValue(e.key);
          // The useEffect will focus the input and select the text
          // When the input blurs (e.g., on Tab), it will save the value
        }
        // Tab key: when Tab focuses the div, onFocus enters edit mode
        // The useEffect will then focus the input, and Tab on the input will move to next field
      }}
      tabIndex={0}
      role="button"
      aria-label={`Score: ${value !== null ? value : "not set"}`}
      className={`cursor-pointer w-12 h-8 rounded-full border border-border-primary hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600 text-center flex items-center justify-center ${className}`}
    >
      {value !== null ? <span>{value}</span> : <span className="text-text-tertiary">{placeholder}</span>}
    </div>
  );
}

