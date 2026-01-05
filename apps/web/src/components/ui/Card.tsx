"use client";

import React from "react";

export interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "interactive";
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  className = "",
  onClick,
}) => {
  const baseStyles =
    "bg-background-secondary rounded-lg shadow-sm border border-border-primary transition-all duration-150";

  const variantStyles = {
    default: "",
    interactive:
      "cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600",
  };

  const buttonResetStyles = onClick
    ? "w-full text-left p-0 m-0 font-inherit block appearance-none flex flex-col cursor-pointer"
    : "";

  const Component = onClick ? "button" : "div";

  return (
    <Component
      className={`${baseStyles} ${variantStyles[variant]} ${buttonResetStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </Component>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`px-6 py-4 border-b border-border-primary ${className}`}
    >
      {children}
    </div>
  );
};

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({
  children,
  className = "",
}) => {
  return <div className={`px-6 py-4 flex flex-col ${className}`}>{children}</div>;
};

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`px-6 py-4 border-t border-border-primary ${className}`}
    >
      {children}
    </div>
  );
};
