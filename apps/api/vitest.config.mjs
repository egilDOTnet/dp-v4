import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import { readdirSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamically find Prisma client path in pnpm structure
function findPrismaClientPath() {
  const pnpmPath = path.resolve(__dirname, "../../node_modules/.pnpm");
  if (!existsSync(pnpmPath)) {
    return null;
  }
  
  try {
    const entries = readdirSync(pnpmPath);
    const prismaEntry = entries.find(entry => entry.startsWith('@prisma+client@7.2.0'));
    if (prismaEntry) {
      const clientPath = path.resolve(pnpmPath, prismaEntry, 'node_modules/@prisma/client');
      if (existsSync(clientPath)) {
        return clientPath;
      }
    }
  } catch {
    // Fallback to default path structure
  }
  
  // Fallback: try to resolve from node_modules directly
  const fallbackPath = path.resolve(__dirname, "../../node_modules/@prisma/client");
  if (existsSync(fallbackPath)) {
    return fallbackPath;
  }
  
  return null;
}

const prismaClientPath = findPrismaClientPath();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run tests sequentially to avoid database race conditions
    // This prevents unique constraint violations from parallel test execution
    // Vitest 4.0: singleThread replaced with maxWorkers: 1 and isolate: false
    maxWorkers: 1,
    isolate: false,
    // Allow mixing ESM and CommonJS
    transformMode: {
      web: [/\.[jt]sx?$/],
      ssr: [/\.[jt]sx?$/],
    },
  },
  resolve: {
    alias: {
      "@dp/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
      "@dp/lib": path.resolve(__dirname, "../../packages/lib/src/index.ts"),
      "@dp/config": path.resolve(__dirname, "../../packages/config/src/index.ts"),
      // Resolve Prisma client directly - dynamically find the path
      ...(prismaClientPath ? { "@prisma/client": prismaClientPath } : {}),
    },
  },
  // Configure Prisma client - it uses Node.js internal modules
  // Externalize to avoid transformation issues
  server: {
    deps: {
      external: [/^@prisma\/client/, /^\.prisma/],
    },
  },
  optimizeDeps: {
    exclude: ["@prisma/client"],
  },
});




