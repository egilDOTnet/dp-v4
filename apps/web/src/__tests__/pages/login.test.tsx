import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../utils/test-utils';
import LoginPage from '@/app/(auth)/login/page';
import {
  hasHardCodedBackgroundColors,
  hasSemanticBackgroundColors,
} from '../utils/color-utils';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    user: null,
  }),
}));

describe('Login Page', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  it('should use semantic background classes', () => {
    const { container } = render(<LoginPage />);

    // Check that the main container uses semantic classes
    const mainContainer = container.querySelector('.bg-background-tertiary');
    expect(mainContainer).toBeTruthy();
  });

  it('should not have hard-coded background colors in main elements', () => {
    const { container } = render(<LoginPage />);

    // Get all elements with background classes
    const allElements = container.querySelectorAll('[class*="bg-"]');
    
    let foundHardCoded = false;
    allElements.forEach((element) => {
      const className = element.className;
      // Skip status/error colors (red, green, etc.) as they're intentional
      if (!className.includes('red-') && !className.includes('green-')) {
        if (hasHardCodedBackgroundColors(className)) {
          foundHardCoded = true;
        }
      }
    });

    // The login form should use semantic classes
    expect(foundHardCoded).toBe(false);
  });
});



