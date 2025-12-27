import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { SearchInput } from '@/components/ui/SearchInput';

describe('SearchInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers(); // Use real timers by default
  });

  describe('Rendering', () => {
    it('should render search input', () => {
      render(<SearchInput value="" onChange={mockOnChange} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<SearchInput value="" onChange={mockOnChange} placeholder="Search..." />);
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('should render with value', () => {
      render(<SearchInput value="test query" onChange={mockOnChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('test query');
    });

    it('should render search icon', () => {
      const { container } = render(<SearchInput value="" onChange={mockOnChange} />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Debouncing', () => {
    it('should debounce onChange calls', async () => {
      const user = userEvent.setup();
      render(<SearchInput value="" onChange={mockOnChange} debounceMs={300} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // onChange should not be called immediately
      expect(mockOnChange).not.toHaveBeenCalled();

      // Wait for debounce delay (300ms + some buffer)
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('test');
      }, { timeout: 500 });
    });

    it('should call onChange immediately when debounceMs is 0', async () => {
      const user = userEvent.setup();
      render(<SearchInput value="" onChange={mockOnChange} debounceMs={0} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 't');

      // With debounceMs=0, onChange should be called immediately (synchronously)
      // Wait a bit for React state updates
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('t');
      }, { timeout: 1000 });
    });
  });

  describe('Expandable mode', () => {
    it('should start collapsed when expandable is true and value is empty', () => {
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} expandable={true} />
      );
      // When collapsed, it renders a button, not an input
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('w-10'); // collapsed width
    });

    it('should start expanded when expandable is true and value has content', () => {
      const { container } = render(
        <SearchInput value="test" onChange={mockOnChange} expandable={true} />
      );
      // When expanded, width classes are on the wrapper div, not the input
      const wrapper = container.querySelector('div.relative');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('w-56', 'sm:w-72'); // expanded width
    });

    it('should expand when clicked in collapsed mode', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} expandable={true} />
      );

      // Initially collapsed - should be a button
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('w-10'); // collapsed

      await user.click(button!);

      // After click, should expand to show input
      await waitFor(() => {
        const wrapper = container.querySelector('div.relative');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).toHaveClass('w-56', 'sm:w-72'); // expanded
      });
    });

    it('should collapse when blurred and empty in expandable mode', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} expandable={true} />
      );

      // Click to expand
      const button = container.querySelector('button');
      await user.click(button!);
      
      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      });

      const _input = screen.getByRole('textbox');
      await user.tab(); // blur

      // Wait for collapse delay (150ms + some buffer for React updates)
      await waitFor(() => {
        const collapsedButton = container.querySelector('button');
        expect(collapsedButton).toBeInTheDocument();
        expect(collapsedButton).toHaveClass('w-10'); // collapsed
      }, { timeout: 500 });
    });
  });

  describe('Sizes', () => {
    it('should render with small size', () => {
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} size="sm" />
      );
      const input = container.querySelector('input');
      expect(input).toHaveClass('h-8', 'text-sm');
    });

    it('should render with medium size by default', () => {
      const { container } = render(<SearchInput value="" onChange={mockOnChange} />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('h-10', 'text-sm');
    });

    it('should render with large size', () => {
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} size="lg" />
      );
      const input = container.querySelector('input');
      expect(input).toHaveClass('h-12', 'text-base');
    });
  });

  describe('Clear button', () => {
    it('should show clear button when value is not empty', () => {
      render(<SearchInput value="test" onChange={mockOnChange} />);
      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should not show clear button when value is empty', () => {
      render(<SearchInput value="" onChange={mockOnChange} />);
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });

    it('should clear value when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<SearchInput value="test" onChange={mockOnChange} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      // Clear should call onChange immediately (not debounced)
      expect(mockOnChange).toHaveBeenCalledWith('');
    });
  });

  describe('Auto focus', () => {
    it('should auto focus when autoFocus is true', async () => {
      render(<SearchInput value="" onChange={mockOnChange} autoFocus={true} />);
      const input = screen.getByRole('textbox');
      
      // Auto focus happens in useEffect after mount, so wait a bit
      await waitFor(() => {
        expect(input).toHaveFocus();
      }, { timeout: 1000 });
    });

    it('should not auto focus when autoFocus is false', () => {
      render(<SearchInput value="" onChange={mockOnChange} autoFocus={false} />);
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveFocus();
    });
  });

  describe('Value synchronization', () => {
    it('should update internal value when value prop changes', async () => {
      const { rerender } = render(<SearchInput value="" onChange={mockOnChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');

      rerender(<SearchInput value="new value" onChange={mockOnChange} />);

      // Value sync happens in useEffect, wait for it
      await waitFor(() => {
        expect(input.value).toBe('new value');
      }, { timeout: 1000 });
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <SearchInput value="" onChange={mockOnChange} className="custom-class" />
      );
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});




