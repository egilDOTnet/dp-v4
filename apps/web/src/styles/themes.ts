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
    50: '#f0fdf4',   // Lightest green tint
    100: '#dcfce7',  // Very light green
    200: '#c7ff82',  // Light green from brand manual (C=22 M=0 Y=49 K=0)
    300: '#a8e85c',  // Light-medium green
    400: '#89d136',  // Medium-light green
    500: '#65d405',  // Main brand green from brand manual (C=60 M=16 Y=98 K=1)
    600: '#4fa804',  // Medium-dark green
    700: '#3d7c03',  // Dark green
    800: '#2a5002',  // Very dark green
    900: '#182401',  // Darkest green
    950: '#0f1501',  // Almost black green
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
    50: '#0f1501',   // Darkest - almost black green
    100: '#182401',  // Very dark green
    200: '#2a5002',  // Dark green
    300: '#3d7c03',  // Medium-dark green
    400: '#4fa804',  // Medium green
    500: '#65d405',  // Main brand green from brand manual (C=60 M=16 Y=98 K=1)
    600: '#89d136',  // Medium-light green
    700: '#a8e85c',  // Light-medium green
    800: '#c7ff82',  // Light green from brand manual (C=22 M=0 Y=49 K=0)
    900: '#dcfce7',  // Very light green
    950: '#f0fdf4',  // Lightest green tint
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
