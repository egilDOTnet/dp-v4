import React, { useEffect, useRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  autoGrow?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, hint, autoGrow = false, className = '', id, ref, ...props }) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
    
    const baseStyles = 'w-full px-3 py-2 rounded-md bg-background-primary text-text-primary border border-border-primary transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none';
    
    // Auto-grow functionality
    useEffect(() => {
      if (autoGrow && textareaRef.current) {
        const textarea = textareaRef.current;
        const adjustHeight = () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        };
        adjustHeight();
        textarea.addEventListener('input', adjustHeight);
        return () => textarea.removeEventListener('input', adjustHeight);
      }
    }, [autoGrow, props.value, textareaRef]);
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-text-primary mb-1">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={textareaRef}
          id={textareaId}
          className={`${baseStyles} ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-error-600 dark:text-error-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
};

Textarea.displayName = 'Textarea';
