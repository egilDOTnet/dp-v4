"use client";

import React, { useState, useRef } from "react";

export interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: "",
  onValueChange: () => {},
});

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  className = "",
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<TabsListProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  className = "",
}) => {
  const context = React.useContext(TabsContext);
  const isActive = context.value === value;
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    context.onValueChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      context.onValueChange(value);
    }
  };

  return (
    <button
      ref={buttonRef}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tab-content-${value}`}
      id={`tab-trigger-${value}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        px-4 py-2 text-sm font-medium transition-colors duration-150
        border-b-2 -mb-px
        focus:outline-none
        cursor-pointer
        ${
          isActive
            ? "border-primary-600 text-primary-600"
            : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-secondary"
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = "",
}) => {
  const context = React.useContext(TabsContext);
  const isActive = context.value === value;

  if (!isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tab-content-${value}`}
      aria-labelledby={`tab-trigger-${value}`}
      className={`mt-6 ${className}`}
    >
      {children}
    </div>
  );
};

