import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import QuestionForm from '@/components/QuestionForm';
import { createMockRFIQuestion } from '../utils/mock-data';

// Mock child components
vi.mock('@/components/QuestionOptionManager', () => ({
  default: ({ questionId, questionType, projectId }: any) => (
    <div data-testid="question-option-manager">
      Options for {questionId} ({questionType}) in project {projectId}
    </div>
  ),
}));

vi.mock('@/components/ScaleConfigurator', () => ({
  default: ({ scaleLabels, onChange }: any) => (
    <div data-testid="scale-configurator">
      <button
        type="button"
        onClick={() => onChange({ ...scaleLabels, '1': 'Low', '2': 'High' })}
      >
        Update Scale
      </button>
    </div>
  ),
}));

describe('QuestionForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form fields for new question', () => {
      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/required/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render form with existing question data', async () => {
      const existingQuestion = createMockRFIQuestion({
        title: 'Test Question',
        description: 'Test Description',
        type: 'YesNo',
        required: false,
      });

      render(
        <QuestionForm
          projectId="project-1"
          question={existingQuestion}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Question')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
      // The select shows "Yes/No" as text but has value "YesNo"
      const typeSelect = screen.getByLabelText(/type/i) as HTMLSelectElement;
      expect(typeSelect.value).toBe('YesNo');
      expect(screen.getByLabelText(/required/i)).not.toBeChecked();
      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    });

    it('should show delete button when editing existing question', () => {
      const existingQuestion = createMockRFIQuestion();

      render(
        <QuestionForm
          projectId="project-1"
          question={existingQuestion}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe('Question Type Selection', () => {
    it('should show option manager for Dropdown type', async () => {
      const existingQuestion = createMockRFIQuestion({
        type: 'Dropdown',
      });

      render(
        <QuestionForm
          projectId="project-1"
          question={existingQuestion}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('question-option-manager')).toBeInTheDocument();
    });

    it('should show option manager for MultipleChoice type', async () => {
      const existingQuestion = createMockRFIQuestion({
        type: 'MultipleChoice',
      });

      render(
        <QuestionForm
          projectId="project-1"
          question={existingQuestion}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('question-option-manager')).toBeInTheDocument();
    });

    it('should show scale configurator for Scale type', async () => {
      const user = userEvent.setup();
      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'Scale');

      expect(screen.getByTestId('scale-configurator')).toBeInTheDocument();
    });

  });

  describe('Form Validation', () => {
    it('should show error when title is empty', async () => {
      const user = userEvent.setup();
      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      titleInput.removeAttribute('required'); // Bypass HTML5 validation
      
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Test Question');
      await user.type(screen.getByLabelText(/description/i), 'Test Description');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Test Question',
          description: 'Test Description',
          type: 'SingleText',
          required: true,
          scaleLabels: null,
        });
      });
    });

    it('should trim whitespace from title and description', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), '  Test Question  ');
      await user.type(screen.getByLabelText(/description/i), '  Test Description  ');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Question',
            description: 'Test Description',
          })
        );
      });
    });

    it('should send null for empty description', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Test Question');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: null,
          })
        );
      });
    });

    it('should include scaleLabels for Scale type', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Scale Question');
      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'Scale');

      // Update scale labels via the configurator
      const updateButton = screen.getByRole('button', { name: /update scale/i });
      await user.click(updateButton);

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Scale',
            scaleLabels: expect.objectContaining({
              '1': 'Low',
              '2': 'High',
            }),
          })
        );
      });
    });

    it('should send null for scaleLabels for non-Scale types', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Text Question');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SingleText',
            scaleLabels: null,
          })
        );
      });
    });

    it('should handle submit errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to save question';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Test Question');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      mockOnSubmit.mockReturnValue(submitPromise);

      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Test Question');
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });

      // Resolve the promise and wait for it to complete
      resolveSubmit!();
      await submitPromise;
      
      // Wait for React to update state
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
      
      // Note: The component resets submitting=false only on error (line 61).
      // On success, it expects the parent to handle closing/resetting.
      // For this test, we verify the button was disabled during submission.
    });
  });

  describe('Required Checkbox', () => {
    it('should allow toggling required field', async () => {
      const user = userEvent.setup();
      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const checkbox = screen.getByLabelText(/required/i);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.type(screen.getByLabelText(/title/i), 'Test Question');
      mockOnSubmit.mockResolvedValue(undefined);
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ required: false })
        );
      });
    });
  });

  describe('Cancel', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <QuestionForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete', () => {
    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const existingQuestion = createMockRFIQuestion();

      render(
        <QuestionForm
          projectId="project-1"
          question={existingQuestion}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });
  });
});

