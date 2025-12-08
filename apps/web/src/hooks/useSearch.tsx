import React, { useState, useMemo, useCallback } from 'react';

export interface UseSearchOptions<T> {
  items: T[];
  searchFields: (keyof T | ((item: T) => string))[];
  caseSensitive?: boolean;
}

export interface UseSearchReturn<T> {
  query: string;
  setQuery: (query: string) => void;
  filteredItems: T[];
  clearSearch: () => void;
  isSearching: boolean;
}

export function useSearch<T>({
  items,
  searchFields,
  caseSensitive = false,
}: UseSearchOptions<T>): UseSearchReturn<T> {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items;
    }

    const searchTerm = caseSensitive ? query : query.toLowerCase();

    return items.filter((item) => {
      return searchFields.some((field) => {
        let value: string;

        if (typeof field === 'function') {
          value = field(item);
        } else {
          const fieldValue = item[field];
          value = fieldValue != null ? String(fieldValue) : '';
        }

        if (!caseSensitive) {
          value = value.toLowerCase();
        }

        return value.includes(searchTerm);
      });
    });
  }, [items, query, searchFields, caseSensitive]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    filteredItems,
    clearSearch,
    isSearching: query.trim().length > 0,
  };
}

// Helper function to highlight matching text
export function highlightMatch(text: string, query: string, caseSensitive = false): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const searchTerm = caseSensitive ? query : query.toLowerCase();
  const textToSearch = caseSensitive ? text : text.toLowerCase();
  const index = textToSearch.indexOf(searchTerm);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-warning-200 dark:bg-warning-800 text-text-primary">{match}</mark>
      {after}
    </>
  );
}
