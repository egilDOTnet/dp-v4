import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import QuestionOptionManager from '@/components/QuestionOptionManager';
import { createMockRFIQuestion, createMockRFIQuestionOption } from '../utils/mock-data';
import { setupApiMocks } from '../utils/api-mocks';
import * as apiModule from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    api: {
      rfi: {
        questions: {
          list: vi.fn(),
          options: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            reorder: vi.fn(),
          },
        },
      },
    },
  };
});

describe('QuestionOptionManager', () => {
  const projectId = 'project-1';
  const questionId = 'question-1';

  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  describe('Rendering', () => {
    it('should return null for non-MultipleChoice and non-Dropdown question types', () => {
      const { container } = render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="SingleText"
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render for MultipleChoice question type', async () => {
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rows')).toBeInTheDocument();
        expect(screen.getByText('Columns')).toBeInTheDocument();
      });
    });

    it('should render for Dropdown question type', async () => {
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'Dropdown',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="Dropdown"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Options')).toBeInTheDocument();
      });
    });

    it('should display existing options', async () => {
      const options = [
        createMockRFIQuestionOption({ id: 'opt-1', label: 'Option 1', yAxis: true, xAxis: false }),
        createMockRFIQuestionOption({ id: 'opt-2', label: 'Option 2', yAxis: true, xAxis: false }),
      ];
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options,
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
      });
    });

    it('should display error message when error occurs', async () => {
      (apiModule.api.rfi.questions.list as any).mockRejectedValue(new Error('Failed to load'));

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe('Adding Options', () => {
    it('should show add row input when Add row is clicked', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.create as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add row')).toBeInTheDocument();
      });

      const addRowButton = screen.getByText('Add row');
      await user.click(addRowButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Row label')).toBeInTheDocument();
      });
    });

    it('should create row option when label is entered', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.create as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add row')).toBeInTheDocument();
      });

      const addRowButton = screen.getByText('Add row');
      await user.click(addRowButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Row label')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Row label');
      await user.type(input, 'New Row');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(apiModule.api.rfi.questions.options.create).toHaveBeenCalledWith(
          projectId,
          questionId,
          {
            label: 'New Row',
            value: null,
            xAxis: false,
            yAxis: true,
          }
        );
      });
    });

    it('should show error when adding row with empty label', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add row')).toBeInTheDocument();
      });

      const addRowButton = screen.getByText('Add row');
      await user.click(addRowButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Row label')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Row label is required')).toBeInTheDocument();
      });
    });

    it('should show add column input when Add column is clicked', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.create as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add column')).toBeInTheDocument();
      });

      const addColumnButton = screen.getByText('Add column');
      await user.click(addColumnButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Column label')).toBeInTheDocument();
      });
    });

    it('should create column option when label is entered', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.create as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add column')).toBeInTheDocument();
      });

      const addColumnButton = screen.getByText('Add column');
      await user.click(addColumnButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Column label')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Column label');
      await user.type(input, 'New Column');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(apiModule.api.rfi.questions.options.create).toHaveBeenCalledWith(
          projectId,
          questionId,
          {
            label: 'New Column',
            value: null,
            xAxis: true,
            yAxis: false,
          }
        );
      });
    });
  });

  describe('Editing Options', () => {
    it('should show edit input when option label is clicked', async () => {
      const user = userEvent.setup();
      const option = createMockRFIQuestionOption({
        id: 'opt-1',
        label: 'Option 1',
        yAxis: true,
        xAxis: false,
      });
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [option],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.update as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      const optionLabel = screen.getByText('Option 1');
      await user.click(optionLabel);

      await waitFor(() => {
        const input = screen.getByDisplayValue('Option 1');
        expect(input).toBeInTheDocument();
      });
    });

    it('should update option when label is changed and Enter is pressed', async () => {
      const user = userEvent.setup();
      const option = createMockRFIQuestionOption({
        id: 'opt-1',
        label: 'Option 1',
        yAxis: true,
        xAxis: false,
      });
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [option],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.update as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      const optionLabel = screen.getByText('Option 1');
      await user.click(optionLabel);

      await waitFor(() => {
        const input = screen.getByDisplayValue('Option 1');
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('Option 1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Updated Option' } });
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(apiModule.api.rfi.questions.options.update).toHaveBeenCalledWith(
          projectId,
          questionId,
          'opt-1',
          { label: 'Updated Option' }
        );
      });
    });

    it('should cancel editing when Escape is pressed', async () => {
      const user = userEvent.setup();
      const option = createMockRFIQuestionOption({
        id: 'opt-1',
        label: 'Option 1',
        yAxis: true,
        xAxis: false,
      });
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [option],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      const optionLabel = screen.getByText('Option 1');
      await user.click(optionLabel);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByDisplayValue('Option 1')).not.toBeInTheDocument();
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });
    });
  });

  describe('Deleting Options', () => {
    it('should delete option when delete button is clicked', async () => {
      const user = userEvent.setup();
      const option = createMockRFIQuestionOption({
        id: 'opt-1',
        label: 'Option 1',
        yAxis: true,
        xAxis: false,
      });
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'MultipleChoice',
        options: [option],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.delete as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="MultipleChoice"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument();
      });

      // Find delete button (X icon)
      const deleteButton = screen.getByTitle('Delete row');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(apiModule.api.rfi.questions.options.delete).toHaveBeenCalledWith(
          projectId,
          questionId,
          'opt-1'
        );
      });
    });
  });

  describe('Dropdown Question Type', () => {
    it('should show Options section instead of Rows/Columns for Dropdown', async () => {
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'Dropdown',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="Dropdown"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Options')).toBeInTheDocument();
        expect(screen.queryByText('Rows')).not.toBeInTheDocument();
        expect(screen.queryByText('Columns')).not.toBeInTheDocument();
      });
    });

    it('should add option for Dropdown type', async () => {
      const user = userEvent.setup();
      const question = createMockRFIQuestion({
        id: questionId,
        type: 'Dropdown',
        options: [],
      });

      (apiModule.api.rfi.questions.list as any).mockResolvedValue([question]);
      (apiModule.api.rfi.questions.options.create as any).mockResolvedValue({});

      render(
        <QuestionOptionManager
          projectId={projectId}
          questionId={questionId}
          questionType="Dropdown"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Add option')).toBeInTheDocument();
      });

      const addOptionButton = screen.getByText('Add option');
      await user.click(addOptionButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Option label')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Option label');
      await user.type(input, 'New Option');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(apiModule.api.rfi.questions.options.create).toHaveBeenCalledWith(
          projectId,
          questionId,
          {
            label: 'New Option',
            value: null,
            xAxis: false,
            yAxis: false,
          }
        );
      });
    });
  });
});

