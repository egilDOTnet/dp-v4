/**
 * Utility functions for testing semantic color usage
 */

/**
 * Check if a className string contains hard-coded background colors
 * that should be replaced with semantic classes
 */
export function hasHardCodedBackgroundColors(className: string): boolean {
  const hardCodedPatterns = [
    /\bbg-white\b/,
    /\bbg-gray-50\b/,
    /\bbg-gray-100\b/,
    /\bbg-gray-200\b/,
    /\bbg-gray-300\b/,
    /\bbg-gray-800\b/,
    /\bbg-gray-900\b/,
    /\bbg-slate-\d+\b/,
    /\bbg-zinc-\d+\b/,
    /\bbg-neutral-\d+\b/,
    /\bbg-stone-\d+\b/,
  ];

  // Exclude status badge colors (intentional)
  const statusBadgePatterns = [
    /\bbg-(red|green|blue|yellow|orange|purple|indigo|amber)-\d+\b/,
  ];

  // Check if it's a status badge
  const isStatusBadge = statusBadgePatterns.some((pattern) =>
    pattern.test(className),
  );

  if (isStatusBadge) {
    return false; // Status badges are allowed to use color-specific classes
  }

  return hardCodedPatterns.some((pattern) => pattern.test(className));
}

/**
 * Extract all background color classes from a className string
 */
export function extractBackgroundClasses(className: string): string[] {
  const bgPattern = /\bbg-[\w-]+/g;
  return className.match(bgPattern) || [];
}

/**
 * Check if semantic background classes are used
 */
export function hasSemanticBackgroundColors(className: string): boolean {
  const semanticPatterns = [
    /\bbg-background-primary\b/,
    /\bbg-background-secondary\b/,
    /\bbg-background-tertiary\b/,
  ];

  return semanticPatterns.some((pattern) => pattern.test(className));
}

/**
 * Get expected CSS variable value for a semantic color
 */
export function getExpectedColorValue(
  semanticClass: 'primary' | 'secondary' | 'tertiary',
  theme: 'light' | 'dark',
): string {
  const values = {
    light: {
      primary: '#f3f4f6', // gray-100
      secondary: '#f9fafb', // gray-50
      tertiary: '#ffffff', // white
    },
    dark: {
      primary: '#0f172a', // gray-950
      secondary: '#1e293b', // gray-900
      tertiary: '#334155', // gray-800
    },
  };

  return values[theme][semanticClass];
}







