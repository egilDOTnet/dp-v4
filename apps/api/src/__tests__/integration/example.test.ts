/**
 * Example Integration Test
 * 
 * This file demonstrates how to write integration tests using the integration test infrastructure.
 * 
 * Integration tests:
 * - Make real HTTP requests to a test API server
 * - Test full workflows end-to-end
 * - Use the test database for data isolation
 * 
 * To run integration tests:
 *   pnpm vitest run -t "integration"
 *   or
 *   pnpm vitest run apps/web/src/__tests__/integration
 */

import { describe, it, expect } from 'vitest';
import './setup'; // Import setup to initialize test server
import { authenticateUser, createAuthenticatedUser, createProjectWithMember } from './utils';
import { api } from './api-client';

describe('Integration Test Example', () => {
  it('should authenticate a user', async () => {
    // Create a user in the database
    const { email, password } = await createAuthenticatedUser();
    
    // Authenticate via API
    const { token, user } = await authenticateUser(email, password);
    
    expect(token).toBeTruthy();
    expect(user.email).toBe(email);
  });
  
  it('should create a project and retrieve it', async () => {
    // Create project with authenticated user
    const { project } = await createProjectWithMember({
      projectName: 'Integration Test Project',
    });
    // Token is automatically set by createProjectWithMember via setToken
    
    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Integration Test Project');
    
    // Retrieve project via API
    const retrievedProject = await api.projects.get(project.id);
    expect(retrievedProject.id).toBe(project.id);
    expect(retrievedProject.name).toBe(project.name);
  });
});
