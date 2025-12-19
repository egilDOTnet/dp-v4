import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
  className = "",
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {breadcrumbs && <div>{breadcrumbs}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
};
