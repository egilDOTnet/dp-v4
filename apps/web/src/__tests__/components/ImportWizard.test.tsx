import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { ImportWizard } from '@/components/ImportWizard';
import { api } from '@/lib/api';
import { createMockPhase } from '../utils/mock-data';

// Mock the csv-parser module
vi.mock('@/lib/csv-parser', () => ({
  parseCSV: vi.fn(),
  validateCSVFile: vi.fn(() => true),
}));

// Mock the router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock ImportHelpDialog
vi.mock('@/components/ImportHelpDialog', () => ({
  ImportHelpDialog: ({ open, onOpenChange }: any) => 
    open ? <div data-testid="import-help-dialog">Help Dialog</div> : null,
}));

describe('ImportWizard', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockFile = new File(['name,description\nTask 1,Description 1'], 'test.csv', {
    type: 'text/csv',
  });

  const mockCsvData = {
    headers: ['name', 'description'],
    rows: [
      ['Task 1', 'Description 1'],
      ['Task 2', 'Description 2'],
    ],
  };

  const mockPhases = [
    createMockPhase({ id: 'phase-1', name: 'Phase 1', order: 1 }),
    createMockPhase({ id: 'phase-2', name: 'Phase 2', order: 2 }),
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPush.mockClear();
    
    // Reset API mocks
    vi.spyOn(api.projects.phases, 'list').mockResolvedValue(mockPhases);
    vi.spyOn(api.projects, 'importTasks').mockResolvedValue({ count: 2 });
    vi.spyOn(api.projects, 'importRFIQuestions').mockResolvedValue({ count: 2 });
    vi.spyOn(api.projects, 'importRequirements').mockResolvedValue({ count: 2 });

    // Mock parseCSV
    const csvParser = await import('@/lib/csv-parser');
    vi.mocked(csvParser.parseCSV).mockResolvedValue(mockCsvData);
  });

  describe('Dialog visibility', () => {
    it('should render when open is true', () => {
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.getByText('Import Data')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(
        <ImportWizard
          projectId="project-1"
          open={false}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.queryByText('Import Data')).not.toBeInTheDocument();
    });
  });

  describe('Step 1: Select Type', () => {
    it('should show data type selection options', () => {
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('RFI Questionnaires')).toBeInTheDocument();
      expect(screen.getByText('Requirements + Hierarchy')).toBeInTheDocument();
    });

    it('should allow selecting a data type', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);

      expect(tasksRadio).toBeChecked();
    });

    it('should show help dialog when help button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const helpButtons = screen.getAllByText('Help');
      await user.click(helpButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('import-help-dialog')).toBeInTheDocument();
      });
    });

    it('should show error when trying to proceed without selecting type', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(screen.getByText(/please select a data type/i)).toBeInTheDocument();
    });

    it('should proceed to file selection when type is selected and next is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Select File', () => {
    it('should show file selection interface', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type first
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
        expect(screen.getByText(/drag and drop a file here/i)).toBeInTheDocument();
      });
    });

    it('should handle file selection via input', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(csvParser.parseCSV).toHaveBeenCalled();
      });
    });

    it('should show error for invalid file type', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      vi.mocked(csvParser.validateCSVFile).mockReturnValue(false);

      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Try to select invalid file
      const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(invalidFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, invalidFile);

      await waitFor(() => {
        expect(screen.getByText(/please select a valid csv file/i)).toBeInTheDocument();
      });
    });

    it('should show file info after file is selected', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument();
      });
    });

    it('should proceed to phase selection for tasks after file is parsed', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
      });
    });

    it('should proceed to column mapping for non-task types after file is parsed', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select RFI questions type
      const rfiRadio = screen.getByLabelText(/rfi questionnaires/i);
      await user.click(rfiRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/map csv columns/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Select Phase (Tasks only)', () => {
    it('should show phase selection for tasks', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
        expect(screen.getByText(/phase 1/i)).toBeInTheDocument();
        expect(screen.getByText(/phase 2/i)).toBeInTheDocument();
      });
    });

    it('should show error when trying to proceed without selecting phase', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
      });

      // Try to proceed without selecting phase
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(screen.getByText(/please select a phase/i)).toBeInTheDocument();
    });
  });

  describe('Step 4: Map Columns', () => {
    it('should show column mapping interface', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Select file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;

      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
      });

      // Select phase
      const phaseSelect = screen.getByRole('combobox');
      await user.selectOptions(phaseSelect, 'phase-1');
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/map csv columns/i)).toBeInTheDocument();
        expect(screen.getByText(/task name/i)).toBeInTheDocument();
      });
    });

    it('should show error when required fields are not mapped', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Navigate to column mapping
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
      });

      const phaseSelect = screen.getByRole('combobox');
      await user.selectOptions(phaseSelect, 'phase-1');
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/map csv columns/i)).toBeInTheDocument();
      });

      // Try to proceed without mapping required field
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(screen.getByText(/please map all required fields/i)).toBeInTheDocument();
    });
  });

  describe('Import execution', () => {
    it('should call import API and show success for tasks', async () => {
      const user = userEvent.setup();
      const csvParser = await import('@/lib/csv-parser');
      
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      // Navigate through all steps
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);
      fileInput.files = dataTransfer.files;
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/select phase for tasks/i)).toBeInTheDocument();
      });

      const phaseSelect = screen.getByRole('combobox');
      await user.selectOptions(phaseSelect, 'phase-1');
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/map csv columns/i)).toBeInTheDocument();
      });

      // Map required field
      const nameSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(nameSelect, '0');

      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/review your import settings/i)).toBeInTheDocument();
      });

      // Click import
      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(api.projects.importTasks).toHaveBeenCalledWith(
          'project-1',
          'phase-1',
          expect.arrayContaining([
            expect.objectContaining({ name: 'Task 1' }),
            expect.objectContaining({ name: 'Task 2' }),
          ])
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/successfully imported/i)).toBeInTheDocument();
        expect(mockOnSuccess).toHaveBeenCalledWith(2, 'tasks');
      });
    });
  });

  describe('Navigation', () => {
    it('should allow going back to previous step', async () => {
      const user = userEvent.setup();
      render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type and proceed
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/select csv file/i)).toBeInTheDocument();
      });

      // Go back
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });
    });
  });

  describe('Reset on close', () => {
    it('should reset state when dialog is closed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Select type
      const tasksRadio = screen.getByLabelText(/tasks/i);
      await user.click(tasksRadio);

      // Close dialog
      rerender(
        <ImportWizard
          projectId="project-1"
          open={false}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Reopen dialog
      rerender(
        <ImportWizard
          projectId="project-1"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      // Should be back at step 1
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(tasksRadio).not.toBeChecked();
    });
  });
});
