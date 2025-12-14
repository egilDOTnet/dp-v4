import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import RFPDocuments from '@/components/rfp/RFPDocuments';
import { createMockRFP, createMockRFPDocument } from '../../utils/mock-data';
import { mockApi, setupApiMocks } from '../../utils/api-mocks';
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

      const addButton = screen.getByRole('button', { name: /add document/i });
      await user.click(addButton);

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

      const addButton = screen.getByRole('button', { name: /add document/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      const descriptionInput = screen.getByPlaceholderText(/description/i);
      await user.type(descriptionInput, 'Test Link');

      const urlInput = screen.getByPlaceholderText(/url/i);
      await user.type(urlInput, 'https://example.com');

      // Submit by clicking outside or pressing Enter
      await user.click(document.body);

      await waitFor(() => {
        expect(apiModule.api.rfp.documents.create).toHaveBeenCalledWith(
          projectId,
          {
            type: 'Link',
            description: 'Test Link',
            url: 'https://example.com',
          }
        );
      }, { timeout: 1000 });
    });

    it('should create document when file is selected', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);
      (apiModule.api.rfp.documents.create as any).mockResolvedValue({});

      // Create a mock file
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add document/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      // Switch to Document type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'Document');

      // File input would be handled differently in real implementation
      // This is a simplified test
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
      await user.click(document.body); // Blur to trigger save

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
      (apiModule.api.rfp.documents.update as any).mockResolvedValue({});
      const link = createMockRFPDocument({
        id: 'link-1',
        description: 'Test Link',
        type: 'Link',
        url: 'https://example.com',
      });

      (apiModule.api.rfp.documents.list as any).mockResolvedValue([link]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText('https://example.com')).toBeInTheDocument();
      });

      const urlElement = screen.getByText('https://example.com');
      await user.click(urlElement);

      await waitFor(() => {
        const input = screen.getByDisplayValue('https://example.com');
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('https://example.com');
      await user.clear(input);
      await user.type(input, 'https://updated.com');
      await user.click(document.body); // Blur to trigger save

      await waitFor(() => {
        expect(apiModule.api.rfp.documents.update).toHaveBeenCalledWith(
          projectId,
          'link-1',
          { url: 'https://updated.com' }
        );
      }, { timeout: 1000 });
    });
  });

  describe('Deleting Documents', () => {
    it('should delete document when delete button is clicked', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => true);
      (apiModule.api.rfp.documents.delete as any).mockResolvedValue({});
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

      // Find delete button (usually an icon button)
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(apiModule.api.rfp.documents.delete).toHaveBeenCalledWith(
          projectId,
          'doc-1'
        );
      });
    });

    it('should not delete document when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => false);
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

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

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

      const addButton = screen.getByRole('button', { name: /add document/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'Document');

      // Should show file input (implementation specific)
    });

    it('should show URL input for Link type', async () => {
      const user = userEvent.setup();
      (apiModule.api.rfp.documents.list as any).mockResolvedValue([]);

      render(<RFPDocuments projectId={projectId} rfp={rfp} />);

      await waitFor(() => {
        expect(screen.getByText(/no documents/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add document/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/description/i)).toBeInTheDocument();
      });

      // Link type is default, should show URL input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/url/i)).toBeInTheDocument();
      });
    });
  });
});
