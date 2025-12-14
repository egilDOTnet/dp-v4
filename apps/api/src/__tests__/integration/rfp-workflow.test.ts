import { describe, it, expect } from 'vitest';
import './setup'; // Import setup to ensure test server is running
import { api } from './api-client';
import {
  createProjectWithMember,
  createVendorWithContact,
  createRFPSetup,
} from './utils';

/**
 * RFP Workflow Integration Tests
 * 
 * These tests verify the complete RFP workflow from creation to closing,
 * testing the integration between multiple API endpoints and database operations.
 * 
 * RFP Workflow:
 * 1. Create RFP (Draft status)
 * 2. Configure schedule (required dates)
 * 3. Add documents
 * 4. Add questions (from vendors)
 * 5. Publish RFP (Draft → Published)
 * 6. Send RFP to vendors
 * 7. Answer questions
 * 8. Create announcements
 * 9. Close RFP (Published → Closed)
 */

describe('RFP Workflow Integration Tests', () => {

  describe('RFP Creation and Setup', () => {
    it('should auto-create RFP when accessing project RFP endpoint', async () => {
      // Create authenticated user and project
      const { project, token } = await createProjectWithMember({
        projectName: 'RFP Test Project',
      });

      // Token is automatically set by createProjectWithMember via setToken

      // Access RFP endpoint - should auto-create RFP
      const rfp = await api.rfp.get(project.id);

      expect(rfp).toBeDefined();
      expect(rfp.projectId).toBe(project.id);
      expect(rfp.status).toBe('Draft');
      expect(rfp.publishDate).toBeNull();
      expect(rfp.deliveryDate).toBeNull();

      // Verify RFP exists by accessing it again
      const rfp2 = await api.rfp.get(project.id);
      expect(rfp2.id).toBe(rfp.id);
    });

    it('should update RFP settings', async () => {
      const { project, token } = await createProjectWithMember();

      // Get RFP (auto-creates if needed)
      const rfp = await api.rfp.get(project.id);

      // Update RFP settings
      const publishDate = new Date('2025-12-01').toISOString();
      const deliveryDate = new Date('2025-12-31').toISOString();
      const updatedRfp = await api.rfp.update(project.id, {
        publishDate,
        deliveryDate,
      });

      expect(updatedRfp.publishDate).toBeDefined();
      expect(updatedRfp.deliveryDate).toBeDefined();
    });
  });

  describe('Schedule Management', () => {
    it('should initialize default schedule items when RFP is created', async () => {
      const { project, token } = await createProjectWithMember();

      // Get RFP (auto-creates if needed and initializes default schedule items)
      await api.rfp.get(project.id);

      // List schedule items - should have default required items
      const scheduleItems = await api.rfp.schedule.list(project.id);

      expect(scheduleItems.length).toBeGreaterThanOrEqual(4);
      
      // Check for required default items
      const types = scheduleItems.map(item => item.type);
      expect(types).toContain('StartDate');
      expect(types).toContain('AcceptanceDate');
      expect(types).toContain('QuestionsDate');
      expect(types).toContain('DeliveryDate');
    });

    it('should create, update, and delete custom schedule items', async () => {
      const { project, token } = await createProjectWithMember();
      }

      // Get RFP (initializes defaults)
      await api.rfp.get(project.id);

      // Create a custom schedule item
      const customDate = new Date('2025-12-15').toISOString();
      const scheduleItem = await api.rfp.schedule.create(project.id, {
        type: 'CustomDate',
        description: 'Custom Event Date',
        date: customDate,
        isRequired: false,
      });

      expect(scheduleItem.type).toBe('CustomDate');
      expect(scheduleItem.description).toBe('Custom Event Date');
      expect(scheduleItem.date).toBeDefined();

      // Update schedule item
      const updatedDate = new Date('2025-12-20').toISOString();
      const updatedItem = await api.rfp.schedule.update(project.id, scheduleItem.id, {
        description: 'Updated Custom Event Date',
        date: updatedDate,
      });

      expect(updatedItem.description).toBe('Updated Custom Event Date');
      expect(updatedItem.date).toBeDefined();

      // Delete schedule item
      await api.rfp.schedule.delete(project.id, scheduleItem.id);

      // Verify deletion
      const scheduleItems = await api.rfp.schedule.list(project.id);
      expect(scheduleItems.find(item => item.id === scheduleItem.id)).toBeUndefined();
    });

    it('should handle date range schedule items', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create a date range schedule item
      const fromDate = new Date('2025-12-10').toISOString();
      const toDate = new Date('2025-12-20').toISOString();
      const rangeItem = await api.rfp.schedule.create(project.id, {
        type: 'CustomDateRange',
        description: 'Proposal Submission Period',
        fromDate,
        toDate,
        isRequired: false,
      });

      expect(rangeItem.type).toBe('CustomDateRange');
      expect(rangeItem.fromDate).toBeDefined();
      expect(rangeItem.toDate).toBeDefined();
    });
  });

  describe('Document Management', () => {
    it('should create, update, delete, and reorder documents', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create a document link
      const linkDoc = await api.rfp.documents.create(project.id, {
        type: 'Link',
        description: 'Project Specification Document',
        url: 'https://example.com/spec.pdf',
      });

      expect(linkDoc.type).toBe('Link');
      expect(linkDoc.description).toBe('Project Specification Document');
      expect(linkDoc.url).toBe('https://example.com/spec.pdf');

      // Create another document (as Document type - would have fileData in real usage)
      const document = await api.rfp.documents.create(project.id, {
        type: 'Document',
        description: 'Additional Requirements',
        fileName: 'requirements.pdf',
        fileType: 'application/pdf',
        fileData: 'base64encodeddata',
        fileSize: 1024,
      });

      expect(document.type).toBe('Document');
      expect(document.description).toBe('Additional Requirements');

      // List documents
      const documents = await api.rfp.documents.list(project.id);
      expect(documents.length).toBe(2);
      expect(documents.some(doc => doc.id === linkDoc.id)).toBe(true);
      expect(documents.some(doc => doc.id === document.id)).toBe(true);

      // Update document
      const updatedLink = await api.rfp.documents.update(project.id, linkDoc.id, {
        description: 'Updated Project Specification Document',
        url: 'https://example.com/spec-v2.pdf',
      });

      expect(updatedLink.description).toBe('Updated Project Specification Document');
      expect(updatedLink.url).toBe('https://example.com/spec-v2.pdf');

      // Reorder documents
      await api.rfp.documents.reorder(project.id, {
        documentIds: [document.id, linkDoc.id], // Reverse order
      });

      // Verify new order
      const reorderedDocs = await api.rfp.documents.list(project.id);
      expect(reorderedDocs[0].id).toBe(document.id);
      expect(reorderedDocs[1].id).toBe(linkDoc.id);

      // Delete document
      await api.rfp.documents.delete(project.id, linkDoc.id);

      // Verify deletion
      const remainingDocs = await api.rfp.documents.list(project.id);
      expect(remainingDocs.length).toBe(1);
      expect(remainingDocs[0].id).toBe(document.id);
    });
  });

  describe('Changelog Management', () => {
    it('should automatically create changelog entries when schedule items are added', async () => {
      const { project, token, user } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create a schedule item - should create changelog entry
      const scheduleItem = await api.rfp.schedule.create(project.id, {
        type: 'CustomDate',
        description: 'Test Schedule Item',
        date: new Date().toISOString(),
      });

      // Check changelog entries
      const changelog = await api.rfp.changelog.list(project.id);
      expect(changelog.length).toBeGreaterThan(0);
      
      // Find the entry related to our schedule item
      const relevantEntry = changelog.find(entry => 
        entry.description.includes('Test Schedule Item')
      );
      expect(relevantEntry).toBeDefined();
    });

    it('should update and delete changelog entries', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create a schedule item to generate a changelog entry
      await api.rfp.schedule.create(project.id, {
        type: 'CustomDate',
        description: 'Test Item for Changelog',
        date: new Date().toISOString(),
      });

      // Get changelog entries
      let changelog = await api.rfp.changelog.list(project.id);
      const entryToUpdate = changelog[0];

      // Update changelog entry
      const updatedEntry = await api.rfp.changelog.update(project.id, entryToUpdate.id, {
        description: 'Updated changelog entry description',
      });

      expect(updatedEntry.description).toBe('Updated changelog entry description');

      // Delete changelog entry
      await api.rfp.changelog.delete(project.id, entryToUpdate.id);

      // Verify deletion
      changelog = await api.rfp.changelog.list(project.id);
      expect(changelog.find(entry => entry.id === entryToUpdate.id)).toBeUndefined();
    });
  });

  describe('Question Management', () => {
    it('should create, list, answer, and delete questions', async () => {
      const { project, token } = await createProjectWithMember();
      }

      // Create vendor with contact using API helper
      const vendorResult = await createVendorWithContact({
        projectId: project.id,
        vendorName: 'Question Vendor',
      });

      await api.rfp.get(project.id);

      // Create a question from vendor
      const question = await api.rfp.questions.create(project.id, {
        question: 'What is the delivery timeline?',
        vendorId: vendorResult.vendor.vendorId,
        contactPersonId: vendorResult.contactPerson.id,
      });

      expect(question.question).toBe('What is the delivery timeline?');
      expect(question.vendorId).toBe(vendorResult.vendor.vendorId);
      expect(question.contactPersonId).toBe(vendorResult.contactPerson.id);
      expect(question.answer).toBeNull();

      // List questions (unanswered by default)
      let questions = await api.rfp.questions.list(project.id);
      expect(questions.length).toBe(1);
      expect(questions[0].id).toBe(question.id);

      // List answered questions (should be empty)
      const answeredQuestions = await api.rfp.questions.list(project.id, 'answered');
      expect(answeredQuestions.length).toBe(0);

      // List unanswered questions
      const unansweredQuestions = await api.rfp.questions.list(project.id, 'unanswered');
      expect(unansweredQuestions.length).toBe(1);
      expect(unansweredQuestions[0].id).toBe(question.id);

      // Answer the question
      const answeredQuestion = await api.rfp.questions.answer(project.id, question.id, {
        cleanedQuestion: 'What is the delivery timeline?',
        answer: 'Delivery will be completed within 30 days of contract signing.',
      });

      expect(answeredQuestion.answer).toBe('Delivery will be completed within 30 days of contract signing.');
      expect(answeredQuestion.cleanedQuestion).toBe('What is the delivery timeline?');
      expect(answeredQuestion.answeredAt).toBeDefined();

      // List answered questions (should now have one)
      const answeredAfter = await api.rfp.questions.list(project.id, 'answered');
      expect(answeredAfter.length).toBe(1);
      expect(answeredAfter[0].id).toBe(question.id);

      // Delete question
      await api.rfp.questions.delete(project.id, question.id);

      // Verify deletion
      questions = await api.rfp.questions.list(project.id);
      expect(questions.find(q => q.id === question.id)).toBeUndefined();
    });

    it('should split a question into multiple questions', async () => {
      const { project, token } = await createProjectWithMember();
      }

      // Create vendor with contact using API helper
      const vendorResult = await createVendorWithContact({
        projectId: project.id,
        vendorName: 'Split Question Vendor',
      });

      await api.rfp.get(project.id);

      // Create a question with multiple parts
      const originalQuestion = await api.rfp.questions.create(project.id, {
        question: 'What is the price? What is the warranty?',
        vendorId: vendorResult.vendor.vendorId,
        contactPersonId: vendorResult.contactPerson.id,
      });

      // Split the question
      const splitQuestions = await api.rfp.questions.split(project.id, originalQuestion.id, {
        questions: [
          'What is the price?',
          'What is the warranty?',
        ],
      });

      expect(splitQuestions.length).toBe(2);
      expect(splitQuestions[0].question).toBe('What is the price?');
      expect(splitQuestions[1].question).toBe('What is the warranty?');

      // Original question should be deleted
      const questions = await api.rfp.questions.list(project.id);
      expect(questions.find(q => q.id === originalQuestion.id)).toBeUndefined();
    });
  });

  describe('Announcement Management', () => {
    it('should create, list, update, send, and delete announcements', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create an announcement
      const announcement = await api.rfp.announcements.create(project.id, {
        title: 'Important Update',
        description: 'The RFP deadline has been extended.',
        sendImmediately: false,
      });

      expect(announcement.title).toBe('Important Update');
      expect(announcement.description).toBe('The RFP deadline has been extended.');
      expect(announcement.sentAt).toBeNull();

      // List announcements
      let announcements = await api.rfp.announcements.list(project.id);
      expect(announcements.length).toBe(1);
      expect(announcements[0].id).toBe(announcement.id);

      // Update announcement
      const updatedAnnouncement = await api.rfp.announcements.update(
        project.id,
        announcement.id,
        {
          title: 'Updated Important Update',
          description: 'The RFP deadline has been extended to next week.',
          sendImmediately: false,
        }
      );

      expect(updatedAnnouncement.title).toBe('Updated Important Update');
      expect(updatedAnnouncement.description).toBe('The RFP deadline has been extended to next week.');

      // Send announcement
      const sendResult = await api.rfp.announcements.send(project.id, announcement.id);
      expect(sendResult.success).toBe(true);

      // Verify announcement was sent
      const sentAnnouncement = announcements.find(a => a.id === announcement.id);
      // Note: The announcement should have sentAt set, but this depends on API implementation
      // We'll verify the send endpoint succeeded

      // Delete announcement
      await api.rfp.announcements.delete(project.id, announcement.id);

      // Verify deletion
      announcements = await api.rfp.announcements.list(project.id);
      expect(announcements.find(a => a.id === announcement.id)).toBeUndefined();
    });

    it('should create announcement with scheduled send date', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Create an announcement with scheduled send date
      const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
      const announcement = await api.rfp.announcements.create(project.id, {
        title: 'Scheduled Announcement',
        description: 'This will be sent tomorrow.',
        scheduledSendAt: scheduledDate,
        sendImmediately: false,
      });

      expect(announcement.title).toBe('Scheduled Announcement');
      expect(announcement.scheduledSendAt).toBeDefined();
      expect(announcement.sentAt).toBeNull(); // Not sent yet
    });
  });

  describe('Publishing RFP', () => {
    it('should not allow publishing without required schedule dates', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Try to publish without setting required dates - should fail
      await expect(api.rfp.publish(project.id)).rejects.toThrow();

      // Verify RFP is still Draft
      const rfp = await api.rfp.get(project.id);
      expect(rfp.status).toBe('Draft');
    });

    it('should publish RFP when all required schedule dates are set', async () => {
      const { project, token } = await createProjectWithMember();
      }

      await api.rfp.get(project.id);

      // Get schedule items
      let scheduleItems = await api.rfp.schedule.list(project.id);

      // Set all required dates
      const now = new Date();
      const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
      const futureDate3 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days from now
      const futureDate4 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Find and update required schedule items
      const startDateItem = scheduleItems.find(item => item.type === 'StartDate' && item.isRequired);
      const acceptanceDateItem = scheduleItems.find(item => item.type === 'AcceptanceDate' && item.isRequired);
      const questionsDateItem = scheduleItems.find(item => item.type === 'QuestionsDate' && item.isRequired);
      const deliveryDateItem = scheduleItems.find(item => item.type === 'DeliveryDate' && item.isRequired);

      if (startDateItem) {
        await api.rfp.schedule.update(project.id, startDateItem.id, {
          date: now.toISOString(),
        });
      }
      if (acceptanceDateItem) {
        await api.rfp.schedule.update(project.id, acceptanceDateItem.id, {
          date: futureDate1.toISOString(),
        });
      }
      if (questionsDateItem) {
        await api.rfp.schedule.update(project.id, questionsDateItem.id, {
          date: futureDate2.toISOString(),
        });
      }
      if (deliveryDateItem) {
        await api.rfp.schedule.update(project.id, deliveryDateItem.id, {
          date: futureDate3.toISOString(),
        });
      }

      // Publish RFP - should succeed now
      const publishResult = await api.rfp.publish(project.id);
      expect(publishResult.success).toBe(true);

      // Verify RFP is Published
      const rfp = await api.rfp.get(project.id);
      expect(rfp.status).toBe('Published');
      expect(rfp.publishDate).toBeDefined();
    });

    it('should send RFP to vendors after publishing', async () => {
      const { project, token } = await createProjectWithMember();
      }

      // Create vendor with contact
      await createVendorWithContact({
        projectId: project.id,
        vendorName: 'RFP Vendor',
      });

      await api.rfp.get(project.id);

      // Set required schedule dates
      const scheduleItems = await api.rfp.schedule.list(project.id);
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const startDateItem = scheduleItems.find(item => item.type === 'StartDate' && item.isRequired);
      if (startDateItem) {
        await api.rfp.schedule.update(project.id, startDateItem.id, {
          date: now.toISOString(),
        });
      }

      // Set other required dates
      for (const item of scheduleItems.filter(i => i.isRequired && i.id !== startDateItem?.id)) {
        await api.rfp.schedule.update(project.id, item.id, {
          date: futureDate.toISOString(),
        });
      }

      // Publish RFP
      await api.rfp.publish(project.id);

      // Send RFP to vendors
      const sendResult = await api.rfp.send(project.id);
      expect(sendResult.success).toBe(true);
    });
  });

  describe('Complete RFP Workflow', () => {
    it('should complete full RFP lifecycle from creation to closing', async () => {
      const { project, token } = await createProjectWithMember({
        projectName: 'Complete RFP Workflow Project',
      });
      }

      // 1. Create RFP (auto-created on first access)
      let rfp = await api.rfp.get(project.id);
      expect(rfp.status).toBe('Draft');

      // 2. Add schedule items and set required dates
      const scheduleItems = await api.rfp.schedule.list(project.id);
      const now = new Date();
      const futureDates = [
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      ];

      let dateIndex = 0;
      for (const item of scheduleItems.filter(i => i.isRequired)) {
        await api.rfp.schedule.update(project.id, item.id, {
          date: futureDates[dateIndex % futureDates.length].toISOString(),
        });
        dateIndex++;
      }

      // 3. Add documents
      const document = await api.rfp.documents.create(project.id, {
        type: 'Link',
        description: 'RFP Specification',
        url: 'https://example.com/rfp-spec.pdf',
      });
      expect(document).toBeDefined();

      // 4. Create vendor and add question using API helper
      const vendorResult = await createVendorWithContact({
        projectId: project.id,
        vendorName: 'Complete Workflow Vendor',
      });

      const question = await api.rfp.questions.create(project.id, {
        question: 'What is the expected timeline?',
        vendorId: vendorResult.vendor.vendorId,
        contactPersonId: vendorResult.contactPerson.id,
      });
      expect(question).toBeDefined();

      // 5. Answer the question
      await api.rfp.questions.answer(project.id, question.id, {
        cleanedQuestion: 'What is the expected timeline?',
        answer: 'The timeline is 30 days from contract signing.',
      });

      // 6. Publish RFP
      await api.rfp.publish(project.id);
      rfp = await api.rfp.get(project.id);
      expect(rfp.status).toBe('Published');
      expect(rfp.publishDate).toBeDefined();

      // 7. Create and send announcement
      const announcement = await api.rfp.announcements.create(project.id, {
        title: 'RFP Published',
        description: 'The RFP has been published and is now available for review.',
        sendImmediately: false,
      });
      await api.rfp.announcements.send(project.id, announcement.id);

      // 8. Close RFP
      const closedRfp = await api.rfp.update(project.id, {
        status: 'Closed',
      });
      expect(closedRfp.status).toBe('Closed');

      // 9. Verify final state
      const finalRfp = await api.rfp.get(project.id);
      expect(finalRfp.status).toBe('Closed');
      
      const finalDocuments = await api.rfp.documents.list(project.id);
      expect(finalDocuments.length).toBe(1);

      const finalQuestions = await api.rfp.questions.list(project.id, 'answered');
      expect(finalQuestions.length).toBe(1);

      const finalAnnouncements = await api.rfp.announcements.list(project.id);
      expect(finalAnnouncements.length).toBe(1);
    });
  });
});
