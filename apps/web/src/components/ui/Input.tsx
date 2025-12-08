import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'search' | 'inline';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, variant = 'default', className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    const baseStyles = 'w-full rounded-md transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantStyles = {
      default: 'px-3 py-2 bg-background-primary text-text-primary border border-border-primary focus:ring-primary-500 focus:border-primary-500',
      search: 'pl-10 pr-3 py-2 bg-background-primary text-text-primary border border-border-primary focus:ring-primary-500 focus:border-primary-500',
      inline: 'px-2 py-1 bg-transparent text-text-primary border border-transparent hover:border-border-primary focus:border-border-primary focus:bg-background-primary focus:ring-primary-500',
    };
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text-primary mb-1">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${baseStyles} ${variantStyles[variant]} ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
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
  }
);

Input.displayName = 'Input';
