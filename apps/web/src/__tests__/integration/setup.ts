import { beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Use dynamic imports to avoid Vite trying to transform API source code during module loading
// These will only be loaded at runtime when the test server needs to start
let buildTestApp: any;
let cleanupDatabase: any;

/**
 * Integration Test Setup
 * 
 * This setup file configures the environment for integration tests that test
 * full workflows by making real HTTP requests to a test API server.
 * 
 * Key features:
 * - Starts a real Fastify server instance for testing
 * - Uses the test database (app_test) for data isolation
 * - Configures the API client to point to the test server
 * - Provides utilities for workflow testing
 * 
 * Usage:
 *   Import this file at the top of your integration test files:
 *   import './setup'; // or import from the integration directory
 */

// Test server configuration
const TEST_API_PORT = 3002; // Use different port from dev (3001) to avoid conflicts

// Singleton pattern to ensure server only starts once
let testServer: FastifyInstance | null = null;
let testApiUrl: string = '';
let isServerStarted = false;
let isServerStopped = false;

/**
 * Override the API URL getter to point to the test server
 */
function setupApiUrlOverride() {
  // Set environment variable for SSR
  process.env.NEXT_PUBLIC_API_URL = `http://localhost:${TEST_API_PORT}`;
  
  // For browser-side, mock window.location to use test server port
  if (typeof window !== 'undefined') {
    // Store original location
    const originalLocation = window.location;
    
    // Mock window.location to use test server
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      hostname: 'localhost',
      protocol: 'http:',
      port: String(TEST_API_PORT),
      href: `http://localhost:${TEST_API_PORT}`,
    };
    
    // Store original for restoration
    (window as any).__ORIGINAL_LOCATION__ = originalLocation;
  }
}

/**
 * Restore the original API URL getter
 */
function restoreApiUrlOverride() {
  delete process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && (window as any).__ORIGINAL_LOCATION__) {
    // Restore original location
    (window as any).location = (window as any).__ORIGINAL_LOCATION__;
    delete (window as any).__ORIGINAL_LOCATION__;
  }
}

// Initialize server (singleton pattern - only starts once)
async function initializeServer() {
  if (isServerStarted || testServer) {
    return; // Already started
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  
  // Set test database URL (must be set before importing db)
  const defaultTestDbUrl = 'postgresql://postgres:postgres@localhost:5432/app_test';
  const testDbUrl = process.env.TEST_DATABASE_URL || defaultTestDbUrl;
  process.env.DATABASE_URL = testDbUrl;
  
  // Verify we're using a test database
  const url = new URL(testDbUrl);
  const dbName = url.pathname.replace('/', '');
  if (!dbName.includes('test') && !dbName.includes('_test')) {
    throw new Error(
      `⚠️  SAFETY CHECK FAILED: Integration tests must use a test database. ` +
      `Current database: ${dbName}. ` +
      `Set TEST_DATABASE_URL to a test database (e.g., app_test) to continue.`
    );
  }
  
  // Dynamically import API test helpers only when needed (at runtime, not module load time)
  // This avoids Vite trying to transform the API source code during test collection
  if (!buildTestApp) {
    const testHelpers = await import('../../../../api/src/__tests__/utils/test-helpers');
    buildTestApp = testHelpers.buildTestApp;
    const dbHelpers = await import('../../../../api/src/__tests__/utils/db-helpers');
    cleanupDatabase = dbHelpers.cleanupDatabase;
  }
  
  // Build and start the test Fastify server
  console.log('🚀 Starting integration test API server...');
  testServer = await buildTestApp();
  
  // Start server on test port
  await testServer.listen({ 
    port: TEST_API_PORT, 
    host: '127.0.0.1' // Use 127.0.0.1 instead of 0.0.0.0 for security
  });
  
  testApiUrl = `http://localhost:${TEST_API_PORT}`;
  isServerStarted = true;
  console.log(`✅ Integration test API server running at ${testApiUrl}`);
  
  // Override API URL to point to test server
  setupApiUrlOverride();
}

// Cleanup server
async function cleanupServer() {
  if (isServerStopped || !testServer) {
    return; // Already stopped
  }
  
  // Restore API URL override
  restoreApiUrlOverride();
  
  // Stop the test server
  console.log('🛑 Stopping integration test API server...');
  await testServer.close();
  testServer = null;
  isServerStopped = true;
  console.log('✅ Integration test API server stopped');
}

// Register hooks (will run when this module is imported)
beforeAll(async () => {
  await initializeServer();
});

afterAll(async () => {
  await cleanupServer();
});

beforeEach(async () => {
  // Ensure cleanupDatabase is loaded
  if (!cleanupDatabase) {
    const dbHelpers = await import('../../../../api/src/__tests__/utils/db-helpers');
    cleanupDatabase = dbHelpers.cleanupDatabase;
  }
  // Clean up database before each test to ensure test isolation
  await cleanupDatabase();
});

/**
 * Get the test API server URL
 */
export function getTestApiUrl(): string {
  return testApiUrl;
}

/**
 * Get the test Fastify server instance
 * Useful for direct server access in tests if needed
 */
export function getTestServer(): FastifyInstance | null {
  return testServer;
}
