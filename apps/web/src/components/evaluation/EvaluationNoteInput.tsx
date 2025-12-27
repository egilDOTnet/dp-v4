"use client";

import { useState, useRef, useEffect } from "react";

interface EvaluationNoteInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function EvaluationNoteInput({
  value,
  onChange,
  placeholder = "Add note...",
  className = "",
}: EvaluationNoteInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local state with value prop when it changes
  // When not editing, always sync. When editing, only sync if value becomes null/empty (user cleared it externally)
  useEffect(() => {
    if (!isEditing) {
      // Always sync when not editing - this handles cell switches
      setInputValue(value || "");
    } else if (value === null || value === "") {
      // If value is cleared externally while editing, sync it
      setInputValue("");
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Save unsaved changes on unmount (only if actively editing)
  const isEditingRef = useRef(isEditing);
  const inputValueRef = useRef(inputValue);
  const onChangeRef = useRef(onChange);
  
  // Keep refs in sync
  useEffect(() => {
    isEditingRef.current = isEditing;
    inputValueRef.current = inputValue;
    onChangeRef.current = onChange;
  }, [isEditing, inputValue, onChange]);
  
  useEffect(() => {
    return () => {
      // On unmount, only save if we're currently editing
      // If not editing, blur should have already saved
      if (isEditingRef.current) {
        const trimmed = inputValueRef.current.trim();
        onChangeRef.current(trimmed === "" ? null : trimmed);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run cleanup on unmount

  const handleClick = () => {
    setIsEditing(true);
    setInputValue(value || "");
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = inputValue.trim();
    onChange(trimmed === "" ? null : trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setInputValue(value || "");
      setIsEditing(false);
      textareaRef.current?.blur();
    }
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full border border-primary-600 rounded px-2 py-1 min-h-[60px] ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer px-3 py-2 rounded border border-border-primary hover:border-primary-600 min-h-[60px] ${className}`}
    >
      {value ? (
        <div className="text-text-primary whitespace-pre-wrap">{value}</div>
      ) : (
        <span className="text-text-tertiary">{placeholder}</span>
      )}
    </div>
  );
}

