/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import './setup'; // Import setup to ensure test server is running
import { api } from '@/lib/api';
import {
  createProjectWithMember,
} from './utils';

/**
 * Requirements Management Workflow Integration Tests
 * 
 * These tests verify the complete requirements management workflow including:
 * - Hierarchy creation and management
 * - Requirement CRUD operations
 * - Reordering hierarchies and requirements
 * - Bulk operations (update, delete)
 * - Requirement movement between hierarchies
 */

describe('Requirements Management Workflow Integration Tests', () => {

  describe('Hierarchy Management', () => {
    it('should create, list, and delete hierarchies', async () => {
      const { project, token } = await createProjectWithMember({
        projectName: 'Requirements Test Project',
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // List hierarchies (should be empty initially)
      const initialHierarchies = await api.requirements.hierarchies.list(project.id);
      expect(Array.isArray(initialHierarchies)).toBe(true);

      // Create a hierarchy
      const hierarchy1 = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy 1',
        description: 'Description for hierarchy 1',
      });

      expect(hierarchy1.title).toBe('Test Hierarchy 1');
      expect(hierarchy1.description).toBe('Description for hierarchy 1');
      expect(hierarchy1.projectId).toBe(project.id);
      expect(hierarchy1.parentId).toBeNull();
      expect(hierarchy1.number).toBeDefined();
      expect(hierarchy1.order).toBeDefined();

      // Create another hierarchy
      const hierarchy2 = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy 2',
        description: 'Description for hierarchy 2',
      });

      // List hierarchies (should now have 2)
      const hierarchies = await api.requirements.hierarchies.list(project.id);
      expect(hierarchies.length).toBeGreaterThanOrEqual(2);
      expect(hierarchies.some(h => h.id === hierarchy1.id)).toBe(true);
      expect(hierarchies.some(h => h.id === hierarchy2.id)).toBe(true);

      // Update hierarchy
      const updatedHierarchy = await api.requirements.hierarchies.update(project.id, hierarchy1.id, {
        title: 'Updated Hierarchy 1',
        description: 'Updated description',
      });

      expect(updatedHierarchy.title).toBe('Updated Hierarchy 1');
      expect(updatedHierarchy.description).toBe('Updated description');

      // Delete hierarchy
      await api.requirements.hierarchies.delete(project.id, hierarchy1.id);

      // Verify deletion
      const remainingHierarchies = await api.requirements.hierarchies.list(project.id);
      expect(remainingHierarchies.some(h => h.id === hierarchy1.id)).toBe(false);
      expect(remainingHierarchies.some(h => h.id === hierarchy2.id)).toBe(true);
    });

    it('should create nested hierarchies', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create parent hierarchy
      const parent = await api.requirements.hierarchies.create(project.id, {
        title: 'Parent Hierarchy',
        description: 'Parent description',
      });

      // Create child hierarchy
      const child = await api.requirements.hierarchies.create(project.id, {
        title: 'Child Hierarchy',
        description: 'Child description',
        parentId: parent.id,
      });

      expect(child.parentId).toBe(parent.id);

      // List hierarchies and verify parent-child relationship
      const hierarchies = await api.requirements.hierarchies.list(project.id);
      const foundChild = hierarchies.find(h => h.id === child.id);
      expect(foundChild).toBeDefined();
      expect(foundChild?.parentId).toBe(parent.id);
    });

    it('should reorder hierarchies', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create multiple hierarchies
      const hierarchy1 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 1',
      });
      const hierarchy2 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 2',
      });
      const hierarchy3 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 3',
      });

      // Get initial order
      const _initialHierarchies = await api.requirements.hierarchies.list(project.id);
      const _initialOrder = [hierarchy1.id, hierarchy2.id, hierarchy3.id];

      // Reorder: 3, 1, 2
      await api.requirements.hierarchies.reorder(project.id, {
        hierarchyIds: [hierarchy3.id, hierarchy1.id, hierarchy2.id],
      });

      // Verify new order
      const reorderedHierarchies = await api.requirements.hierarchies.list(project.id);
      const hierarchy3Index = reorderedHierarchies.findIndex(h => h.id === hierarchy3.id);
      const hierarchy1Index = reorderedHierarchies.findIndex(h => h.id === hierarchy1.id);
      const hierarchy2Index = reorderedHierarchies.findIndex(h => h.id === hierarchy2.id);

      expect(hierarchy3Index).toBeLessThan(hierarchy1Index);
      expect(hierarchy1Index).toBeLessThan(hierarchy2Index);
    });
  });

  describe('Requirement CRUD Operations', () => {
    it('should create, list, update, and delete requirements', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create hierarchy
      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // List requirements (should be empty initially)
      const initialRequirements = await api.requirements.list(project.id);
      expect(Array.isArray(initialRequirements)).toBe(true);

      // Create a requirement
      const requirement1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Test Requirement 1',
        type: 'Information',
        status: null,
      });

      expect(requirement1.description).toBe('Test Requirement 1');
      expect(requirement1.type).toBe('Information');
      expect(requirement1.status).toBeNull();
      expect(requirement1.hierarchyId).toBe(hierarchy.id);
      expect(requirement1.number).toBeDefined();
      expect(requirement1.order).toBeDefined();

      // Create another requirement
      const requirement2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Test Requirement 2',
        type: 'Mandatory',
        status: 'New',
      });

      // List requirements (should now have 2)
      const requirements = await api.requirements.list(project.id);
      expect(requirements.length).toBeGreaterThanOrEqual(2);
      expect(requirements.some(r => r.id === requirement1.id)).toBe(true);
      expect(requirements.some(r => r.id === requirement2.id)).toBe(true);

      // Update requirement
      const updatedRequirement = await api.requirements.update(project.id, requirement1.id, {
        description: 'Updated Requirement 1',
        type: 'Important',
        status: 'ForReview',
      });

      expect(updatedRequirement.description).toBe('Updated Requirement 1');
      expect(updatedRequirement.type).toBe('Important');
      expect(updatedRequirement.status).toBe('ForReview');

      // Delete requirement
      await api.requirements.delete(project.id, requirement1.id);

      // Verify deletion
      const remainingRequirements = await api.requirements.list(project.id);
      expect(remainingRequirements.some(r => r.id === requirement1.id)).toBe(false);
      expect(remainingRequirements.some(r => r.id === requirement2.id)).toBe(true);
    });

    it('should create requirements with different types and statuses', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // Create requirements with different types
      const infoReq = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Information requirement',
        type: 'Information',
        status: null,
      });

      const mandatoryReq = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Mandatory requirement',
        type: 'Mandatory',
        status: 'New',
      });

      const importantReq = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Important requirement',
        type: 'Important',
        status: 'ForReview',
      });

      const wishReq = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Wish requirement',
        type: 'Wish',
        status: 'Approved',
      });

      expect(infoReq.type).toBe('Information');
      expect(mandatoryReq.type).toBe('Mandatory');
      expect(importantReq.type).toBe('Important');
      expect(wishReq.type).toBe('Wish');

      expect(mandatoryReq.status).toBe('New');
      expect(importantReq.status).toBe('ForReview');
      expect(wishReq.status).toBe('Approved');
    });
  });

  describe('Requirement Reordering', () => {
    it('should reorder requirements within a hierarchy', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // Create multiple requirements
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 1',
        type: 'Information',
        status: null,
      });
      const req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 2',
        type: 'Information',
        status: null,
      });
      const req3 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 3',
        type: 'Information',
        status: null,
      });

      // Get initial order
      const initialRequirements = await api.requirements.list(project.id);
      const _req1InitialOrder = initialRequirements.find(r => r.id === req1.id)?.order || 0;
      const _req2InitialOrder = initialRequirements.find(r => r.id === req2.id)?.order || 0;
      const _req3InitialOrder = initialRequirements.find(r => r.id === req3.id)?.order || 0;

      // Reorder: 3, 1, 2
      await api.requirements.reorder(project.id, {
        requirementIds: [req3.id, req1.id, req2.id],
        hierarchyId: hierarchy.id,
      });

      // Verify new order
      const reorderedRequirements = await api.requirements.list(project.id);
      const req3NewOrder = reorderedRequirements.find(r => r.id === req3.id)?.order || 0;
      const req1NewOrder = reorderedRequirements.find(r => r.id === req1.id)?.order || 0;
      const req2NewOrder = reorderedRequirements.find(r => r.id === req2.id)?.order || 0;

      expect(req3NewOrder).toBeLessThan(req1NewOrder);
      expect(req1NewOrder).toBeLessThan(req2NewOrder);
    });
  });

  describe('Requirement Movement', () => {
    it('should move requirement between hierarchies', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // Create two hierarchies
      const hierarchy1 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 1',
      });
      const hierarchy2 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 2',
      });

      // Create requirement in hierarchy1
      const requirement = await api.requirements.create(project.id, {
        hierarchyId: hierarchy1.id,
        description: 'Movable Requirement',
        type: 'Information',
        status: null,
      });

      expect(requirement.hierarchyId).toBe(hierarchy1.id);

      // Move requirement to hierarchy2
      const movedRequirement = await api.requirements.move(project.id, requirement.id, {
        hierarchyId: hierarchy2.id,
      });

      expect(movedRequirement.hierarchyId).toBe(hierarchy2.id);

      // Verify requirement is now in hierarchy2
      const requirements = await api.requirements.list(project.id);
      const foundRequirement = requirements.find(r => r.id === requirement.id);
      expect(foundRequirement?.hierarchyId).toBe(hierarchy2.id);
    });

    it('should move requirement with specific order', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // Create existing requirements
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 1',
        type: 'Information',
        status: null,
      });
      const _req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 2',
        type: 'Information',
        status: null,
      });

      // Create new requirement in different hierarchy
      const otherHierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Other Hierarchy',
      });
      const newReq = await api.requirements.create(project.id, {
        hierarchyId: otherHierarchy.id,
        description: 'New Requirement',
        type: 'Information',
        status: null,
      });

      // Move new requirement to first hierarchy with specific order (between req1 and req2)
      const movedReq = await api.requirements.move(project.id, newReq.id, {
        hierarchyId: hierarchy.id,
        order: req1.order + 1,
      });

      expect(movedReq.hierarchyId).toBe(hierarchy.id);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk update requirements', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // Create multiple requirements
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 1',
        type: 'Information',
        status: null,
      });
      const req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 2',
        type: 'Information',
        status: null,
      });
      const req3 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 3',
        type: 'Information',
        status: null,
      });

      // Bulk update type and status
      const updatedRequirements = await api.requirements.bulkUpdate(project.id, {
        requirementIds: [req1.id, req2.id, req3.id],
        type: 'Mandatory',
        status: 'ForReview',
      });

      expect(updatedRequirements.length).toBe(3);
      updatedRequirements.forEach(req => {
        expect(req.type).toBe('Mandatory');
        expect(req.status).toBe('ForReview');
      });

      // Verify updates persisted
      const requirements = await api.requirements.list(project.id);
      const updatedReq1 = requirements.find(r => r.id === req1.id);
      const updatedReq2 = requirements.find(r => r.id === req2.id);
      const updatedReq3 = requirements.find(r => r.id === req3.id);

      expect(updatedReq1?.type).toBe('Mandatory');
      expect(updatedReq1?.status).toBe('ForReview');
      expect(updatedReq2?.type).toBe('Mandatory');
      expect(updatedReq2?.status).toBe('ForReview');
      expect(updatedReq3?.type).toBe('Mandatory');
      expect(updatedReq3?.status).toBe('ForReview');
    });

    it('should bulk update requirements to move to different hierarchy', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy1 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 1',
      });
      const hierarchy2 = await api.requirements.hierarchies.create(project.id, {
        title: 'Hierarchy 2',
      });

      // Create requirements in hierarchy1
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy1.id,
        description: 'Requirement 1',
        type: 'Information',
        status: null,
      });
      const req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy1.id,
        description: 'Requirement 2',
        type: 'Information',
        status: null,
      });

      // Bulk move to hierarchy2
      const updatedRequirements = await api.requirements.bulkUpdate(project.id, {
        requirementIds: [req1.id, req2.id],
        hierarchyId: hierarchy2.id,
      });

      expect(updatedRequirements.length).toBe(2);
      updatedRequirements.forEach(req => {
        expect(req.hierarchyId).toBe(hierarchy2.id);
      });

      // Verify requirements are now in hierarchy2
      const requirements = await api.requirements.list(project.id);
      const movedReq1 = requirements.find(r => r.id === req1.id);
      const movedReq2 = requirements.find(r => r.id === req2.id);

      expect(movedReq1?.hierarchyId).toBe(hierarchy2.id);
      expect(movedReq2?.hierarchyId).toBe(hierarchy2.id);
    });

    it('should bulk delete requirements', async () => {
      const { project, token } = await createProjectWithMember();
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      const hierarchy = await api.requirements.hierarchies.create(project.id, {
        title: 'Test Hierarchy',
      });

      // Create multiple requirements
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 1',
        type: 'Information',
        status: null,
      });
      const req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 2',
        type: 'Information',
        status: null,
      });
      const req3 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: 'Requirement 3',
        type: 'Information',
        status: null,
      });

      // Verify they exist
      let requirements = await api.requirements.list(project.id);
      expect(requirements.some(r => r.id === req1.id)).toBe(true);
      expect(requirements.some(r => r.id === req2.id)).toBe(true);
      expect(requirements.some(r => r.id === req3.id)).toBe(true);

      // Bulk delete
      await api.requirements.bulkDelete(project.id, {
        requirementIds: [req1.id, req2.id],
      });

      // Verify deletion
      requirements = await api.requirements.list(project.id);
      expect(requirements.some(r => r.id === req1.id)).toBe(false);
      expect(requirements.some(r => r.id === req2.id)).toBe(false);
      expect(requirements.some(r => r.id === req3.id)).toBe(true); // req3 should still exist
    });
  });

  describe('Complete Workflow', () => {
    it('should complete full requirements management workflow', async () => {
      const { project, token } = await createProjectWithMember({
        projectName: 'Complete Requirements Workflow Project',
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
      }

      // 1. Create hierarchies
      const hierarchy1 = await api.requirements.hierarchies.create(project.id, {
        title: 'Functional Requirements',
        description: 'Functional requirements hierarchy',
      });
      const hierarchy2 = await api.requirements.hierarchies.create(project.id, {
        title: 'Non-Functional Requirements',
        description: 'Non-functional requirements hierarchy',
      });

      // 2. Create requirements in hierarchy1
      const req1 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy1.id,
        description: 'User authentication requirement',
        type: 'Mandatory',
        status: 'New',
      });
      const req2 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy1.id,
        description: 'Data export requirement',
        type: 'Important',
        status: 'New',
      });

      // 3. Create requirements in hierarchy2
      const req3 = await api.requirements.create(project.id, {
        hierarchyId: hierarchy2.id,
        description: 'Performance requirement',
        type: 'Mandatory',
        status: 'New',
      });

      // 4. Reorder requirements in hierarchy1
      await api.requirements.reorder(project.id, {
        requirementIds: [req2.id, req1.id],
        hierarchyId: hierarchy1.id,
      });

      // 5. Update requirement status
      await api.requirements.update(project.id, req1.id, {
        status: 'ForReview',
      });

      // 6. Bulk update requirements in hierarchy1
      await api.requirements.bulkUpdate(project.id, {
        requirementIds: [req1.id, req2.id],
        status: 'Approved',
      });

      // 7. Move requirement from hierarchy1 to hierarchy2
      await api.requirements.move(project.id, req2.id, {
        hierarchyId: hierarchy2.id,
      });

      // 8. Verify final state
      const finalRequirements = await api.requirements.list(project.id);
      const finalReq1 = finalRequirements.find(r => r.id === req1.id);
      const finalReq2 = finalRequirements.find(r => r.id === req2.id);
      const finalReq3 = finalRequirements.find(r => r.id === req3.id);

      expect(finalReq1?.hierarchyId).toBe(hierarchy1.id);
      expect(finalReq1?.status).toBe('Approved');
      expect(finalReq2?.hierarchyId).toBe(hierarchy2.id);
      expect(finalReq2?.status).toBe('Approved');
      expect(finalReq3?.hierarchyId).toBe(hierarchy2.id);
      expect(finalReq3?.status).toBe('New');
    });
  });
});





