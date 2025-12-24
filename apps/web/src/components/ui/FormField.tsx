"use client";

import React, { useId } from "react";

/* =================================================================
   Base Input Styles
   ================================================================= */

const baseInputClasses = `
  w-full px-3 py-2 
  border rounded-md 
  text-text-primary
  bg-background-secondary
  border-border-primary
  placeholder-text-tertiary
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
  disabled:bg-background-tertiary disabled:cursor-not-allowed disabled:opacity-60
  transition-colors
`.trim().replace(/\s+/g, " ");

const errorInputClasses = `
  border-red-500 dark:border-red-500
  focus:ring-red-500 focus:border-red-500
`.trim().replace(/\s+/g, " ");

/* =================================================================
   FormField Wrapper Component
   ================================================================= */

interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text to display below the input */
  helperText?: string;
  /** Additional class names for the wrapper */
  className?: string;
  /** Children (the input element) */
  children: React.ReactNode;
  /** ID for the input (auto-generated if not provided) */
  htmlFor?: string;
}

export function FormField({
  label,
  required = false,
  error,
  helperText,
  className = "",
  children,
  htmlFor,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = htmlFor || generatedId;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-primary"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id: inputId,
            "aria-invalid": !!error,
            "aria-describedby": error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined,
          })
        : children}
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p
          id={`${inputId}-helper`}
          className="text-sm text-text-secondary"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/* =================================================================
   Input Component
   ================================================================= */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Whether the input has an error */
  hasError?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export const Input: React.FC<InputProps> = ({ className = "", hasError = false, onKeyDown, ref, ...props }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle Ctrl-A/Command-A to select all text
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const input = e.currentTarget;
        input.select();
      }
      onKeyDown?.(e);
    };

    return (
      <input
        ref={ref}
        className={`${baseInputClasses} ${hasError ? errorInputClasses : ""} ${className}`}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
};
Input.displayName = "Input";

/* =================================================================
   Textarea Component
   ================================================================= */

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether the textarea has an error */
  hasError?: boolean;
  /** Whether to auto-resize based on content */
  autoResize?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export const Textarea: React.FC<TextareaProps> = ({ className = "", hasError = false, autoResize = false, onChange, onKeyDown, ref, ...props }) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }
      onChange?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Ctrl-A/Command-A to select all text
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const textarea = e.currentTarget;
        textarea.select();
      }
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={ref}
        className={`${baseInputClasses} ${hasError ? errorInputClasses : ""} ${
          autoResize ? "resize-none overflow-hidden" : ""
        } ${className}`}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
};
Textarea.displayName = "Textarea";

/* =================================================================
   Select Component
   ================================================================= */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Whether the select has an error */
  hasError?: boolean;
  /** Placeholder option text */
  placeholder?: string;
  /** Options to render */
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  ref?: React.Ref<HTMLSelectElement>;
}

export const Select: React.FC<SelectProps> = ({ className = "", hasError = false, placeholder, options, children, ref, ...props }) => {
    return (
      <select
        ref={ref}
        className={`${baseInputClasses} ${hasError ? errorInputClasses : ""} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options
          ? options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))
          : children}
      </select>
    );
};
Select.displayName = "Select";

/* =================================================================
   Checkbox Component
   ================================================================= */

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Label for the checkbox */
  label?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export const Checkbox: React.FC<CheckboxProps> = ({ className = "", label, id, ref, ...props }) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;

    return (
      <div className={`flex items-center ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          className="h-4 w-4 rounded border-border-primary text-primary-600 focus:ring-primary-500 bg-background-secondary"
          {...props}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-2 text-sm text-text-primary"
          >
            {label}
          </label>
        )}
      </div>
    );
};
Checkbox.displayName = "Checkbox";

/* =================================================================
   Button Component
   ================================================================= */

type ButtonVariant = "primary" | "secondary" | "danger" | "destructive" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
  /** Full width */
  fullWidth?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 border-transparent",
  secondary:
    "bg-background-secondary text-text-primary hover:bg-background-tertiary focus:ring-primary-500 border-border-primary",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent",
  ghost:
    "bg-transparent text-text-primary hover:bg-background-tertiary focus:ring-primary-500 border-transparent",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button: React.FC<ButtonProps> = (
  {
    className = "",
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    children,
    ref,
    ...props
  }
) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-md border
          focus:outline-none focus:ring-2 focus:ring-offset-2
          cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${buttonVariantClasses[variant]}
          ${buttonSizeClasses[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `.trim().replace(/\s+/g, " ")}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
};
Button.displayName = "Button";
