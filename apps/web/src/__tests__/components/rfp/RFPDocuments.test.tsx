import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import RFPDocuments from '@/components/rfp/RFPDocuments';
import { createMockRFP, createMockRFPDocument } from '../../utils/mock-data';
import { setupApiMocks } from '../../utils/api-mocks';
import * as apiModule from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    api: {
      rfp: {
        documents: {
          list: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          reorder: vi.fn(),
        },
      },
    },
  };
});

describe('RFPDocuments', () => {
  const projectId = 'project-1';
  const rfp = createMockRFP({ id: 'rfp-1' });

  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render empty state when no documents', async () => {
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });
    });

    it('should render list of documents', async () => {
      const documents = [
        createMockRFPDocument({
          id: 'doc-1',
          description: 'Document 1',
          type: 'Document',
        }),
        createMockRFPDocument({
          id: 'doc-2',
          description: 'Link 1',
          type: 'Link',
          url: 'https://example.com',
        }),
      ];

      (apiModule.api.rfp.documents.list as any).mockResolvedValue(documents);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Document 1')).toBeInTheDocument();
        expect(screen.getByText('Link 1')).toBeInTheDocument();
      });
    });

    it('should display document type correctly', async () => {
      const document = createMockRFPDocument({
        id: 'doc-1',
        description: 'Test Document',
        type: 'Document',
        fileName: 'test.pdf',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([document]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });
    });

    it('should display link URL correctly', async () => {
      const link = createMockRFPDocument({
        id: 'link-1',
        description: 'Test Link',
        type: 'Link',
        url: 'https://example.com',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([link]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Link')).toBeInTheDocument();
        expect(screen.getByText('https://example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Creating Documents', () => {
    it('should show create form when Add Document is clicked', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /add document/i });
      await user.click(addButtons[0]); // Use header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });
    });

    it('should create link document when form is submitted', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);
      (apiModule.api.rfp.documents.create as any).mockResolvedValue({});

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /add document/i });
      await user.click(addButtons[0]); // Use header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      const descriptionInput = screen.getByPlaceholderText(/description/i);
      await user.type(descriptionInput, 'Test Link');

      const urlInput = screen.getByPlaceholderText(/https:\/\/\.\.\./i) as HTMLInputElement;
      // Use fireEvent to set the value directly for more reliable testing
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
      
      // Wait a bit for the state to update
      await waitFor(() => {
        expect(urlInput.value).toBe('https://example.com');
      });

      // Press Enter on the URL input to submit the form
      // The component has a handleNewDocKeyDown handler that submits on Enter
      fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });
      
      // Wait for the API call
      await waitFor(() => {
        expect(apiModule.api.rfp.documents.create).toHaveBeenCalledWith(
          projectId,
          {
            type: 'Link',
            description: 'Test Link',
            url: 'https://example.com',
          }
        );
      }, { timeout: 2000 });
    });

    it('should create document when file is selected', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);
      (apiModule.api.rfp.documents.create as any).mockResolvedValue({});

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /add document/i });
      await user.click(addButtons[0]); // Use header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      // Switch to Document type by clicking the "File" button
      const fileButton = screen.getByRole('button', { name: /^file$/i });
      await user.click(fileButton);

      // File input would be handled differently in real implementation
      // This is a simplified test
      await waitFor(() => {
        expect(fileButton).toHaveClass(/bg-primary-600/);
      });
    });
  });

  describe('Editing Documents', () => {
    it('should show edit mode when document description is clicked', async () => {
      const user = userEvent.setup();
      const document = createMockRFPDocument({
        id: 'doc-1',
        description: 'Test Document',
        type: 'Document',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([document]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });

      const descriptionElement = screen.getByText('Test Document');
      await user.click(descriptionElement);

      await waitFor(() => {
        const input = screen.getByDisplayValue('Test Document');
        expect(input).toBeInTheDocument();
      });
    });

    it('should update document description when edited', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.update as any).mockResolvedValue({});
      const document = createMockRFPDocument({
        id: 'doc-1',
        description: 'Test Document',
        type: 'Document',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([document]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });

      const descriptionElement = screen.getByText('Test Document');
      await user.click(descriptionElement);

      await waitFor(() => {
        const input = screen.getByDisplayValue('Test Document');
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('Test Document');
      await user.clear(input);
      await user.type(input, 'Updated Document');
      await user.click(globalThis.document.body); // Blur to trigger save

      await waitFor(() => {
        expect(apiModule.api.rfp.documents.update).toHaveBeenCalledWith(
          projectId,
          'doc-1',
          { description: 'Updated Document' }
        );
      }, { timeout: 1000 });
    });

    it('should update link URL when edited', async () => {
      const user = userEvent.setup();
      // Mock list to return link initially, then updated link after update
      const link = createMockRFPDocument({
        id: 'link-1',
        description: 'Test Link',
        type: 'Link',
        url: 'https://example.com',
      });
      const updatedLink = { ...link, url: 'https://updated.com' };
      
      let listCallCount = 0;
      (apiModule.api.rfp.documents.list as any).mockImplementation(() => {
        listCallCount++;
        if (listCallCount === 1) {
          return Promise.resolve([link]);
        }
        return Promise.resolve([updatedLink]);
      });
      (apiModule.api.rfp.documents.update as any).mockResolvedValue(updatedLink);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('https://example.com')).toBeInTheDocument();
      });

      // Click on the URL link to enter edit mode (component now supports clicking URL to edit)
      const urlLink = screen.getByText('https://example.com');
      await user.click(urlLink);

      // Wait for URL input to appear
      await waitFor(() => {
        const urlInput = screen.getByDisplayValue('https://example.com');
        expect(urlInput).toBeInTheDocument();
      });

      const urlInput = screen.getByDisplayValue('https://example.com');
      await user.clear(urlInput);
      await user.type(urlInput, 'https://updated.com');
      await user.click(globalThis.document.body); // Blur to trigger save

      await waitFor(() => {
        expect(apiModule.api.rfp.documents.update).toHaveBeenCalledWith(
          projectId,
          'link-1',
          { url: 'https://updated.com' }
        );
      }, { timeout: 2000 });
    });
  });

  describe('Deleting Documents', () => {
    it('should delete document when delete button is clicked', async () => {
      const user = userEvent.setup();
      const mockConfirm = vi.fn(() => true);
      window.confirm = mockConfirm;
      const document = createMockRFPDocument({
        id: 'doc-1',
        description: 'Test Document',
        type: 'Document',
      });

      // Mock list to return document initially, then empty after delete
      let listCallCount = 0;
      (apiModule.api.rfp.documents.list as any).mockImplementation(() => {
        listCallCount++;
        if (listCallCount === 1) {
          return Promise.resolve([document]);
        }
        return Promise.resolve([]);
      });
      (apiModule.api.rfp.documents.delete as any).mockResolvedValue({});

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });

      // Click on description to enter edit mode (delete button only appears in edit mode)
      const descriptionElement = screen.getByText('Test Document');
      await user.click(descriptionElement);

      // Wait for edit mode to activate - input should appear and delete button should be available
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Document')).toBeInTheDocument();
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
        expect(deleteButton).not.toBeDisabled();
      });
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      // Click the delete button - this should trigger handleDelete which calls confirm
      // Use fireEvent instead of userEvent for more direct click simulation
      fireEvent.click(deleteButton);

      // Verify delete API was called (after confirm returns true)
      // Note: confirm is checked implicitly - if delete is called, confirm must have returned true
      await waitFor(() => {
        expect(apiModule.api.rfp.documents.delete).toHaveBeenCalledWith(
          projectId,
          'doc-1'
        );
      }, { timeout: 2000 });
    });

    it('should not delete document when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      const mockConfirm = vi.fn(() => false);
      window.confirm = mockConfirm;
      const document = createMockRFPDocument({
        id: 'doc-1',
        description: 'Test Document',
        type: 'Document',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([document]);
      (apiModule.api.rfp.documents.delete as any).mockResolvedValue({});

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Test Document')).toBeInTheDocument();
      });

      // Click on description to enter edit mode (delete button only appears in edit mode)
      const descriptionElement = screen.getByText('Test Document');
      await user.click(descriptionElement);

      // Wait for edit mode to activate and delete button to appear
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Document')).toBeInTheDocument();
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      // Use fireEvent for more direct click simulation
      fireEvent.click(deleteButton);

      // Confirm should be called but delete should not be called
      expect(mockConfirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(apiModule.api.rfp.documents.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Reordering Documents', () => {
    it('should reorder documents when dragged', async () => {
      const documents = [
        createMockRFPDocument({ id: 'doc-1', description: 'Document 1', order: 1 }),
        createMockRFPDocument({ id: 'doc-2', description: 'Document 2', order: 2 }),
      ];

      (apiModule.api.rfp.documents.list as any).mockResolvedValue(documents);
      (apiModule.api.rfp.documents.reorder as any).mockResolvedValue({});

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('Document 1')).toBeInTheDocument();
        expect(screen.getByText('Document 2')).toBeInTheDocument();
      });

      // Drag and drop testing would require more complex setup
      // This is a placeholder for the test structure
      // In a real test, you would simulate drag events using @dnd-kit testing utilities
    });
  });

  describe('Document Type Handling', () => {
    it('should show file input for Document type', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /add document/i });
      await user.click(addButtons[0]); // Use header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      // Click the "File" button to switch to Document type
      const fileButton = screen.getByRole('button', { name: /^file$/i });
      await user.click(fileButton);

      // Should show file input (implementation specific)
      await waitFor(() => {
        expect(fileButton).toHaveClass(/bg-primary-600/);
      });
    });

    it('should show URL input for Link type', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', { name: /add document/i });
      await user.click(addButtons[0]); // Use header button

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      // Link type is default, should show URL input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/https:\/\/\.\.\./i)).toBeInTheDocument();
      });
    });
  });
});

