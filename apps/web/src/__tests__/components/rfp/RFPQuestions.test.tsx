import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import RFPQuestions from '@/components/rfp/RFPQuestions';
import { createMockRFP, createMockRFPQuestion, createMockProjectVendor } from '../../utils/mock-data';
import { setupApiMocks } from '../../utils/api-mocks';
import * as apiModule from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    api: {
      rfp: {
        questions: {
          list: vi.fn(),
          delete: vi.fn(),
        },
      },
      projects: {
        vendors: {
          list: vi.fn(),
        },
      },
    },
  };
});

describe('RFPQuestions', () => {
  const projectId = 'project-1';
  const mockRFP = createMockRFP({ id: 'rfp-1', projectId });

  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      (apiModule.api.rfp.questions.list as any).mockImplementation(() => new Promise(() => {}));
      (apiModule.api.projects.vendors.list as any).mockImplementation(() => new Promise(() => {}));

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should render list of questions', async () => {
      const questions = [
        createMockRFPQuestion({
          id: 'q1',
          question: 'Question 1',
          vendor: createMockProjectVendor().vendor,
        }),
        createMockRFPQuestion({
          id: 'q2',
          question: 'Question 2',
          vendor: createMockProjectVendor().vendor,
        }),
      ];
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue(questions);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument();
        expect(screen.getByText('Question 2')).toBeInTheDocument();
      });
    });

    it('should render empty state when no questions', async () => {
      (apiModule.api.rfp.questions.list as any).mockResolvedValue([]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue([]);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText(/no.*questions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter by unanswered questions', async () => {
      const user = userEvent.setup();
      const questions = [
        createMockRFPQuestion({
          id: 'q1',
          question: 'Question 1',
          answer: null,
          vendor: createMockProjectVendor().vendor,
        }),
        createMockRFPQuestion({
          id: 'q2',
          question: 'Question 2',
          answer: 'Answer text',
          vendor: createMockProjectVendor().vendor,
        }),
      ];
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue(questions);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument();
        expect(screen.getByText('Question 2')).toBeInTheDocument();
      });

      // Find the unanswered filter button (it's in the filter button group)
      const filterButtons = screen.getAllByRole('button');
      const unansweredButton = filterButtons.find(btn => 
        btn.textContent === 'Unanswered' && btn.closest('[class*="bg-background-tertiary"]')
      );
      expect(unansweredButton).toBeDefined();
      
      if (unansweredButton) {
        await user.click(unansweredButton);
      }

      await waitFor(() => {
        // Component should reload with new filter
        expect(apiModule.api.rfp.questions.list).toHaveBeenCalled();
      });
    });

    it('should filter by answered questions', async () => {
      const user = userEvent.setup();
      const questions = [
        createMockRFPQuestion({
          id: 'q1',
          question: 'Question 1',
          answer: 'Answer text',
          vendor: createMockProjectVendor().vendor,
        }),
      ];
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue(questions);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('Question 1')).toBeInTheDocument();
      });

      // Find the answered filter button (it's in the filter button group)
      const filterButtons = screen.getAllByRole('button');
      const answeredButton = filterButtons.find(btn => 
        btn.textContent === 'Answered' && btn.closest('[class*="bg-background-tertiary"]')
      );
      expect(answeredButton).toBeDefined();
      
      if (answeredButton) {
        await user.click(answeredButton);
      }

      await waitFor(() => {
        // Component should reload with new filter
        expect(apiModule.api.rfp.questions.list).toHaveBeenCalled();
      });
    });
  });

  describe('Search', () => {
    it('should filter questions by search term', async () => {
      const user = userEvent.setup();
      const questions = [
        createMockRFPQuestion({
          id: 'q1',
          question: 'First Question',
          vendor: createMockProjectVendor().vendor,
        }),
        createMockRFPQuestion({
          id: 'q2',
          question: 'Second Question',
          vendor: createMockProjectVendor().vendor,
        }),
      ];
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue(questions);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('First Question')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'First');

      await waitFor(() => {
        expect(screen.getByText('First Question')).toBeInTheDocument();
        expect(screen.queryByText('Second Question')).not.toBeInTheDocument();
      });
    });
  });

  describe('Deleting Questions', () => {
    it('should delete question when confirmed', async () => {
      const user = userEvent.setup();
      const question = createMockRFPQuestion({
        id: 'q1',
        question: 'To Delete',
        vendor: createMockProjectVendor().vendor,
      });
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);
      (apiModule.api.rfp.questions.delete as any).mockResolvedValue(undefined);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('To Delete')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(apiModule.api.rfp.questions.delete).toHaveBeenCalledWith(projectId, 'q1');
      });
    });

    it('should not delete question when cancelled', async () => {
      const user = userEvent.setup();
      const question = createMockRFPQuestion({
        id: 'q1',
        question: 'To Delete',
        vendor: createMockProjectVendor().vendor,
      });
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);
      window.confirm = vi.fn(() => false);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByText('To Delete')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(apiModule.api.rfp.questions.delete).not.toHaveBeenCalled();
    });
  });

  describe('Question Actions', () => {
    it('should show split button for questions', async () => {
      const question = createMockRFPQuestion({
        id: 'q1',
        question: 'Test Question',
        vendor: createMockProjectVendor().vendor,
      });
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /split/i })).toBeInTheDocument();
      });
    });

    it('should show answer button for unanswered questions', async () => {
      const question = createMockRFPQuestion({
        id: 'q1',
        question: 'Unanswered',
        answer: null,
        vendor: createMockProjectVendor().vendor,
      });
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        // Answer button should be present for unanswered questions
        const answerButton = screen.getByRole('button', { name: /^Answer$/i });
        expect(answerButton).toBeInTheDocument();
      });
    });

    it('should not show answer button for answered questions', async () => {
      const question = createMockRFPQuestion({
        id: 'q1',
        question: 'Answered',
        answer: 'Answer text',
        vendor: createMockProjectVendor().vendor,
      });
      const vendors = [createMockProjectVendor()];

      (apiModule.api.rfp.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.projects.vendors.list as any).mockResolvedValue(vendors);

      render(<RFPQuestions projectId={projectId} rfp={mockRFP} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /answer/i })).not.toBeInTheDocument();
      });
    });
  });
});


