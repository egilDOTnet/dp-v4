"use client";

import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "./dropdown-menu";
import { Avatar, AvatarFallback } from "./Avatar";
import { cn } from "@/lib/utils";

export interface Vendor {
  id: string;
  name: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
}

interface VendorSelectorProps {
  value: Vendor | null;
  options: Vendor[];
  onChange: (vendor: Vendor | null) => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  required?: boolean;
}

export function VendorSelector({
  value,
  options,
  onChange,
  onOpenChange,
  placeholder = "Select a vendor",
  label,
  className,
  required,
}: VendorSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = options.filter((vendor) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = vendor.name.toLowerCase();
    const orgNumber = vendor.organizationNumber?.toLowerCase() || "";
    const emailDomain = vendor.emailDomain?.toLowerCase() || "";
    return (
      name.includes(query) ||
      orgNumber.includes(query) ||
      emailDomain.includes(query)
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

  const getInitials = (vendor: Vendor) => {
    const words = vendor.name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    }
    if (vendor.name.length >= 2) {
      return vendor.name.substring(0, 2).toUpperCase();
    }
    return vendor.name[0]?.toUpperCase() || "V";
  };

  const handleSelect = (vendor: Vendor) => {
    onChange(vendor);
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
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full px-3 py-2 rounded-md bg-background-primary text-text-primary border border-border-primary",
              "hover:bg-background-secondary transition-colors cursor-pointer",
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
                    {value.name}
                  </div>
                  {value.organizationNumber && (
                    <div className="text-xs text-text-secondary truncate">
                      Org: {value.organizationNumber}
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
              placeholder="Search vendors..."
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
                No vendors found
              </div>
            ) : (
              <>
                {filteredOptions.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => handleSelect(vendor)}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-2 hover:bg-background-secondary transition-colors cursor-pointer",
                      "text-left focus:outline-none focus:bg-background-secondary",
                      value?.id === vendor.id && "bg-background-secondary"
                    )}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary-600 text-white text-xs">
                        {getInitials(vendor)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {vendor.name}
                      </div>
                      {vendor.organizationNumber && (
                        <div className="text-xs text-text-secondary truncate">
                          Org: {vendor.organizationNumber}
                        </div>
                      )}
                    </div>
                    {value?.id === vendor.id && (
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
                className="w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-secondary rounded transition-colors text-left cursor-pointer"
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

