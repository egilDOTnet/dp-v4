import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
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
      // Resolve Prisma client directly
      "@prisma/client": path.resolve(__dirname, "../../node_modules/.pnpm/@prisma+client@6.19.0_prisma@6.19.0/node_modules/@prisma/client"),
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
