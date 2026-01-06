/**
 * Mock for Next.js navigation hooks
 * These can be customized in tests by importing and overriding
 */
import { vi } from 'vitest';

// Create mock functions that can be accessed in tests
export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockPrefetch = vi.fn();
export const mockBack = vi.fn();
export const mockForward = vi.fn();
export const mockRefresh = vi.fn();

// Default router state
let mockPathname = '/';
let mockQuery: Record<string, string | string[]> = {};
let mockAsPath = '/';
let mockParams: Record<string, string> = {};
let mockSearchParams = new URLSearchParams();

export const useRouter = () => ({
  push: mockPush,
  replace: mockReplace,
  prefetch: mockPrefetch,
  back: mockBack,
  forward: mockForward,
  refresh: mockRefresh,
  pathname: mockPathname,
  query: mockQuery,
  asPath: mockAsPath,
});

export const usePathname = () => mockPathname;

export const useSearchParams = () => mockSearchParams;

export const useParams = () => mockParams;

/**
 * Helper to set router state for tests
 */
export function setRouterState(options: {
  pathname?: string;
  query?: Record<string, string | string[]>;
  asPath?: string;
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
}): void {
  if (options.pathname !== undefined) mockPathname = options.pathname;
  if (options.query !== undefined) mockQuery = options.query;
  if (options.asPath !== undefined) mockAsPath = options.asPath;
  if (options.params !== undefined) mockParams = options.params;
  if (options.searchParams !== undefined) mockSearchParams = options.searchParams;
}

/**
 * Reset all router mocks and state
 */
export function resetRouterMocks(): void {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockPrefetch.mockReset();
  mockBack.mockReset();
  mockForward.mockReset();
  mockRefresh.mockReset();
  mockPathname = '/';
  mockQuery = {};
  mockAsPath = '/';
  mockParams = {};
  mockSearchParams = new URLSearchParams();
}










