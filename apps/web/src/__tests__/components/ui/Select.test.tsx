import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Select, FormField } from '@/components/ui/FormField';

describe('Select', () => {
  const mockOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3', disabled: true },
  ];

  describe('Rendering', () => {
    it('should render select element', () => {
      render(<Select options={mockOptions} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render options', () => {
      render(<Select options={mockOptions} />);
      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Select options={mockOptions} placeholder="Select an option" />);
      expect(screen.getByRole('option', { name: 'Select an option' })).toBeInTheDocument();
    });

    it('should render with value', () => {
      render(<Select options={mockOptions} value="option1" onChange={() => {}} />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option1');
    });

    it('should render disabled options', () => {
      render(<Select options={mockOptions} />);
      const option = screen.getByRole('option', { name: 'Option 3' });
      expect(option).toBeDisabled();
    });
  });

  describe('FormField wrapper', () => {
    it('should render with label', () => {
      render(
        <FormField label="Choose option">
          <Select options={mockOptions} />
        </FormField>
      );
      expect(screen.getByLabelText('Choose option')).toBeInTheDocument();
    });

    it('should render with required indicator', () => {
      render(
        <FormField label="Choose option" required>
          <Select options={mockOptions} />
        </FormField>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should render with error message', () => {
      render(
        <FormField label="Choose option" error="Please select an option">
          <Select options={mockOptions} />
        </FormField>
      );
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Interactions', () => {
    it('should call onChange when option is selected', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      render(<Select options={mockOptions} onChange={mockOnChange} />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'option2');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update value when option is selected', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Select options={mockOptions} value="" onChange={() => {}} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await user.selectOptions(select, 'option1');

      rerender(<Select options={mockOptions} value="option1" onChange={() => {}} />);
      expect(select.value).toBe('option1');
    });
  });

  describe('Disabled state', () => {
    it('should disable select when disabled prop is true', () => {
      render(<Select options={mockOptions} disabled />);
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      const { container } = render(<Select options={mockOptions} disabled />);
      const select = container.querySelector('select');
      expect(select).toHaveClass('disabled:bg-background-tertiary', 'disabled:cursor-not-allowed', 'disabled:opacity-60');
    });
  });

  describe('Error state', () => {
    it('should apply error styles when hasError is true', () => {
      const { container } = render(<Select options={mockOptions} hasError />);
      const select = container.querySelector('select');
      expect(select).toHaveClass('border-red-500');
    });
  });

  describe('Children as options', () => {
    it('should render children as options when options prop is not provided', () => {
      render(
        <Select>
          <option value="opt1">Option 1</option>
          <option value="opt2">Option 2</option>
        </Select>
      );
      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to select element', () => {
      const ref = { current: null } as any;
      render(<Select options={mockOptions} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Select options={mockOptions} className="custom-class" />);
      const select = container.querySelector('select');
      expect(select).toHaveClass('custom-class');
    });
  });
});




