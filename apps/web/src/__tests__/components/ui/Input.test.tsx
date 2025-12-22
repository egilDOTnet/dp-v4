import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Input, FormField } from '@/components/ui/FormField';

describe('Input', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('should render with value', () => {
      render(<Input value="Test value" onChange={() => {}} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Test value');
    });

    it('should render with different input types', () => {
      const { rerender } = render(<Input type="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

      rerender(<Input type="password" />);
      expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');

      rerender(<Input type="number" />);
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
    });
  });

  describe('FormField wrapper', () => {
    it('should render with label', () => {
      render(
        <FormField label="Email">
          <Input />
        </FormField>
      );
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('should render with required indicator', () => {
      render(
        <FormField label="Email" required>
          <Input />
        </FormField>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should render with error message', () => {
      render(
        <FormField label="Email" error="Invalid email">
          <Input />
        </FormField>
      );
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should render with helper text', () => {
      render(
        <FormField label="Email" helperText="We'll never share your email">
          <Input />
        </FormField>
      );
      expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
    });

    it('should prioritize error over helper text', () => {
      render(
        <FormField label="Email" error="Invalid email" helperText="Helper text">
          <Input />
        </FormField>
      );
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should apply error styles when hasError is true', () => {
      const { container } = render(<Input hasError />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('border-red-500');
    });

    it('should not apply error styles when hasError is false', () => {
      const { container } = render(<Input hasError={false} />);
      const input = container.querySelector('input');
      expect(input).not.toHaveClass('border-red-500');
    });
  });

  describe('Interactions', () => {
    it('should call onChange when value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      render(<Input onChange={mockOnChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle Ctrl+A / Cmd+A to select all text', async () => {
      const user = userEvent.setup();
      render(<Input value="Test text" onChange={() => {}} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await user.click(input);
      await user.keyboard('{Meta>}a{/Meta}');

      // The input should have all text selected
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(9);
    });
  });

  describe('Disabled state', () => {
    it('should disable input when disabled prop is true', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should apply disabled styles', () => {
      const { container } = render(<Input disabled />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('disabled:bg-background-tertiary', 'disabled:cursor-not-allowed', 'disabled:opacity-60');
    });
  });

  describe('Ref forwarding', () => {
    it('should forward ref to input element', () => {
      const ref = { current: null } as any;
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Input className="custom-class" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('custom-class');
    });
  });
});



