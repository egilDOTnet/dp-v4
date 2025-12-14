import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to resolve @prisma/client from workspace
    {
      name: 'resolve-prisma-client',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@prisma/client') {
          // Return the actual path to Prisma client in the workspace
          const prismaPath = resolve(__dirname, '../../node_modules/.pnpm/@prisma+client@6.19.0_prisma@6.19.0/node_modules/@prisma/client');
          return prismaPath;
        }
        return null;
      },
    },
  test: {
    // Use node environment for integration tests (they test API endpoints, not browser)
    // Component tests can override this if needed
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 30000, // Increase timeout for integration tests
    hookTimeout: 30000,
    // Configure pool options for better Node.js module handling
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'next/navigation': resolve(__dirname, './src/__tests__/mocks/next-navigation.ts'),
      // Workspace package aliases for integration tests
      '@dp/db': resolve(__dirname, '../../packages/db/src/index.ts'),
      '@dp/lib': resolve(__dirname, '../../packages/lib/src/index.ts'),
      '@dp/config': resolve(__dirname, '../../packages/config/src/index.ts'),
      // Resolve @prisma/client from workspace - use the generated client from packages/db
      // In pnpm, we need to point to the actual location
      '@prisma/client': resolve(__dirname, '../../node_modules/.pnpm/@prisma+client@6.19.0_prisma@6.19.0/node_modules/@prisma/client'),
    },
    // Preserve symlinks to help resolve workspace packages correctly
    preserveSymlinks: false,
  },
  // Configure server deps - don't externalize @prisma/client, let the alias handle it
  // The alias above should allow Vite to find @prisma/client when transforming API code
  server: {
    deps: {
      // Only externalize actual API source files if needed, but not their dependencies
      // The alias should handle @prisma/client resolution
      inline: [],
    },
  },
  optimizeDeps: {
    // Exclude Prisma from optimization since it's a native module
    exclude: ['@prisma/client'],
  },
  // SSR configuration - treat API source code as external SSR code
  ssr: {
    // Don't externalize, let Vite handle it but use the alias
    noExternal: [],
    external: [],
  },
});
