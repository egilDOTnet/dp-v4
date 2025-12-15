import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import VendorList from '@/components/VendorList';
import { createMockProjectVendor, createMockVendorContact } from '../utils/mock-data';
import type { VendorStatus } from '@/lib/api';

// Mock ContactPersonForm and VendorForm
vi.mock('@/components/ContactPersonForm', () => ({
  default: ({ onSubmit, onCancel, onDelete }: any) => (
    <div data-testid="contact-person-form">
      <input data-testid="contact-first-name" placeholder="First name" />
      <input data-testid="contact-last-name" placeholder="Last name" />
      <input data-testid="contact-email" placeholder="Email" />
      <button data-testid="contact-submit" onClick={() => onSubmit({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' })}>
        Submit
      </button>
      <button data-testid="contact-cancel" onClick={onCancel}>Cancel</button>
      {onDelete && (
        <button data-testid="contact-delete" onClick={onDelete}>Delete</button>
      )}
    </div>
  ),
}));

vi.mock('@/components/VendorForm', () => ({
  default: ({ onSubmit, onCancel, onDelete, existingVendor }: any) => (
    <div data-testid="vendor-form">
      <input data-testid="vendor-name" placeholder="Vendor name" defaultValue={existingVendor?.name || ''} />
      <button data-testid="vendor-submit" onClick={() => onSubmit({ name: 'New Vendor', organizationNumber: '123456789' })}>
        Submit
      </button>
      <button data-testid="vendor-cancel" onClick={onCancel}>Cancel</button>
      {onDelete && (
        <button data-testid="vendor-delete" onClick={onDelete}>Delete</button>
      )}
    </div>
  ),
}));

describe('VendorList', () => {
  const projectId = 'project-1';
  const mockOnStatusChange = vi.fn();
  const mockOnAddVendor = vi.fn();
  const mockOnUpdateVendor = vi.fn();
  const mockOnDeleteVendor = vi.fn();
  const mockOnAddContact = vi.fn();
  const mockOnEditContact = vi.fn();
  const mockOnDeleteContact = vi.fn();
  const mockOnAddVendorFormChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render empty state when no vendors', () => {
      render(
        <VendorList
          projectId={projectId}
          vendors={[]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      expect(screen.getByText('No vendors added yet')).toBeInTheDocument();
    });

    it('should render vendors table', () => {
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          organizationNumber: '123456789',
          emailDomain: 'test.com',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      expect(screen.getByText('Test Vendor')).toBeInTheDocument();
      expect(screen.getByText('123456789')).toBeInTheDocument();
      expect(screen.getByText('test.com')).toBeInTheDocument();
    });

    it('should display main contact when available', () => {
      const mainContact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        isMainContact: true,
      });
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [mainContact],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      expect(screen.getByText('Main: John Doe')).toBeInTheDocument();
    });

    it('should display contact count badge', () => {
      const contacts = [
        createMockVendorContact({ id: 'contact-1' }),
        createMockVendorContact({ id: 'contact-2' }),
      ];
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts,
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Vendor Expansion', () => {
    it('should expand vendor row when clicked', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }

      await waitFor(() => {
        expect(screen.getByText('Contact Persons')).toBeInTheDocument();
      });
    });

    it('should collapse vendor row when clicked again', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }
      await waitFor(() => {
        expect(screen.getByText('Contact Persons')).toBeInTheDocument();
      });

      await user.click(expandButton);
      await waitFor(() => {
        expect(screen.queryByText('Contact Persons')).not.toBeInTheDocument();
      });
    });
  });

  describe('Status Changes', () => {
    it('should call onStatusChange when status is changed', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
        },
        status: 'Pending' as VendorStatus,
      });

      mockOnStatusChange.mockResolvedValue(undefined);

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      const statusSelect = screen.getByRole('combobox');
      await user.selectOptions(statusSelect, 'RFI_Received');

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith('vendor-1', 'RFI_Received');
      });
    });
  });

  describe('Adding Vendors', () => {
    it('should show add vendor form when showAddVendorForm is true', async () => {
      render(
        <VendorList
          projectId={projectId}
          vendors={[]}
          showAddVendorForm={true}
          onAddVendorFormChange={mockOnAddVendorFormChange}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });
    });

    it('should call onAddVendor when vendor form is submitted', async () => {
      const user = userEvent.setup();
      mockOnAddVendor.mockResolvedValue(undefined);

      render(
        <VendorList
          projectId={projectId}
          vendors={[]}
          showAddVendorForm={true}
          onAddVendorFormChange={mockOnAddVendorFormChange}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('vendor-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnAddVendor).toHaveBeenCalledWith({
          name: 'New Vendor',
          organizationNumber: '123456789',
        });
      });
    });

    it('should call onAddVendorFormChange when vendor form is cancelled', async () => {
      const user = userEvent.setup();

      render(
        <VendorList
          projectId={projectId}
          vendors={[]}
          showAddVendorForm={true}
          onAddVendorFormChange={mockOnAddVendorFormChange}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('vendor-cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockOnAddVendorFormChange).toHaveBeenCalledWith(false);
      }, { timeout: 500 });
    });
  });

  describe('Editing Vendors', () => {
    it('should show edit form when Edit button is clicked', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });
    });

    it('should call onUpdateVendor when edit form is submitted', async () => {
      const user = userEvent.setup();
      mockOnUpdateVendor.mockResolvedValue(undefined);
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('vendor-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnUpdateVendor).toHaveBeenCalledWith('vendor-1', {
          name: 'New Vendor',
          organizationNumber: '123456789',
        });
      });
    });

    it('should call onDeleteVendor when delete button is clicked', async () => {
      const user = userEvent.setup();
      mockOnDeleteVendor.mockResolvedValue(undefined);
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('vendor-form')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('vendor-delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteVendor).toHaveBeenCalledWith('vendor-1');
      });
    });
  });

  describe('Contact Management', () => {
    it('should show add contact form when Add Contact is clicked', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Expand vendor first
      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }

      await waitFor(() => {
        expect(screen.getByText('Contact Persons')).toBeInTheDocument();
      });

      const addContactButton = screen.getByRole('button', { name: /add contact/i });
      await user.click(addContactButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });
    });

    it('should call onAddContact when contact form is submitted', async () => {
      const user = userEvent.setup();
      mockOnAddContact.mockResolvedValue(undefined);
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Expand vendor
      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }

      await waitFor(() => {
        expect(screen.getByText('Contact Persons')).toBeInTheDocument();
      });

      // Add contact
      const addContactButton = screen.getByRole('button', { name: /add contact/i });
      await user.click(addContactButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const submitButton = screen.getByTestId('contact-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnAddContact).toHaveBeenCalledWith('vendor-1', {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        });
      }, { timeout: 500 });
    });

    it('should display existing contacts', async () => {
      const contacts = [
        createMockVendorContact({
          id: 'contact-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          isMainContact: true,
        }),
        createMockVendorContact({
          id: 'contact-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          isMainContact: false,
        }),
      ];
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts,
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Expand to see contacts - find button in the vendor row
      const user = userEvent.setup();
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      }

      await waitFor(() => {
        // Find contacts by email first, then verify names are in the same container
        const johnEmail = screen.getByText('john@example.com');
        const johnContainer = johnEmail.closest('div[class*="bg-background"]');
        expect(johnContainer?.textContent).toMatch(/John\s+Doe/);
        
        const janeEmail = screen.getByText('jane@example.com');
        const janeContainer = janeEmail.closest('div[class*="bg-background"]');
        expect(janeContainer?.textContent).toMatch(/Jane\s+Smith/);
      });
    });

    it('should show empty state when no contacts', async () => {
      const user = userEvent.setup();
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }

      await waitFor(() => {
        expect(screen.getByText('No contacts added yet')).toBeInTheDocument();
      });
    });

    it('should call onDeleteContact when delete is confirmed', async () => {
      const user = userEvent.setup();
      mockOnDeleteContact.mockResolvedValue(undefined);
      window.confirm = vi.fn(() => true);
      const contact = createMockVendorContact({
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
      });
      const vendor = createMockProjectVendor({
        vendor: {
          id: 'vendor-1',
          name: 'Test Vendor',
          contacts: [contact],
        },
        status: 'Pending' as VendorStatus,
      });

      render(
        <VendorList
          projectId={projectId}
          vendors={[vendor]}
          onStatusChange={mockOnStatusChange}
          onAddVendor={mockOnAddVendor}
          onUpdateVendor={mockOnUpdateVendor}
          onDeleteVendor={mockOnDeleteVendor}
          onAddContact={mockOnAddContact}
          onEditContact={mockOnEditContact}
          onDeleteContact={mockOnDeleteContact}
        />
      );

      // Expand vendor
      // Find expand button by finding the button that contains the chevron icon
      const vendorRow = screen.getByText('Test Vendor').closest('tr');
      const expandButton = vendorRow?.querySelector('button');
      if (expandButton) {
        await user.click(expandButton);
      } else {
        throw new Error('Expand button not found');
      }

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click edit to show delete button
      // There are multiple Edit buttons (vendor and contact), so get all and find the contact one
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      // The contact Edit button should be the one near the contact name
      const contactEditButton = editButtons.find(btn => 
        btn.closest('div')?.textContent?.includes('John Doe')
      ) || editButtons[1]; // Fallback to second button if contact is expanded
      await user.click(contactEditButton);

      await waitFor(() => {
        expect(screen.getByTestId('contact-person-form')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('contact-delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteContact).toHaveBeenCalledWith('vendor-1', 'contact-1');
      });
    });
  });
});

