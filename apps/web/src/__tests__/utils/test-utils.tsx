import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import type { User } from '@/lib/api';

// Custom render function that includes theme and auth providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Optional user to provide to AuthProvider
   * If not provided, AuthProvider will be in loading state
   */
  user?: User | null;
  /**
   * Whether to skip AuthProvider wrapper
   */
  skipAuth?: boolean;
}

const AllTheProviders = ({ 
  children, 
  user: _user 
}: { 
  children: React.ReactNode;
  user?: User | null;
}) => {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { user, skipAuth, ...renderOptions } = options;
  
  // Apply light theme class to document for theme support
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('light');
  }
  
  // If skipAuth is true, only wrap with ThemeProvider
  if (skipAuth) {
    const ThemeOnlyWrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    return render(ui, { wrapper: ThemeOnlyWrapper, ...renderOptions });
  }
  
  // Otherwise use full provider stack
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders user={user}>{children}</AllTheProviders>
  );
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render };
export type { CustomRenderOptions };









