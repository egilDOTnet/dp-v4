import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-full whitespace-nowrap";

  const variantStyles = {
    default: "bg-background-tertiary text-text-primary",
    success: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
    warning:
      "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
    error: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
    info: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
