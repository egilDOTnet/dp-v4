import { beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../utils/test-helpers';
import { cleanupDatabase } from '../utils/db-helpers';

/**
 * Integration Test Setup
 * 
 * This setup file configures the environment for integration tests that test
 * full workflows by making real HTTP requests to a test API server.
 * 
 * Key features:
 * - Starts a real Fastify server instance for testing
 * - Uses the test database (app_test) for data isolation
 * - Configures the API URL to point to the test server
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
 * Set the API URL environment variable for the test client
 */
function setupApiUrlOverride() {
  // Set environment variable for test API client
  process.env.TEST_API_URL = `http://localhost:${TEST_API_PORT}`;
}

/**
 * Restore the original API URL
 */
function restoreApiUrlOverride() {
  delete process.env.TEST_API_URL;
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
  
  // Set API URL for test client
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




