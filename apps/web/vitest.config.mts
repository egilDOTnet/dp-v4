import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamically find Prisma client path in pnpm structure
function findPrismaClientPath() {
  const pnpmPath = resolve(__dirname, '../../node_modules/.pnpm');
  if (!existsSync(pnpmPath)) {
    return null;
  }
  
  try {
    const entries = readdirSync(pnpmPath);
    const prismaEntry = entries.find(entry => entry.startsWith('@prisma+client@7.1.0'));
    if (prismaEntry) {
      const clientPath = resolve(pnpmPath, prismaEntry, 'node_modules/@prisma/client');
      if (existsSync(clientPath)) {
        return clientPath;
      }
    }
  } catch {
    // Fallback to default path structure
  }
  
  // Fallback: try to resolve from node_modules directly
  const fallbackPath = resolve(__dirname, '../../node_modules/@prisma/client');
  if (existsSync(fallbackPath)) {
    return fallbackPath;
  }
  
  return null;
}

const prismaClientPath = findPrismaClientPath();

export default defineConfig({
  plugins: [
    react(),
    // Custom plugin to resolve @prisma/client from workspace
    {
      name: 'resolve-prisma-client',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@prisma/client' && prismaClientPath) {
          return prismaClientPath;
        }
        return null;
      },
    },
  ],
  test: {
    // Use jsdom environment for component tests (default)
    // Integration tests can override this per-file using // @vitest-environment node
    environment: 'jsdom',
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
      // In pnpm, we dynamically find the actual location
      ...(prismaClientPath ? { '@prisma/client': prismaClientPath } : {}),
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
