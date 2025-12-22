import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { EntityForm } from '@/components/ui/EntityForm';

describe('EntityForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render form with children', () => {
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" placeholder="Test input" />
        </EntityForm>
      );

      expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render delete button in edit mode', () => {
      render(
        <EntityForm
          isEdit={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not render delete button in create mode', () => {
      render(
        <EntityForm
          isEdit={false}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should not render delete button when showDelete is false', () => {
      render(
        <EntityForm
          isEdit={true}
          showDelete={false}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should display error message when provided', () => {
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          error="Test error message"
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should display custom button labels', () => {
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          saveLabel="Create"
          cancelLabel="Back"
          deleteLabel="Remove"
          isEdit={true}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });

    it('should show keyboard shortcut hints', () => {
      const { container } = render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" />
        </EntityForm>
      );

      // Text is split across multiple elements, so we check the container text content
      const hintText = container.textContent || '';
      expect(hintText).toContain('Esc');
      expect(hintText).toContain('to cancel');
      expect(hintText).toContain('⌘');
      expect(hintText).toContain('Enter');
      expect(hintText).toContain('to save');
    });
  });

  describe('Auto-focus', () => {
    it('should auto-focus first input when autoFocus is true', async () => {
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel} autoFocus={true}>
          <input type="text" data-testid="first-input" />
          <input type="text" data-testid="second-input" />
        </EntityForm>
      );

      await waitFor(() => {
        const firstInput = screen.getByTestId('first-input');
        expect(firstInput).toHaveFocus();
      });
    });

    it('should not auto-focus when autoFocus is false', async () => {
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel} autoFocus={false}>
          <input type="text" data-testid="first-input" />
        </EntityForm>
      );

      await waitFor(() => {
        const firstInput = screen.getByTestId('first-input');
        expect(firstInput).not.toHaveFocus();
      });
    });

    it('should skip disabled inputs when auto-focusing', async () => {
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel} autoFocus={true}>
          <input type="text" disabled data-testid="disabled-input" />
          <input type="text" data-testid="enabled-input" />
        </EntityForm>
      );

      await waitFor(() => {
        const enabledInput = screen.getByTestId('enabled-input');
        expect(enabledInput).toHaveFocus();
      });
    });
  });

  describe('Button interactions', () => {
    it('should call onSave when save button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" />
        </EntityForm>
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" />
        </EntityForm>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete when delete button is clicked and confirmed', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => true);

      render(
        <EntityForm
          isEdit={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this?');
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should not call onDelete when delete is cancelled', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => false);

      render(
        <EntityForm
          isEdit={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        >
          <input type="text" />
        </EntityForm>
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should disable buttons when isSaving is true', () => {
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        >
          <input type="text" />
        </EntityForm>
      );

      const saveButton = screen.getByRole('button', { name: /saving/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(saveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('should show loading state on save button when isSaving is true', () => {
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        >
          <input type="text" />
        </EntityForm>
      );

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should call onCancel when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onCancel when Escape is pressed during saving', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        >
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onSave when Cmd+Enter is pressed on input', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when Ctrl+Enter is pressed on input', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when Enter alone is pressed on input', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should not call onSave when Cmd+Enter is pressed on textarea', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm onSave={mockOnSave} onCancel={mockOnCancel}>
          <textarea data-testid="test-textarea" />
        </EntityForm>
      );

      const textarea = screen.getByTestId('test-textarea');
      await user.click(textarea);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Textarea should allow Enter for new lines, not trigger save
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should not call onSave when Cmd+Enter is pressed during saving', async () => {
      const user = userEvent.setup();
      render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isSaving={true}
        >
          <input type="text" data-testid="test-input" />
        </EntityForm>
      );

      const input = screen.getByTestId('test-input');
      await user.click(input);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to form container', () => {
      const { container } = render(
        <EntityForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          className="custom-class"
        >
          <input type="text" />
        </EntityForm>
      );

      const formContainer = container.firstChild as HTMLElement;
      expect(formContainer.className).toContain('custom-class');
    });
  });
});



