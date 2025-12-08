import React, { useEffect, useRef } from 'react';

export interface InlineEditWrapperProps {
  isOpen: boolean;
  isAnimating: boolean;
  children: React.ReactNode;
  className?: string;
  autoFocus?: boolean;
}

export const InlineEditWrapper: React.FC<InlineEditWrapperProps> = ({
  isOpen,
  isAnimating,
  children,
  className = '',
  autoFocus = true,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-focus first input when opened
  useEffect(() => {
    if (isOpen && autoFocus && wrapperRef.current) {
      const firstInput = wrapperRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      
      if (firstInput) {
        // Small delay to ensure animation has started
        setTimeout(() => {
          firstInput.focus();
        }, 100);
      }
    }
  }, [isOpen, autoFocus]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={wrapperRef}
      className={`
        transition-all duration-300 ease-out
        ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
