"use client";

import React from "react";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "./EmptyState";

export interface SearchableListProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClearSearch: () => void;
  children: React.ReactNode;
  itemCount: number;
  filteredCount: number;
  searchPlaceholder?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  className?: string;
}

export const SearchableList: React.FC<SearchableListProps> = ({
  query,
  onQueryChange,
  onClearSearch,
  children,
  itemCount,
  filteredCount,
  searchPlaceholder = "Search...",
  emptyStateTitle = "No results found",
  emptyStateDescription = "Try adjusting your search query",
  className = "",
}) => {
  const isSearching = query.trim().length > 0;
  const hasResults = filteredCount > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={onQueryChange}
            onClear={onClearSearch}
            placeholder={searchPlaceholder}
          />
        </div>
        {isSearching && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredCount} of {itemCount} {itemCount === 1 ? "item" : "items"}
          </div>
        )}
      </div>

      {!hasResults ? (
        <EmptyState
          icon={
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
          title={emptyStateTitle}
          description={isSearching ? emptyStateDescription : undefined}
        />
      ) : (
        children
      )}
    </div>
  );
};
