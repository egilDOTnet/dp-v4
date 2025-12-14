import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import WysiwygEditor from '@/components/WysiwygEditor';
import { createMockProjectMember } from '../utils/mock-data';

describe('WysiwygEditor', () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();

  const mockProjectMembers = [
    createMockProjectMember({ id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }),
    createMockProjectMember({ id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' }),
    createMockProjectMember({ id: '3', firstName: 'John', lastName: 'Johnson', email: 'john.j@example.com' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.execCommand
    document.execCommand = vi.fn(() => true);
    // Mock window.prompt
    window.prompt = vi.fn(() => 'https://example.com');
  });

  describe('Rendering', () => {
    it('should render editor with placeholder', () => {
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          placeholder="Start typing..."
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute('data-placeholder', 'Start typing...');
    });

    it('should render toolbar buttons', () => {
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 3')).toBeInTheDocument();
      expect(screen.getByTitle('Bold')).toBeInTheDocument();
      expect(screen.getByTitle('Italic')).toBeInTheDocument();
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
      expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
      expect(screen.getByTitle('Insert Link')).toBeInTheDocument();
      expect(screen.getByTitle('Paragraph')).toBeInTheDocument();
    });

    it('should render with initial value', () => {
      render(
        <WysiwygEditor
          value="<p>Initial content</p>"
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor.innerHTML).toBe('<p>Initial content</p>');
    });
  });

  describe('Text input', () => {
    it('should call onChange when text is typed', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, 'Hello world');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should update editor content when value prop changes', async () => {
      const { rerender } = render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor.innerHTML).toBe('');

      rerender(
        <WysiwygEditor
          value="<p>New content</p>"
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(editor.innerHTML).toBe('<p>New content</p>');
      });
    });
  });

  describe('Formatting commands', () => {
    it('should execute bold command when bold button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const boldButton = screen.getByTitle('Bold');
      await user.click(boldButton);

      expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined);
    });

    it('should execute italic command when italic button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const italicButton = screen.getByTitle('Italic');
      await user.click(italicButton);

      expect(document.execCommand).toHaveBeenCalledWith('italic', false, undefined);
    });

    it('should execute heading commands when heading buttons are clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const h1Button = screen.getByTitle('Heading 1');
      await user.click(h1Button);
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h1');

      const h2Button = screen.getByTitle('Heading 2');
      await user.click(h2Button);
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');

      const h3Button = screen.getByTitle('Heading 3');
      await user.click(h3Button);
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h3');
    });

    it('should execute list commands when list buttons are clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const bulletListButton = screen.getByTitle('Bullet List');
      await user.click(bulletListButton);
      expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, undefined);

      const numberedListButton = screen.getByTitle('Numbered List');
      await user.click(numberedListButton);
      expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList', false, undefined);
    });

    it('should execute paragraph command when paragraph button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const paragraphButton = screen.getByTitle('Paragraph');
      await user.click(paragraphButton);
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'p');
    });

    it('should create link when link button is clicked and URL is provided', async () => {
      const user = userEvent.setup();
      window.prompt = vi.fn(() => 'https://example.com');

      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
      expect(document.execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.com');
    });

    it('should not create link when link button is clicked and URL is cancelled', async () => {
      const user = userEvent.setup();
      window.prompt = vi.fn(() => null);

      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const linkButton = screen.getByTitle('Insert Link');
      await user.click(linkButton);

      expect(window.prompt).toHaveBeenCalled();
      expect(document.execCommand).not.toHaveBeenCalledWith('createLink', expect.anything(), expect.anything());
    });
  });

  describe('Mentions functionality', () => {
    it('should show mention dropdown when @ is typed', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should filter mentions based on query after @', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@j');

      await waitFor(() => {
        // Should show John Doe, Jane Smith, and John Johnson
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('John Johnson')).toBeInTheDocument();
      });

      // Clear and type more specific query
      await user.clear(editor);
      await user.type(editor, '@ja');

      await waitFor(() => {
        // Should only show Jane Smith
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('should insert mention when clicked', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const mentionOption = screen.getByText('John Doe');
      await user.click(mentionOption);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should navigate mentions with arrow keys', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Press ArrowDown to select next mention
      await user.keyboard('{ArrowDown}');
      
      // Press Enter to insert selected mention
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('should close mention dropdown when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('should use first name for unique mentions', async () => {
      const user = userEvent.setup();
      const uniqueMembers = [
        createMockProjectMember({ id: '1', firstName: 'Alice', lastName: 'Doe', email: 'alice@example.com' }),
        createMockProjectMember({ id: '2', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com' }),
      ];

      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={uniqueMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
      });
    });

    it('should use full name for non-unique first names', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        // Both Johns should show full names
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('John Johnson')).toBeInTheDocument();
      });
    });

    it('should not show mention dropdown when no project members', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          projectMembers={[]}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should call onSubmit when Cmd+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit when Ctrl+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not call onSubmit when Cmd+Enter is pressed with mention dropdown open', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          projectMembers={mockProjectMembers}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);
      await user.type(editor, '@');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Should insert mention instead of submitting
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Paste handling', () => {
    it('should handle paste events and insert plain text', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);

      // Simulate paste
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });
      pasteEvent.clipboardData.setData('text/plain', 'Pasted text');
      
      editor.dispatchEvent(pasteEvent);

      expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'Pasted text');
    });
  });

  describe('Focus management', () => {
    it('should show focus ring when editor is focused', async () => {
      const user = userEvent.setup();
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
        />
      );

      const editor = screen.getByRole('textbox');
      await user.click(editor);

      await waitFor(() => {
        expect(editor).toHaveClass('ring-2', 'ring-primary-500');
      });
    });

    it('should expose focus method via ref', async () => {
      const ref = { current: null } as any;
      render(
        <WysiwygEditor
          ref={ref}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current.focus).toBe('function');

      ref.current.focus();
      const editor = screen.getByRole('textbox');
      await waitFor(() => {
        expect(editor).toHaveFocus();
      });
    });
  });

  describe('Placeholder', () => {
    it('should show placeholder when value is empty', () => {
      render(
        <WysiwygEditor
          value=""
          onChange={mockOnChange}
          placeholder="Start typing..."
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('data-placeholder', 'Start typing...');
    });

    it('should not show placeholder when value has content', () => {
      render(
        <WysiwygEditor
          value="<p>Some content</p>"
          onChange={mockOnChange}
          placeholder="Start typing..."
        />
      );

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('data-placeholder', '');
    });
  });
});
