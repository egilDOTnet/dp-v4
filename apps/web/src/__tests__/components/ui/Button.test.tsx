import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/FormField';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should render with primary variant by default', () => {
      const { container } = render(<Button>Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-primary-600');
    });

    it('should render with secondary variant', () => {
      const { container } = render(<Button variant="secondary">Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-background-secondary');
    });

    it('should render with danger variant', () => {
      const { container } = render(<Button variant="danger">Delete</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-red-600');
    });

    it('should render with ghost variant', () => {
      const { container } = render(<Button variant="ghost">Cancel</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-transparent');
    });

    it('should render with small size', () => {
      const { container } = render(<Button size="sm">Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
    });

    it('should render with medium size by default', () => {
      const { container } = render(<Button>Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('should render with large size', () => {
      const { container } = render(<Button size="lg">Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });

    it('should render with full width', () => {
      const { container } = render(<Button fullWidth>Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('w-full');
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when loading is true', () => {
      render(<Button loading>Click me</Button>);
      const button = screen.getByRole('button');
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should disable button when loading is true', () => {
      render(<Button loading>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not show loading spinner when loading is false', () => {
      render(<Button loading={false}>Click me</Button>);
      const button = screen.getByRole('button');
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('should disable button when disabled prop is true', () => {
      render(<Button disabled>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should disable button when loading is true', () => {
      render(<Button loading>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should apply disabled styles when disabled', () => {
      const { container } = render(<Button disabled>Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('Interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<Button onClick={mockOnClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<Button disabled onClick={mockOnClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when loading', async () => {
      const user = userEvent.setup();
      const mockOnClick = vi.fn();
      render(<Button loading onClick={mockOnClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Type attribute', () => {
    it('should render with type attribute when specified', () => {
      render(<Button type="button">Click me</Button>);
      const button = screen.getByRole('button') as HTMLButtonElement;
      expect(button.type).toBe('button');
    });

    it('should render as submit type when specified', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button') as HTMLButtonElement;
      expect(button.type).toBe('submit');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<Button className="custom-class">Click me</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('custom-class');
    });
  });
});





