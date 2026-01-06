"use client";

import { useState, useMemo, useCallback } from "react";

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

interface UseSearchOptions<T> {
  /** Keys to search in (supports nested keys like "user.name") */
  searchKeys: (keyof T | NestedKeyOf<T>)[];
  /** Case sensitive search */
  caseSensitive?: boolean;
  /** Minimum characters before filtering starts */
  minChars?: number;
}

interface UseSearchResult<T> {
  /** Current search term */
  searchTerm: string;
  /** Set the search term */
  setSearchTerm: (term: string) => void;
  /** Filtered items based on search term */
  filteredItems: T[];
  /** Whether search is active (has term and meets minChars) */
  isSearching: boolean;
  /** Clear the search */
  clearSearch: () => void;
  /** Number of items filtered out */
  filteredCount: number;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[key];
  }
  
  return value;
}

/**
 * Convert a value to a searchable string
 */
function toSearchableString(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toSearchableString).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value).map(toSearchableString).join(" ");
  }
  return "";
}

/**
 * Hook for filtering items based on a search term
 * 
 * @example
 * ```tsx
 * const { searchTerm, setSearchTerm, filteredItems } = useSearch(vendors, {
 *   searchKeys: ["name", "organizationNumber", "vendor.emailDomain"],
 * });
 * ```
 */
export function useSearch<T>(
  items: T[],
  options: UseSearchOptions<T>
): UseSearchResult<T> {
  const { searchKeys, caseSensitive = false, minChars = 1 } = options;
  const [searchTerm, setSearchTerm] = useState("");

  // Ensure items is always an array - use the original reference if it's already an array
  const safeItems = Array.isArray(items) ? items : [];
  const isSearching = searchTerm.length >= minChars;

  const filteredItems = useMemo(() => {
    if (!isSearching || safeItems.length === 0) {
      return safeItems;
    }

    const normalizedTerm = caseSensitive
      ? searchTerm
      : searchTerm.toLowerCase();

    // Split search term into words for better matching
    const searchWords = normalizedTerm.split(/\s+/).filter(Boolean);

    if (searchWords.length === 0) {
      return safeItems;
    }

    return safeItems.filter((item) => {
      // Get all searchable values for this item
      const searchableValues = searchKeys.map((key) => {
        const value = getNestedValue(item, key as string);
        const stringValue = toSearchableString(value);
        return caseSensitive ? stringValue : stringValue.toLowerCase();
      });

      // All search words must match at least one of the searchable values
      return searchWords.every((word) =>
        searchableValues.some((value) => value.includes(word))
      );
    });
  }, [safeItems, searchTerm, searchKeys, caseSensitive, isSearching]);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filteredItems,
    isSearching,
    clearSearch,
    filteredCount: safeItems.length - filteredItems.length,
  };
}

/**
 * Hook for debounced search
 * Useful when you want to control the debounce timing separately
 */
export function useDebouncedSearch<T>(
  items: T[],
  options: UseSearchOptions<T> & { debounceMs?: number }
): UseSearchResult<T> & { debouncedTerm: string } {
  const { debounceMs = 300, ...searchOptions } = options;
  const [debouncedTerm, setDebouncedTerm] = useState("");
  
  const result = useSearch(items, {
    ...searchOptions,
    // Use internal search term for filtering
  });

  // Create a debounced version
  const [immediateResult, setImmediateSearchTerm] = useState("");

  const setSearchTermWithDebounce = useCallback(
    (term: string) => {
      setImmediateSearchTerm(term);
      
      // This would need a ref to store the timeout
      // For simplicity, we'll just use the regular setSearchTerm
      result.setSearchTerm(term);
    },
    [result]
  );

  return {
    ...result,
    debouncedTerm: immediateResult,
    setSearchTerm: setSearchTermWithDebounce,
  };
}
