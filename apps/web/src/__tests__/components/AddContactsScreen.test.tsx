import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import AddContactsScreen from '@/components/AddContactsScreen';
import { createMockVendorContact } from '../utils/mock-data';

// Mock ContactPersonForm
vi.mock('@/components/ContactPersonForm', () => ({
  default: ({ onSubmit, onCancel, onDelete, existingContact, isFirstContact }: any) => (
    <div data-testid="contact-person-form">
      <input 
        data-testid="contact-first-name" 
        placeholder="First name" 
        defaultValue={existingContact?.firstName || ''}
      />
      <input 
        data-testid="contact-last-name" 
        placeholder="Last name" 
        defaultValue={existingContact?.lastName || ''}
      />
      <input 
        data-testid="contact-email" 
        placeholder="Email" 
        defaultValue={existingContact?.email || ''}
      />
      <button 
        data-testid="contact-submit" 
        onClick={() => onSubmit({ 
          firstName: existingContact?.firstName || 'John', 
          lastName: existingContact?.lastName || 'Doe', 
          email: existingContact?.email || 'john@example.com',
          isMainContact: isFirstContact || false
        })}
      >
        Submit
      </button>
      <button data-testid="contact-cancel" onClick={onCancel}>Cancel</button>
      {onDelete && (
        <button data-testid="contact-delete" onClick={onDelete}>Delete</button>
      )}
    </div>
  ),
}));

describe('AddContactsScreen', () => {
  const vendorId = 'vendor-1';
  const vendorName = 'Test Vendor';
  const mockOnAddContact = vi.fn();
  const mockOnUpdateContact = vi.fn();
  const mockOnDeleteContact = vi.fn();
  const mockOnComplete = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render with empty contact form when no existing contacts', () => {
      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText(vendorName)).toBeInTheDocument();
      expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
    });

    it('should render existing contacts', () => {
      const contacts = [
        createMockVendorContact({
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        }),
        createMockVendorContact({
          id: 'contact-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        }),
      ];

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={contacts}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should show main contact badge', () => {
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        isMainContact: true,
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Main Contact')).toBeInTheDocument();
    });
  });

  describe('Adding Contacts', () => {
    it('should call onAddContact when form is submitted', async () => {
      const user = userEvent.setup();
      mockOnAddContact.mockResolvedValue(undefined);

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const submitButton = screen.getByTestId('contact-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnAddContact).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isMainContact: true,
        });
      });
    });

    it('should add new contact form after adding contact', async () => {
      const user = userEvent.setup();
      mockOnAddContact.mockResolvedValue(undefined);

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const submitButton = screen.getByTestId('contact-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnAddContact).toHaveBeenCalled();
      });

      // Should still show form for adding more contacts
      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });
    });
  });

  describe('Editing Contacts', () => {
    it('should show edit form when Edit button is clicked', async () => {
      const user = userEvent.setup();
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      });
    });

    it('should call onUpdateContact when edit form is submitted', async () => {
      const user = userEvent.setup();
      mockOnUpdateContact.mockResolvedValue(undefined);
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('contact-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnUpdateContact).toHaveBeenCalledWith('contact-1', {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isMainContact: false,
        });
      });
    });

    it('should cancel editing when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('contact-cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('contact-person-form')).not.toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Deleting Contacts', () => {
    it('should call onDeleteContact when delete is confirmed', async () => {
      const user = userEvent.setup();
      mockOnDeleteContact.mockResolvedValue(undefined);
      window.confirm = vi.fn(() => true);
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('contact-delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteContact).toHaveBeenCalledWith('contact-1');
      });
    });

    it('should not delete contact when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => false);
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('contact-delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteContact).not.toHaveBeenCalled();
      });
    });

    it('should ensure at least one contact remains after deletion', async () => {
      const user = userEvent.setup();
      mockOnDeleteContact.mockResolvedValue(undefined);
      window.confirm = vi.fn(() => true);
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('contact-delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteContact).toHaveBeenCalled();
      });

      // Should still show a form (ensuring at least one contact)
      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });
    });
  });

  describe('Completion', () => {
    it('should call onComplete when Continue button is clicked and all contacts are saved', async () => {
      const user = userEvent.setup();
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[contact]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should disable Continue button when contacts are not saved', () => {
      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });

    it('should call onSkip when Skip button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AddContactsScreen
          vendorId={vendorId}
          vendorName={vendorName}
          existingContacts={[]}
          onAddContact={mockOnAddContact}
          onUpdateContact={mockOnUpdateContact}
          onDeleteContact={mockOnDeleteContact}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />
      );

      const skipButton = screen.getByRole('button', { name: /skip/i });
      await user.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });
});
