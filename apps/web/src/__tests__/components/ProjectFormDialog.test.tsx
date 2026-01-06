import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { ProjectFormDialog } from '@/components/ProjectFormDialog';
import { createMockProject } from '../utils/mock-data';

// Mock SlideOver to render content directly
vi.mock('@/components/ui/SlideOver', () => ({
  SlideOver: ({ open, children, title, footer }: any) => {
    if (!open) return null;
    return (
      <div data-testid="slideover" role="dialog">
        <h2>{title}</h2>
        <div>{children}</div>
        {footer && <div data-testid="slideover-footer">{footer}</div>}
      </div>
    );
  },
}));

// Mock ConfirmDialog
vi.mock('@/components/ui/Dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onClose, title, message, confirmText, cancelText, loading }: any) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog" role="dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm} disabled={loading}>
          {confirmText}
        </button>
        <button onClick={onClose}>{cancelText}</button>
      </div>
    );
  },
}));

describe('ProjectFormDialog', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <ProjectFormDialog
          open={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByText(/create project/i)).not.toBeInTheDocument();
    });

    it('should render create form when open', () => {
      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // The title "Create Project" appears in the SlideOver title (h2) and button text
      // Use getAllByText to handle multiple instances
      const createProjectTexts = screen.getAllByText(/create project/i);
      expect(createProjectTexts.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    });

    it('should render edit form with existing project data', () => {
      const existingProject = createMockProject({
        name: 'Test Project',
        type: 'Construction',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T00:00:00Z',
      });

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/edit project/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Construction')).toBeInTheDocument();
    });

    it('should show delete button when editing', () => {
      const existingProject = createMockProject();

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when project name is empty', async () => {
      const user = userEvent.setup();
      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Clear the default name value
      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByRole('button', { name: /create project/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call onSave with form data when valid', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValue(undefined);

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Project');

      // Wait for input value to be set
      await waitFor(() => {
        expect(nameInput).toHaveValue('New Project');
      });

      const typeInput = screen.getByLabelText(/type/i);
      // Use paste for longer strings to avoid truncation issues
      await user.clear(typeInput);
      await user.paste('Construction');

      // Wait for input value to be set
      await waitFor(() => {
        expect(typeInput).toHaveValue('Construction');
      }, { timeout: 2000 });

      await user.click(screen.getByRole('button', { name: /create project/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'New Project',
          type: 'Construction',
          startDate: expect.any(String),
          endDate: undefined,
        });
      });
    });

    it('should trim whitespace from name and type', async () => {
      const user = userEvent.setup({ delay: null }); // Disable delay for faster typing
      mockOnSave.mockResolvedValue(undefined);

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, '  New Project  ', { delay: 0 });

      // Wait for input value to be set
      await waitFor(() => {
        expect(nameInput).toHaveValue('  New Project  ');
      });

      const typeInput = screen.getByLabelText(/type/i);
      // Use paste for longer strings to avoid truncation issues
      await user.clear(typeInput);
      await user.paste('  Construction  ');

      // Wait for input value to be set - type input might be slower
      await waitFor(() => {
        expect(typeInput).toHaveValue('  Construction  ');
      }, { timeout: 2000 });

      await user.click(screen.getByRole('button', { name: /create project/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Project',
            type: 'Construction',
          })
        );
      });
    });

    it('should send undefined for empty optional fields', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValue(undefined);

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Project');

      await user.click(screen.getByRole('button', { name: /create project/i }));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'New Project',
          type: undefined,
          startDate: expect.any(String),
          endDate: undefined,
        });
      });
    });

    it('should close dialog after successful save', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValue(undefined);

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Project');

      await user.click(screen.getByRole('button', { name: /create project/i }));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle save errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to save project';
      mockOnSave.mockRejectedValue(new Error(errorMessage));

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Project');

      await user.click(screen.getByRole('button', { name: /create project/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should disable buttons while submitting', async () => {
      const user = userEvent.setup();
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      mockOnSave.mockReturnValue(savePromise);

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText(/project name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Project');

      const saveButton = screen.getByRole('button', { name: /create project/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      resolveSave!();
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Date Handling', () => {
    it('should set minimum end date to start date', async () => {
      const user = userEvent.setup();
      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const startDateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
      const endDateInput = screen.getByLabelText(/end date/i) as HTMLInputElement;

      await user.clear(startDateInput);
      await user.type(startDateInput, '2024-06-01');

      await waitFor(() => {
        expect(endDateInput.min).toBe('2024-06-01');
      }, { timeout: 2000 });
    });
  });

  describe('Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete', () => {
    it('should show delete confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const existingProject = createMockProject({
        name: 'Test Project',
      });

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete project/i }));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });
      
      // The dialog should contain delete project text
      const deleteProjectTexts = screen.getAllByText(/delete project/i);
      expect(deleteProjectTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/test project/i)).toBeInTheDocument();
    });

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const existingProject = createMockProject();

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete project/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      // Find the confirm button in the dialog - it's the button with "Delete Project" text
      const confirmButtons = screen.getAllByRole('button', { name: /delete project/i });
      // The confirm button is the one inside the dialog (not the trigger button)
      const confirmButton = confirmButtons.find(btn => {
        const dialog = btn.closest('[data-testid="confirm-dialog"]');
        return dialog && !btn.disabled;
      });
      expect(confirmButton).toBeTruthy();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
      });
    });

    it('should close dialog after successful delete', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const existingProject = createMockProject();

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete project/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      // Find the confirm button in the dialog
      const confirmButtons = screen.getAllByRole('button', { name: /delete project/i });
      const confirmButton = confirmButtons.find(btn => {
        const dialog = btn.closest('[data-testid="confirm-dialog"]');
        return dialog && !btn.disabled;
      });
      expect(confirmButton).toBeTruthy();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle delete errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to delete project';
      mockOnDelete.mockRejectedValue(new Error(errorMessage));
      const existingProject = createMockProject();

      render(
        <ProjectFormDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingProject={existingProject}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete project/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      // Find the confirm button in the dialog
      const confirmButtons = screen.getAllByRole('button', { name: /delete project/i });
      const confirmButton = confirmButtons.find(btn => {
        const dialog = btn.closest('[data-testid="confirm-dialog"]');
        return dialog && !btn.disabled;
      });
      expect(confirmButton).toBeTruthy();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});





