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
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#0066cc',
    700: '#004c99',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
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
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

export const darkTheme: ThemeColors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  background: {
    primary: '#030712',
    secondary: '#111827',
    tertiary: '#1f2937',
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
  success: '#34d399',
  warning: '#fcd34d',
  error: '#f87171',
};

export const getThemeColors = (theme: Theme): ThemeColors => {
  return theme === 'dark' ? darkTheme : lightTheme;
};
