import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import TaskList from '@/components/TaskList';
import { createMockTask, createMockUser } from '../utils/mock-data';
import { setupApiMocks } from '../utils/api-mocks';
import * as apiModule from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    api: {
      projects: {
        phases: {
          createTask: vi.fn(),
          updateTask: vi.fn(),
          deleteTask: vi.fn(),
          tasks: {
            comments: {
              list: vi.fn(),
              create: vi.fn(),
            },
          },
        },
      },
    },
  };
});

// Mock WysiwygEditor
vi.mock('@/components/WysiwygEditor', () => ({
  default: ({ onChange, value }: any) => (
    <textarea
      data-testid="wysiwyg-editor"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

describe('TaskList', () => {
  const projectId = 'project-1';
  const phaseId = 'phase-1';
  const mockOnTaskUpdate = vi.fn();
  const mockProjectMembers = [createMockUser({ id: 'user-1', name: 'User 1' })];

  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
    (apiModule.api.projects.phases.tasks.comments.list as any).mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('should render empty list when no tasks', () => {
      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Component shows "No remaining tasks" when filter is "remaining" (default)
      expect(screen.getByText(/no remaining tasks/i)).toBeInTheDocument();
    });

    it('should render list of tasks', () => {
      const tasks = [
        createMockTask({ id: 'task-1', name: 'Task 1', order: 1 }),
        createMockTask({ id: 'task-2', name: 'Task 2', order: 2 }),
      ];

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={tasks}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('should filter tasks by completion status', async () => {
      const user = userEvent.setup();
      const tasks = [
        createMockTask({ id: 'task-1', name: 'Incomplete', order: 1, actualCompletionDate: null }),
        createMockTask({ id: 'task-2', name: 'Complete', order: 2, actualCompletionDate: new Date().toISOString() }),
      ];

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={tasks}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Wait for tasks to render
      await waitFor(() => {
        expect(screen.getByText('Incomplete')).toBeInTheDocument();
      });

      // Completed tasks are filtered out by default (filter is "remaining")
      expect(screen.queryByText('Complete')).not.toBeInTheDocument();

      // Click completed filter button
      const completedButton = screen.getByRole('button', { name: /completed tasks/i });
      await user.click(completedButton);

      await waitFor(() => {
        // Now completed task should be visible
        expect(screen.getByText('Complete')).toBeInTheDocument();
        // Incomplete task should be hidden when filter is "completed"
        expect(screen.queryByText('Incomplete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Creating Tasks', () => {
    it('should allow creating new task', async () => {
      const user = userEvent.setup();
      const newTask = createMockTask({ id: 'new-task', name: 'New Task' });
      (apiModule.api.projects.phases.createTask as any).mockResolvedValue(newTask);

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Click new task button
      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);

      // Type task name
      const taskInput = screen.getByPlaceholderText(/task name/i);
      await user.type(taskInput, 'New Task');

      // Press Enter to create
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(apiModule.api.projects.phases.createTask).toHaveBeenCalledWith(projectId, phaseId, {
          name: 'New Task',
        });
      });

      expect(mockOnTaskUpdate).toHaveBeenCalled();
    });

    it('should cancel task creation on Escape', async () => {
      const user = userEvent.setup();

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      const newTaskButton = screen.getByRole('button', { name: /new task/i });
      await user.click(newTaskButton);

      const taskInput = screen.getByPlaceholderText(/task name/i);
      await user.type(taskInput, 'Task');
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/task name/i)).not.toBeInTheDocument();
      });

      expect(apiModule.api.projects.phases.createTask).not.toHaveBeenCalled();
    });
  });

  describe('Editing Tasks', () => {
    it('should allow editing task name', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'Original', order: 1 });
      (apiModule.api.projects.phases.updateTask as any).mockResolvedValue({
        ...task,
        name: 'Updated',
      });

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Click on task name span to enter edit mode
      const taskName = screen.getByText('Original');
      await user.click(taskName);

      // Wait for input to appear (component expands description and puts all fields in edit mode)
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Original');
        expect(nameInput).toBeInTheDocument();
      }, { timeout: 2000 });

      // Find input and update
      const nameInput = screen.getByDisplayValue('Original');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated');

      // Wait for input value to be set
      await waitFor(() => {
        expect(nameInput).toHaveValue('Updated');
      });

      // Click outside to trigger blur (component uses 150ms delay in handleFieldBlur)
      // Click on the container or another element
      const container = nameInput.closest('.space-y-4') || nameInput.closest('div');
      if (container) {
        await user.click(container);
      } else {
        await user.tab();
      }

      // Wait for the delayed save to complete (150ms delay + API call)
      await waitFor(() => {
        expect(apiModule.api.projects.phases.updateTask).toHaveBeenCalledWith(projectId, phaseId, 'task-1', {
          name: 'Updated',
        });
      }, { timeout: 5000 });
    });

    it('should allow assigning task owner', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'Task', ownerId: null, order: 1 });
      (apiModule.api.projects.phases.updateTask as any).mockResolvedValue({
        ...task,
        ownerId: 'user-1',
      });

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Find owner button (avatar button) - it's a button that triggers the hidden select
      const ownerButton = screen.getByTitle(/no owner/i);
      await user.click(ownerButton);

      // The component uses a hidden select that gets clicked programmatically
      // We need to find and interact with the select directly
      const ownerSelect = document.getElementById('owner-select-task-1');
      expect(ownerSelect).toBeInTheDocument();
      
      if (ownerSelect) {
        await user.selectOptions(ownerSelect, 'user-1');
      }

      await waitFor(() => {
        expect(apiModule.api.projects.phases.updateTask).toHaveBeenCalledWith(projectId, phaseId, 'task-1', {
          ownerId: 'user-1',
        });
      }, { timeout: 3000 });
    });
  });

  describe('Completing Tasks', () => {
    it('should complete task when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'Task', actualCompletionDate: null, order: 1 });
      (apiModule.api.projects.phases.updateTask as any).mockResolvedValue({
        ...task,
        actualCompletionDate: new Date().toISOString(),
      });

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Find the mark as done button (not a checkbox, but a button with checkmark icon)
      const markAsDoneButton = screen.getByTitle(/mark as done/i);
      await user.click(markAsDoneButton);

      await waitFor(() => {
        expect(apiModule.api.projects.phases.updateTask).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should send actualCompletionDate in ISO date-time format (not date-only)', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'Task', actualCompletionDate: null, order: 1 });
      (apiModule.api.projects.phases.updateTask as any).mockResolvedValue({
        ...task,
        actualCompletionDate: new Date().toISOString(),
      });

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      const markAsDoneButton = screen.getByTitle(/mark as done/i);
      await user.click(markAsDoneButton);

      await waitFor(() => {
        expect(apiModule.api.projects.phases.updateTask).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify the date format is ISO date-time (YYYY-MM-DDTHH:mm:ss.sssZ), not date-only (YYYY-MM-DD)
      const updateCall = (apiModule.api.projects.phases.updateTask as any).mock.calls[0];
      const actualCompletionDate = updateCall[3]?.actualCompletionDate;
      
      expect(actualCompletionDate).toBeDefined();
      // Should be ISO date-time format (contains 'T' and timezone info)
      expect(actualCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(actualCompletionDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/); // Should not be date-only
      // Should be a valid ISO string
      expect(() => new Date(actualCompletionDate).toISOString()).not.toThrow();
      expect(new Date(actualCompletionDate).toISOString()).toBe(actualCompletionDate);
    });
  });

  describe('Deleting Tasks', () => {
    it('should delete task when confirmed', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'To Delete', order: 1 });
      (apiModule.api.projects.phases.deleteTask as any).mockResolvedValue(undefined);
      window.confirm = vi.fn(() => true);

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Click on task name to enter edit mode (delete button only appears in edit mode)
      const taskName = screen.getByText('To Delete');
      await user.click(taskName);

      // Wait for delete button to appear (it appears when description is being edited)
      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(apiModule.api.projects.phases.deleteTask).toHaveBeenCalledWith(projectId, phaseId, 'task-1');
      }, { timeout: 2000 });

      expect(mockOnTaskUpdate).toHaveBeenCalled();
    });
  });

  describe('Comments', () => {
    it('should load and display comments', async () => {
      const user = userEvent.setup();
      const task = createMockTask({ id: 'task-1', name: 'Task', order: 1 });
      const comments = [
        {
          id: 'comment-1',
          content: 'Test comment',
          createdBy: createMockUser(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      (apiModule.api.projects.phases.tasks.comments.list as any).mockResolvedValue(comments);

      render(
        <TaskList
          projectId={projectId}
          phaseId={phaseId}
          tasks={[task]}
          projectMembers={mockProjectMembers}
          onTaskUpdate={mockOnTaskUpdate}
        />
      );

      // Find and click comments button (it's a button with title "Comments")
      const commentsButton = screen.getByTitle(/comments/i);
      await user.click(commentsButton);

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });
    });
  });
});





