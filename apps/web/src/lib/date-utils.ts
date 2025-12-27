/**
 * Date formatting utility functions
 * 
 * These functions provide consistent date formatting across the application.
 * All functions handle null/undefined inputs gracefully by returning empty strings.
 */

/**
 * Format a date string to ISO date format (YYYY-MM-DD)
 * Used for date inputs and date-only displays
 * 
 * @param dateString - ISO date string or null
 * @returns Formatted date string (YYYY-MM-DD) or empty string
 * 
 * @example
 * formatDate("2024-12-10T14:30:00.000Z") // "2024-12-10"
 * formatDate(null) // ""
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  return new Date(dateString).toISOString().split("T")[0];
}

/**
 * Format a date string to short display format (MMM DD)
 * Used for compact views like task lists and cards
 * 
 * @param dateString - ISO date string or null
 * @returns Formatted date string (e.g., "Dec 10") or empty string
 * 
 * @example
 * formatDateDisplay("2024-12-10T14:30:00.000Z") // "Dec 10"
 * formatDateDisplay(null) // ""
 */
export function formatDateDisplay(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a date string to ISO format with timestamp (YYYY-MM-DD HH:MM)
 * Used for comments, activity logs, and timestamps with time information
 * 
 * @param dateString - ISO date string or null
 * @returns Formatted date-time string (YYYY-MM-DD HH:MM) or empty string
 * 
 * @example
 * formatDateTimeISO("2024-12-10T14:30:00.000Z") // "2024-12-10 14:30"
 * formatDateTimeISO(null) // ""
 */
export function formatDateTimeISO(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}


