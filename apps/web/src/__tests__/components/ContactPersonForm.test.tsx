import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import ContactPersonForm from '@/components/ContactPersonForm';
import { createMockVendorContact } from '../utils/mock-data';

describe('ContactPersonForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form fields for new contact', () => {
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByText(/this will be set as the main contact automatically/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render form with existing contact data', () => {
      const existingContact = createMockVendorContact({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        isMainContact: true,
      });

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    });

    it('should show main contact checkbox when not first contact', () => {
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/set as main contact/i)).toBeInTheDocument();
    });

    it('should show delete button when editing existing contact', () => {
      const existingContact = createMockVendorContact();

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when first name is empty', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      // Fill other required fields to bypass HTML5 validation
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      
      // Clear first name to trigger validation
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      // Remove required attribute to allow form submission
      firstNameInput.removeAttribute('required');

      const submitButton = screen.getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when last name is empty', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      
      // Clear last name to trigger validation
      const lastNameInput = screen.getByLabelText(/last name/i);
      await user.clear(lastNameInput);
      lastNameInput.removeAttribute('required');

      const submitButton = screen.getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when email is empty', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      
      // Clear email to trigger validation
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      emailInput.removeAttribute('required');

      const submitButton = screen.getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for invalid email format', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      emailInput.removeAttribute('type'); // Remove email type to bypass HTML5 validation
      
      const submitButton = screen.getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isMainContact: true,
        });
      });
    });

    it('should trim whitespace from inputs', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), '  John  ');
      await user.type(screen.getByLabelText(/last name/i), '  Doe  ');
      await user.type(screen.getByLabelText(/email/i), '  JOHN@EXAMPLE.COM  ');
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isMainContact: true,
        });
      });
    });

    it('should handle submit errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to save contact';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.click(screen.getByRole('button', { name: /add/i }));

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
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      const submitButton = screen.getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });

      // Resolve the promise and wait for it to complete
      resolveSubmit!();
      await submitPromise;
      
      // Wait for React to update state - the component doesn't reset submitting on success
      // because it expects the parent to handle closing/resetting, but we can verify
      // the button was disabled during submission
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
      
      // Note: The component doesn't reset submitting=false on success because
      // it expects the parent to close/reset the form. For this test, we verify
      // the button was disabled during submission, which is the key behavior.
      // The button may remain disabled if the form isn't reset by the parent.
    });
  });

  describe('Main Contact Checkbox', () => {
    it('should allow toggling main contact when not first contact', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const checkbox = screen.getByLabelText(/set as main contact/i);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.type(screen.getByLabelText(/first name/i), 'John');
      await user.type(screen.getByLabelText(/last name/i), 'Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      mockOnSubmit.mockResolvedValue(undefined);
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ isMainContact: true })
        );
      });
    });
  });

  describe('Cancel', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          isFirstContact={true}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete', () => {
    it('should show delete confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const existingContact = createMockVendorContact({
        firstName: 'John',
        lastName: 'Doe',
      });

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(screen.getByText(/delete contact/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
    });

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const existingContact = createMockVendorContact();

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      
      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText(/delete contact/i)).toBeInTheDocument();
      });

      // Find the delete button in the dialog (inside the fixed overlay div, not the form)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // The confirm button is the one inside the dialog overlay (has fixed positioning ancestor)
      const confirmButton = deleteButtons.find(btn => {
        const overlay = btn.closest('.fixed.inset-0');
        return overlay && !btn.disabled && btn.textContent?.trim() === 'Delete';
      });
      expect(confirmButton).toBeTruthy();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
      });
    });

    it('should cancel delete when cancel is clicked in dialog', async () => {
      const user = userEvent.setup();
      const existingContact = createMockVendorContact();

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      
      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText(/delete contact/i)).toBeInTheDocument();
      });

      // Find the cancel button in the dialog (inside the fixed overlay div, not the form)
      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
      const cancelButton = cancelButtons.find(btn => {
        const overlay = btn.closest('.fixed.inset-0');
        return overlay && !btn.disabled;
      });
      expect(cancelButton).toBeTruthy();
      if (cancelButton) {
        await user.click(cancelButton);
      }

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText(/delete contact/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to delete contact';
      mockOnDelete.mockRejectedValue(new Error(errorMessage));
      const existingContact = createMockVendorContact();

      render(
        <ContactPersonForm
          vendorId="vendor-1"
          vendorName="Test Vendor"
          existingContact={existingContact}
          isFirstContact={false}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));
      
      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText(/delete contact/i)).toBeInTheDocument();
      });

      // Find the delete button in the dialog (inside the fixed overlay div, not the form)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      // The confirm button is the one inside the dialog overlay (has fixed positioning ancestor)
      const confirmButton = deleteButtons.find(btn => {
        const overlay = btn.closest('.fixed.inset-0');
        return overlay && !btn.disabled && btn.textContent?.trim() === 'Delete';
      });
      expect(confirmButton).toBeTruthy();
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });
});



