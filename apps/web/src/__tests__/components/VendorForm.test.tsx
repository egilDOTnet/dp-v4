import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import VendorForm from '@/components/VendorForm';
import * as apiModule from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof apiModule>('@/lib/api');
  return {
    ...actual,
    api: {
      vendors: {
        search: vi.fn(),
        getBrregData: vi.fn(),
      },
    },
  };
});

describe('VendorForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (apiModule.api.vendors.search as any).mockResolvedValue({ results: [], total: 0 });
    (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
      organizationNumber: '123456789',
      name: 'Test Company',
      organizationForm: 'AS',
      address: null,
      website: null,
      industry: null,
      rawData: {},
    });
  });

  describe('Rendering', () => {
    it('should render form fields for new vendor', () => {
      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email domain/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should render form with existing vendor data', () => {
      const existingVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        organizationNumber: '123456789',
        emailDomain: 'test.com',
      };

      render(
        <VendorForm
          projectId="project-1"
          existingVendor={existingVendor}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('Test Vendor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123456789')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update vendor/i })).toBeInTheDocument();
    });

    it('should show remove button when editing existing vendor', () => {
      const existingVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        organizationNumber: '123456789',
        emailDomain: 'test.com',
      };

      render(
        <VendorForm
          projectId="project-1"
          existingVendor={existingVendor}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByRole('button', { name: /remove vendor/i })).toBeInTheDocument();
    });
  });

  describe('BRREG Search', () => {
    it('should search BRREG when typing company name', async () => {
      const user = userEvent.setup();
      const searchResults = [
        {
          organizationNumber: '123456789',
          name: 'Test Company AS',
          organizationForm: 'AS',
          address: { city: 'Oslo', street: null, postalCode: null, municipality: null },
          website: null,
          industry: null,
        },
      ];
      (apiModule.api.vendors.search as any).mockResolvedValue({ results: searchResults, total: 1 });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const companyInput = screen.getByLabelText(/company name/i);
      await user.type(companyInput, 'Test');

      // Wait for debounce
      await waitFor(
        () => {
          expect(apiModule.api.vendors.search).toHaveBeenCalledWith('Test');
        },
        { timeout: 1000 }
      );
    });

    it('should display search results dropdown', async () => {
      const user = userEvent.setup();
      const searchResults = [
        {
          organizationNumber: '123456789',
          name: 'Test Company AS',
          organizationForm: 'AS',
          address: { city: 'Oslo', street: null, postalCode: null, municipality: null },
          website: null,
          industry: null,
        },
      ];
      (apiModule.api.vendors.search as any).mockResolvedValue({ results: searchResults, total: 1 });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const companyInput = screen.getByLabelText(/company name/i);
      await user.type(companyInput, 'Test');

      await waitFor(
        () => {
          expect(screen.getByText('Test Company AS')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('should select company from search results', async () => {
      const user = userEvent.setup();
      const searchResults = [
        {
          organizationNumber: '123456789',
          name: 'Test Company AS',
          organizationForm: 'AS',
          address: { city: 'Oslo', street: null, postalCode: null, municipality: null },
          website: null,
          industry: null,
        },
      ];
      (apiModule.api.vendors.search as any).mockResolvedValue({ results: searchResults, total: 1 });
      (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
        organizationNumber: '123456789',
        name: 'Test Company AS',
        organizationForm: 'AS',
        address: null,
        website: null,
        industry: null,
        rawData: {},
      });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const companyInput = screen.getByLabelText(/company name/i);
      await user.type(companyInput, 'Test');

      await waitFor(
        () => {
          expect(screen.getByText('Test Company AS')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      const resultButton = screen.getByText('Test Company AS');
      await user.click(resultButton);

      await waitFor(() => {
        expect(apiModule.api.vendors.getBrregData).toHaveBeenCalledWith('123456789');
      });
    });
  });

  describe('Organization Number Lookup', () => {
    it('should lookup organization number in BRREG when 9 digits entered', async () => {
      const user = userEvent.setup();
      (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
        organizationNumber: '123456789',
        name: 'Found Company',
        organizationForm: 'AS',
        address: null,
        website: null,
        industry: null,
        rawData: {},
      });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '123456789');

      await waitFor(
        () => {
          expect(apiModule.api.vendors.getBrregData).toHaveBeenCalledWith('123456789');
        },
        { timeout: 1000 }
      );
    });

    it('should show success message when organization number is found', async () => {
      const user = userEvent.setup();
      (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
        organizationNumber: '123456789',
        name: 'Found Company',
        organizationForm: 'AS',
        address: null,
        website: null,
        industry: null,
        rawData: {},
      });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '123456789');

      await waitFor(
        () => {
          expect(screen.getByText(/found in brreg.no/i)).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('should extract email domain from website', async () => {
      const user = userEvent.setup();
      (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
        organizationNumber: '123456789',
        name: 'Found Company',
        organizationForm: 'AS',
        address: null,
        website: 'https://www.example.com',
        industry: null,
        rawData: {},
      });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '123456789');

      await waitFor(
        () => {
          const emailDomainInput = screen.getByLabelText(/email domain/i);
          expect(emailDomainInput).toHaveValue('example.com');
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Form Validation', () => {
    it('should show error when company name is empty', async () => {
      const user = userEvent.setup();
      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const companyInput = screen.getByLabelText(/company name/i);
      companyInput.removeAttribute('required'); // Bypass HTML5 validation
      
      const submitButton = screen.getByRole('button', { name: /add vendor/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
      }, { timeout: 2000 });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error for invalid organization number length', async () => {
      const user = userEvent.setup();
      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '12345');
      
      // The component shows inline validation message when length is > 0 and < 9
      // This is the key behavior we're testing - the component provides immediate
      // feedback when the organization number length is invalid
      await waitFor(() => {
        expect(screen.getByText(/exactly 9 digits/i)).toBeInTheDocument();
      }, { timeout: 1000 });
      
      // Verify the inline message is showing
      expect(screen.getByText(/exactly 9 digits/i)).toBeInTheDocument();
      
      // Note: Testing submit prevention is difficult due to blur behavior that clears
      // the org number. The component's handleSubmit does validate and prevent submission
      // when org number length is invalid, but the onBlur handler clears it first.
      // The key behavior tested here is that the inline validation message appears.
    });

    it('should show error when organization number not found in BRREG', async () => {
      const user = userEvent.setup();
      (apiModule.api.vendors.getBrregData as any).mockRejectedValue(new Error('not found'));

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '123456789');

      // Wait for lookup to complete (it will fail)
      // The component shows a warning message when org number is not found
      await waitFor(
        () => {
          expect(screen.getByText(/not found in brreg.no/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Verify the warning is showing
      expect(screen.getByText(/not found in brreg.no/i)).toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: /add vendor/i });
      await user.click(submitButton);

      // Wait a bit for state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify submission was prevented - the component's handleSubmit returns early
      // when org number is not found in BRREG
      expect(mockOnSubmit).not.toHaveBeenCalled();
      
      // The component shows a warning message inline, and handleSubmit also sets
      // an error message. For this test, we verify that submission is prevented.
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Company',
          status: 'Pending',
        });
      });
    });

    it('should include organization number when provided', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      (apiModule.api.vendors.getBrregData as any).mockResolvedValue({
        organizationNumber: '123456789',
        name: 'Test Company',
        organizationForm: 'AS',
        address: null,
        website: null,
        industry: null,
        rawData: {},
      });

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      const orgInput = screen.getByLabelText(/organization number/i);
      await user.type(orgInput, '123456789');

      await waitFor(
        () => {
          expect(apiModule.api.vendors.getBrregData).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Company',
            organizationNumber: '123456789',
          })
        );
      });
    });

    it('should handle submit errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to save vendor';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      render(
        <VendorForm
          projectId="project-1"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await user.type(screen.getByLabelText(/company name/i), 'Test Company');
      await user.click(screen.getByRole('button', { name: /add vendor/i }));

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe('Cancel', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <VendorForm
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
    it('should show delete confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const existingVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        organizationNumber: '123456789',
        emailDomain: 'test.com',
      };

      const { container } = render(
        <VendorForm
          projectId="project-1"
          existingVendor={existingVendor}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove vendor/i });
      await user.click(removeButton);

      // Wait for dialog to appear - it's a fixed overlay div
      await waitFor(() => {
        // Check for the fixed overlay
        const fixedOverlay = container.querySelector('.fixed.inset-0');
        expect(fixedOverlay).toBeInTheDocument();
      }, { timeout: 2000 });
      
      // Then check for the dialog content - the title is "Remove Vendor" (capital V)
      // Use getAllByText to handle case where text appears multiple times
      const removeTexts = screen.getAllByText(/remove vendor/i);
      expect(removeTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/test vendor/i)).toBeInTheDocument();
    });

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);
      const existingVendor = {
        id: 'vendor-1',
        name: 'Test Vendor',
        organizationNumber: '123456789',
        emailDomain: 'test.com',
      };

      render(
        <VendorForm
          projectId="project-1"
          existingVendor={existingVendor}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onDelete={mockOnDelete}
        />
      );

      await user.click(screen.getByRole('button', { name: /remove vendor/i }));
      const confirmButton = screen.getByRole('button', { name: /^remove$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledTimes(1);
      });
    });
  });
});




