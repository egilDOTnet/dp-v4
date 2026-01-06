/**
 * Date/time normalization utilities for RFI/RFP publishing
 */

/**
 * Default times:
 * - 06:00 for start/publish dates
 * - 23:30 for stop/end dates
 */
const DEFAULT_START_TIME = { hours: 6, minutes: 0 };
const DEFAULT_END_TIME = { hours: 23, minutes: 30 };

/**
 * Normalizes a publish date by applying default time if needed
 * @param date - The date to normalize
 * @param disregardTimestamp - Whether to disregard the timestamp (apply default time)
 * @param isEndDate - Whether this is an end date (uses 23:30 instead of 06:00)
 * @returns Normalized date with default time applied if needed
 */
export function normalizePublishDate(
  date: Date,
  disregardTimestamp: boolean = false,
  isEndDate: boolean = false
): Date {
  const normalized = new Date(date);
  
  if (disregardTimestamp || !hasTimeComponent(date)) {
    const defaultTime = isEndDate ? DEFAULT_END_TIME : DEFAULT_START_TIME;
    normalized.setHours(defaultTime.hours, defaultTime.minutes, 0, 0);
  }
  
  return normalized;
}

/**
 * Checks if a date has a time component (not just 00:00:00)
 */
function hasTimeComponent(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
}

/**
 * Checks if a publish date has passed and should trigger publishing now
 * @param publishDate - The normalized publish date
 * @param currentDate - The current date/time (defaults to now)
 * @returns true if the publish date has passed
 */
export function shouldPublishNow(publishDate: Date, currentDate: Date = new Date()): boolean {
  return currentDate >= publishDate;
}



