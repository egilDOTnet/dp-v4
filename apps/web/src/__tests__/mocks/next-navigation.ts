/**
 * Mock for Next.js navigation hooks
 */
import { vi } from 'vitest';

export const useRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
});

export const usePathname = () => '/';

export const useSearchParams = () => new URLSearchParams();

export const useParams = () => ({});
