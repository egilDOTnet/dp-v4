"use client";

import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "./dropdown-menu";
import { Avatar, AvatarFallback } from "./Avatar";
import { cn } from "@/lib/utils";

export interface ContactPerson {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

interface ContactPersonSelectorProps {
  value: ContactPerson | null;
  options: ContactPerson[];
  onChange: (person: ContactPerson | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function ContactPersonSelector({
  value,
  options,
  onChange,
  placeholder = "Select contact person",
  label,
  className,
}: ContactPersonSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = options.filter((person) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const firstName = person.firstName?.toLowerCase() || "";
    const lastName = person.lastName?.toLowerCase() || "";
    const name = person.name?.toLowerCase() || "";
    const email = person.email.toLowerCase();
    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      name.includes(query) ||
      email.includes(query) ||
      `${firstName} ${lastName}`.trim().includes(query)
    );
  });

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Small delay to ensure dropdown is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  const getDisplayName = (person: ContactPerson) => {
    if (person.firstName || person.lastName) {
      return `${person.firstName || ""} ${person.lastName || ""}`.trim();
    }
    return person.name || person.email || "Unknown";
  };

  const getInitials = (person: ContactPerson) => {
    if (person.firstName && person.lastName) {
      return `${person.firstName[0]}${person.lastName[0]}`.toUpperCase();
    }
    if (person.firstName) {
      return person.firstName[0].toUpperCase();
    }
    if (person.name) {
      const parts = person.name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return person.name[0].toUpperCase();
    }
    if (person.email) {
      return person.email[0].toUpperCase();
    }
    return "?";
  };

  const handleSelect = (person: ContactPerson) => {
    onChange(person);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1">
          {label}
        </label>
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full px-3 py-2 rounded-md bg-background-primary text-text-primary border border-border-primary",
              "hover:bg-background-secondary transition-colors",
              "flex items-center gap-2 text-left",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            )}
          >
            {value ? (
              <>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary-600 text-white text-xs">
                    {getInitials(value)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {getDisplayName(value)}
                  </div>
                  {value.email && (
                    <div className="text-xs text-text-secondary truncate">
                      {value.email}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-text-secondary">{placeholder}</span>
            )}
            <svg
              className="h-4 w-4 text-text-tertiary flex-shrink-0 ml-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[var(--radix-dropdown-menu-trigger-width)] p-0"
          align="start"
        >
          <div className="p-2 border-b border-border-primary">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
                // Escape to close
                if (e.key === "Escape") {
                  setOpen(false);
                }
                // Prevent dropdown from closing when typing
                e.stopPropagation();
              }}
              className="w-full px-3 py-2 border rounded-md text-text-primary bg-background-secondary border-border-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-text-secondary text-center">
                No contacts found
              </div>
            ) : (
              <>
                {filteredOptions.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelect(person)}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-2 hover:bg-background-secondary transition-colors",
                      "text-left focus:outline-none focus:bg-background-secondary",
                      value?.id === person.id && "bg-background-secondary"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary-600 text-white text-xs">
                        {getInitials(person)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {getDisplayName(person)}
                      </div>
                      {person.email && (
                        <div className="text-xs text-text-secondary truncate">
                          {person.email}
                        </div>
                      )}
                    </div>
                    {value?.id === person.id && (
                      <svg
                        className="h-4 w-4 text-primary-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
          {value && (
            <div className="p-2 border-t border-border-primary">
              <button
                type="button"
                onClick={handleClear}
                className="w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded transition-colors text-left"
              >
                Clear selection
              </button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}


