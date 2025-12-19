"use client";

import React from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = "",
}) => {
  return (
    <nav className={`mb-4 text-sm text-text-secondary ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-primary-600">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-text-primary" : ""}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="mx-2">/</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
