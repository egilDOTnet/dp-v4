import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string or Date object to ISO 8601 format (YYYY-MM-DD HH:mm:ss)
 * Use this instead of toLocaleString() to avoid US-style date formatting
 * 
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date string in ISO format, or "-" if date is null/undefined
 */
export function formatISODateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a date string or Date object to ISO date format (YYYY-MM-DD)
 * Use this instead of toLocaleDateString() to avoid US-style date formatting
 * 
 * @param date - Date string, Date object, or null/undefined
 * @returns Formatted date string in ISO format, or "-" if date is null/undefined
 */
export function formatISODate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}
