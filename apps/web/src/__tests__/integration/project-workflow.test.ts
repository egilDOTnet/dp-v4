/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import './setup'; // Import setup to ensure test server is running
import { api } from '@/lib/api';
import {
  createProjectWithMember,
  createAuthenticatedUser,
} from './utils';

/**
 * Project Setup Workflow Integration Tests
 * 
 * These tests verify the complete project setup workflow including:
 * - Project creation with phases
 * - Project member management
 * - Phase and task management
 * - Task assignment and completion
 * - Vendor management in projects
 * - Dashboard statistics
 */

describe('Project Setup Workflow Integration Tests', () => {

  describe('Project Creation', () => {
    it('should create project with basic information', async () => {
      const { user, token } = await createAuthenticatedUser();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const project = await api.projects.create({
        name: 'Test Project',
        type: 'Construction',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(project.name).toBe('Test Project');
      expect(project.type).toBe('Construction');
      expect(project.startDate).toBeDefined();
      expect(project.endDate).toBeDefined();
      expect(project.id).toBeDefined();
    });

    it('should create project with phases', async () => {
      const { token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with phases
      const project = await api.projects.create({
        name: 'Project with Phases',
        phases: [
          { name: 'Phase 1', order: 1 },
          { name: 'Phase 2', order: 2 },
        ],
      });

      expect(project.name).toBe('Project with Phases');
      expect(project.id).toBeDefined();

      // Verify phases were created
      const phases = await api.projects.phases.list(project.id);
      expect(phases.length).toBeGreaterThanOrEqual(2);
      expect(phases.some(p => p.name === 'Phase 1')).toBe(true);
      expect(phases.some(p => p.name === 'Phase 2')).toBe(true);
    });

    it('should update project information', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const updatedProject = await api.projects.update(project.id, {
        name: 'Updated Project Name',
        type: 'Renovation',
        startDate: '2025-02-01',
        endDate: '2025-11-30',
      });

      expect(updatedProject.name).toBe('Updated Project Name');
      expect(updatedProject.type).toBe('Renovation');
    });
  });

  describe('Project Member Management', () => {
    it('should add and remove project members', async () => {
      const { project, user: user1, token: token1 } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token1);
      }

      // Create another user
      const { user: user2 } = await createAuthenticatedUser({
        email: `user2-${Date.now()}@example.com`,
      });

      // Add user2 as member
      const updatedProject = await api.projects.addMembers(project.id, [user2.id]);
      expect(updatedProject).toBeDefined();

      // Verify member was added (by checking project access)
      // Note: We can't directly list members via API, but we can verify by trying to access project
      const projectDetails = await api.projects.get(project.id);
      expect(projectDetails.id).toBe(project.id);

      // Remove member
      const projectAfterRemoval = await api.projects.removeMembers(project.id, [user2.id]);
      expect(projectAfterRemoval).toBeDefined();
    });

    it('should handle multiple members', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create multiple users
      const { user: user1 } = await createAuthenticatedUser({
        email: `member1-${Date.now()}@example.com`,
      });
      const { user: user2 } = await createAuthenticatedUser({
        email: `member2-${Date.now()}@example.com`,
      });
      const { user: user3 } = await createAuthenticatedUser({
        email: `member3-${Date.now()}@example.com`,
      });

      // Add all as members
      await api.projects.addMembers(project.id, [user1.id, user2.id, user3.id]);

      // Remove some members
      await api.projects.removeMembers(project.id, [user2.id]);

      // Verify project still accessible
      const projectDetails = await api.projects.get(project.id);
      expect(projectDetails.id).toBe(project.id);
    });
  });

  describe('Phase and Task Management', () => {
    it('should list phases for a project', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with phases
      const projectWithPhases = await api.projects.create({
        name: 'Project with Phases',
        phases: [
          { name: 'Planning', order: 1 },
          { name: 'Execution', order: 2 },
          { name: 'Completion', order: 3 },
        ],
      });

      const phases = await api.projects.phases.list(projectWithPhases.id);
      expect(phases.length).toBeGreaterThanOrEqual(3);
      expect(phases.some(p => p.name === 'Planning')).toBe(true);
      expect(phases.some(p => p.name === 'Execution')).toBe(true);
      expect(phases.some(p => p.name === 'Completion')).toBe(true);
    });

    it('should create, update, and delete tasks', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with a phase
      const projectWithPhase = await api.projects.create({
        name: 'Task Management Project',
        phases: [{ name: 'Phase 1', order: 1 }],
      });

      const phases = await api.projects.phases.list(projectWithPhase.id);
      const phase = phases[0];

      // Create a task
      const task1 = await api.projects.phases.createTask(projectWithPhase.id, phase.id, {
        name: 'Task 1',
        description: 'Task 1 description',
      });

      expect(task1.name).toBe('Task 1');
      expect(task1.description).toBe('Task 1 description');
      expect(task1.phaseId).toBe(phase.id);
      expect(task1.order).toBeDefined();

      // Create another task
      const task2 = await api.projects.phases.createTask(projectWithPhase.id, phase.id, {
        name: 'Task 2',
        description: 'Task 2 description',
      });

      // List tasks
      const tasks = await api.projects.phases.getTasks(projectWithPhase.id, phase.id);
      expect(tasks.length).toBeGreaterThanOrEqual(2);
      expect(tasks.some(t => t.id === task1.id)).toBe(true);
      expect(tasks.some(t => t.id === task2.id)).toBe(true);

      // Update task
      const updatedTask = await api.projects.phases.updateTask(
        projectWithPhase.id,
        phase.id,
        task1.id,
        {
          name: 'Updated Task 1',
          description: 'Updated description',
        }
      );

      expect(updatedTask.name).toBe('Updated Task 1');
      expect(updatedTask.description).toBe('Updated description');

      // Delete task
      await api.projects.phases.deleteTask(projectWithPhase.id, phase.id, task1.id);

      // Verify deletion
      const remainingTasks = await api.projects.phases.getTasks(projectWithPhase.id, phase.id);
      expect(remainingTasks.some(t => t.id === task1.id)).toBe(false);
      expect(remainingTasks.some(t => t.id === task2.id)).toBe(true);
    });

    it('should assign task owner', async () => {
      const { project, user, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with phase
      const projectWithPhase = await api.projects.create({
        name: 'Task Assignment Project',
        phases: [{ name: 'Phase 1', order: 1 }],
      });

      const phases = await api.projects.phases.list(projectWithPhase.id);
      const phase = phases[0];

      // Create task
      const task = await api.projects.phases.createTask(projectWithPhase.id, phase.id, {
        name: 'Assigned Task',
      });

      // Assign owner
      const updatedTask = await api.projects.phases.updateTask(
        projectWithPhase.id,
        phase.id,
        task.id,
        {
          ownerId: user.id,
        }
      );

      expect(updatedTask.ownerId).toBe(user.id);
    });

    it('should mark task as completed', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with phase
      const projectWithPhase = await api.projects.create({
        name: 'Task Completion Project',
        phases: [{ name: 'Phase 1', order: 1 }],
      });

      const phases = await api.projects.phases.list(projectWithPhase.id);
      const phase = phases[0];

      // Create task
      const task = await api.projects.phases.createTask(projectWithPhase.id, phase.id, {
        name: 'Task to Complete',
      });

      // Mark as completed
      const completionDate = new Date().toISOString();
      const completedTask = await api.projects.phases.updateTask(
        projectWithPhase.id,
        phase.id,
        task.id,
        {
          actualCompletionDate: completionDate,
        }
      );

      expect(completedTask.actualCompletionDate).toBeDefined();
    });
  });

  describe('Task Comments', () => {
    it('should create and list task comments', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create project with phase
      const projectWithPhase = await api.projects.create({
        name: 'Task Comments Project',
        phases: [{ name: 'Phase 1', order: 1 }],
      });

      const phases = await api.projects.phases.list(projectWithPhase.id);
      const phase = phases[0];

      // Create task
      const task = await api.projects.phases.createTask(projectWithPhase.id, phase.id, {
        name: 'Task with Comments',
      });

      // Create comment
      const comment = await api.projects.phases.tasks.comments.create(
        projectWithPhase.id,
        phase.id,
        task.id,
        {
          content: 'This is a test comment',
          notifyOption: 'none',
        }
      );

      expect(comment.content).toBe('This is a test comment');
      expect(comment.taskId).toBe(task.id);

      // List comments
      const comments = await api.projects.phases.tasks.comments.list(
        projectWithPhase.id,
        phase.id,
        task.id
      );
      expect(comments.length).toBeGreaterThanOrEqual(1);
      expect(comments.some(c => c.id === comment.id)).toBe(true);
    });
  });

  describe('Vendor Management', () => {
    it('should add vendor to project', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // List vendors (should be empty initially)
      const initialVendors = await api.projects.vendors.list(project.id);
      expect(Array.isArray(initialVendors)).toBe(true);

      // Create vendor
      const vendor = await api.projects.vendors.create(project.id, {
        name: 'Test Vendor',
        organizationNumber: '123456789',
        status: 'Active',
      });

      expect(vendor.name).toBe('Test Vendor');
      expect(vendor.organizationNumber).toBe('123456789');
      expect(vendor.status).toBe('Active');

      // List vendors (should now have 1)
      const vendors = await api.projects.vendors.list(project.id);
      expect(vendors.length).toBeGreaterThanOrEqual(1);
      expect(vendors.some(v => v.id === vendor.id)).toBe(true);
    });

    it('should update vendor status', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create vendor
      const vendor = await api.projects.vendors.create(project.id, {
        name: 'Status Test Vendor',
        status: 'Active',
      });

      // Update status
      const updatedVendor = await api.projects.vendors.update(project.id, vendor.vendorId, {
        status: 'Inactive',
      });

      expect(updatedVendor.status).toBe('Inactive');
    });

    it('should add contact person to vendor', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create vendor
      const vendor = await api.projects.vendors.create(project.id, {
        name: 'Vendor with Contact',
        status: 'Active',
      });

      // Add contact person
      const contact = await api.projects.vendors.contacts.create(project.id, vendor.vendorId, {
        firstName: 'John',
        lastName: 'Doe',
        email: `contact-${Date.now()}@example.com`,
        isMainContact: true,
      });

      expect(contact.firstName).toBe('John');
      expect(contact.lastName).toBe('Doe');
      expect(contact.isMainContact).toBe(true);
    });

    it('should delete vendor from project', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create vendor
      const vendor = await api.projects.vendors.create(project.id, {
        name: 'Vendor to Delete',
        status: 'Active',
      });

      // Verify it exists
      const vendors = await api.projects.vendors.list(project.id);
      expect(vendors.some(v => v.id === vendor.id)).toBe(true);

      // Delete vendor
      await api.projects.vendors.delete(project.id, vendor.vendorId);

      // Verify deletion
      const remainingVendors = await api.projects.vendors.list(project.id);
      expect(remainingVendors.some(v => v.id === vendor.id)).toBe(false);
    });
  });

  describe('Dashboard Statistics', () => {
    it('should get dashboard statistics', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const stats = await api.projects.dashboard.getStats(project.id);

      expect(stats).toBeDefined();
      expect(stats.totalTasks).toBeDefined();
      expect(stats.completedTasks).toBeDefined();
      expect(stats.inProgressTasks).toBeDefined();
      expect(stats.notStartedTasks).toBeDefined();
    });
  });

  describe('Complete Project Setup Workflow', () => {
    it('should complete full project setup workflow', async () => {
      // 1. Create project with phases
      const { user: user1, token: token1 } = await createAuthenticatedUser();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token1);
      }

      const project = await api.projects.create({
        name: 'Complete Workflow Project',
        type: 'Construction',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        phases: [
          { name: 'Planning', order: 1 },
          { name: 'Execution', order: 2 },
          { name: 'Completion', order: 3 },
        ],
      });

      // 2. Add project members
      const { user: user2 } = await createAuthenticatedUser({
        email: `member-${Date.now()}@example.com`,
      });
      await api.projects.addMembers(project.id, [user2.id]);

      // 3. Create tasks in phases
      const phases = await api.projects.phases.list(project.id);
      const planningPhase = phases.find(p => p.name === 'Planning') || phases[0];
      const executionPhase = phases.find(p => p.name === 'Execution') || phases[1];

      const task1 = await api.projects.phases.createTask(project.id, planningPhase.id, {
        name: 'Plan Architecture',
        description: 'Plan the system architecture',
        ownerId: user1.id,
      });

      const task2 = await api.projects.phases.createTask(project.id, executionPhase.id, {
        name: 'Implement Features',
        description: 'Implement core features',
        ownerId: user2.id,
      });

      // 4. Add comments to tasks
      await api.projects.phases.tasks.comments.create(
        project.id,
        planningPhase.id,
        task1.id,
        {
          content: 'Architecture planning in progress',
          notifyOption: 'task_owner',
        }
      );

      // 5. Mark task as completed
      await api.projects.phases.updateTask(project.id, planningPhase.id, task1.id, {
        actualCompletionDate: new Date().toISOString(),
      });

      // 6. Add vendors
      const vendor1 = await api.projects.vendors.create(project.id, {
        name: 'Vendor 1',
        status: 'Active',
      });

      const vendor2 = await api.projects.vendors.create(project.id, {
        name: 'Vendor 2',
        status: 'Active',
      });

      // 7. Add contact persons
      await api.projects.vendors.contacts.create(project.id, vendor1.vendorId, {
        firstName: 'John',
        lastName: 'Doe',
        email: `contact1-${Date.now()}@example.com`,
        isMainContact: true,
      });

      // 8. Update vendor status
      await api.projects.vendors.update(project.id, vendor2.vendorId, {
        status: 'Inactive',
      });

      // 9. Get dashboard statistics
      const stats = await api.projects.dashboard.getStats(project.id);
      expect(stats.totalTasks).toBeGreaterThanOrEqual(2);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(1);

      // 10. Verify final state
      const finalPhases = await api.projects.phases.list(project.id);
      expect(finalPhases.length).toBeGreaterThanOrEqual(3);

      const finalTasks = await api.projects.phases.getTasks(project.id, planningPhase.id);
      expect(finalTasks.some(t => t.id === task1.id)).toBe(true);

      const finalVendors = await api.projects.vendors.list(project.id);
      expect(finalVendors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
