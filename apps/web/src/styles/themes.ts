export type Theme = 'light' | 'dark';

export interface ThemeColors {
  primary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  border: {
    primary: string;
    secondary: string;
  };
  success: string;
  warning: string;
  error: string;
}

export const lightTheme: ThemeColors = {
  primary: {
    50: '#f7ffec',   // Lightest green tint - derived from logo light green
    100: '#eeffda',  // Very light green - derived from logo light green
    200: '#c7ff82',  // Light green from logo (C=22 M=0 Y=49 K=0)
    300: '#aaf25d',  // Light-medium green - interpolated between light and main
    400: '#8ce537',  // Medium-light green - interpolated between light and main
    500: '#65d405',  // Main brand green from logo (C=60 M=16 Y=98 K=1)
    600: '#56b404',  // Medium-dark green - darkened from main
    700: '#428a03',  // Dark green - further darkened for contrast
    800: '#2d5f02',  // Very dark green - for deep contrast
    900: '#193501',  // Darkest green - near black with green tint
    950: '#0a1500',  // Almost black green - maximum darkness
  },
  background: {
    primary: '#f3f4f6',  // Gray-100 - page background (darkest shade for depth)
    secondary: '#f9fafb', // Gray-50 - cards/content (medium)
    tertiary: '#ffffff',  // White - sidebar/elevated (lightest, most elevated)
  },
  text: {
    primary: '#111827',
    secondary: '#4b5563',
    tertiary: '#6b7280',
  },
  border: {
    primary: '#e5e7eb',
    secondary: '#d1d5db',
  },
  success: '#65d405',  // Use primary green for success
  warning: '#ffcf33',  // Alternative yellow from brand manual (C=0 M=19 Y=80 K=0)
  error: '#b91c1c',    // Error red-700 for better contrast on light backgrounds (WCAG AA compliant)
};

export const darkTheme: ThemeColors = {
  primary: {
    50: '#0a1500',   // Darkest - almost black green (reversed from light mode)
    100: '#193501',  // Very dark green (reversed from light mode)
    200: '#2d5f02',  // Dark green (reversed from light mode)
    300: '#428a03',  // Medium-dark green (reversed from light mode)
    400: '#56b404',  // Medium green (reversed from light mode)
    500: '#65d405',  // Main brand green from logo (C=60 M=16 Y=98 K=1)
    600: '#8ce537',  // Medium-light green (reversed from light mode)
    700: '#aaf25d',  // Light-medium green (reversed from light mode)
    800: '#c7ff82',  // Light green from logo (C=22 M=0 Y=49 K=0)
    900: '#eeffda',  // Very light green (reversed from light mode)
    950: '#f7ffec',  // Lightest green tint (reversed from light mode)
  },
  background: {
    primary: '#0f172a',  // Gray-950 - page background (darkest at back)
    secondary: '#1e293b', // Gray-900 - cards/content (medium, elevated)
    tertiary: '#334155',  // Gray-800 - sidebar/elevated (lightest, most elevated)
  },
  text: {
    primary: '#f9fafb',
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
  },
  border: {
    primary: '#374151',
    secondary: '#4b5563',
  },
  success: '#65d405',  // Use primary green for success
  warning: '#ffcf33',  // Alternative yellow from brand manual (C=0 M=19 Y=80 K=0)
  error: '#f87171',    // Lighter red for dark mode (better contrast)
};

export const getThemeColors = (theme: Theme): ThemeColors => {
  return theme === 'dark' ? darkTheme : lightTheme;
};
