import '@testing-library/jest-dom';
import { expect, afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetRouterMocks } from './mocks/next-navigation';
import { setupApiMocks, resetFetchMock } from './utils/api-mocks';
import { resetIdCounter } from './utils/mock-data';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false, // Default to light mode
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock document.queryCommandState for WysiwygEditor
Object.defineProperty(document, 'queryCommandState', {
  writable: true,
  value: vi.fn().mockReturnValue(false),
});

beforeAll(() => {
  global.localStorage = localStorageMock as any;
  // Default return value for getItem
  localStorageMock.getItem.mockReturnValue(null);
  
  // Setup API mocks
  setupApiMocks();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Reset localStorage mocks
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
  
  // Reset router mocks
  resetRouterMocks();
  
  // Reset API mocks
  setupApiMocks();
  resetFetchMock();
  
  // Reset ID counter for test data factories
  resetIdCounter();
});





