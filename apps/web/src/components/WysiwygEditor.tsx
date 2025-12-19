"use client";

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useSearch } from "@/hooks/useSearch";

interface ProjectMember {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  projectMembers?: ProjectMember[];
  onSubmit?: () => void;
}

export interface WysiwygEditorRef {
  focus: () => void;
}

const WysiwygEditor = forwardRef<WysiwygEditorRef, WysiwygEditorProps>(({
  value,
  onChange,
  placeholder = "Start typing...",
  projectMembers = [],
  onSubmit,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Format member name for display (full name for dropdown)
  const getMemberDisplayName = (member: ProjectMember): string => {
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.firstName || member.lastName || member.name || member.email;
  };

  // Get mention display name (first name if unique, full name if not)
  const getMentionDisplayName = (member: ProjectMember, allMembers: ProjectMember[]): string => {
    if (!member.firstName) {
      // No first name, use full display name
      return getMemberDisplayName(member);
    }

    // Check if first name is unique
    const firstNameCount = allMembers.filter(
      (m) => m.firstName && m.firstName.toLowerCase() === member.firstName.toLowerCase()
    ).length;

    if (firstNameCount === 1) {
      // First name is unique, use just first name
      return member.firstName;
    } else {
      // First name is not unique, use full name
      return getMemberDisplayName(member);
    }
  };

  // Search/filter members
  const { filteredItems: filteredMembers, setSearchTerm } = useSearch(
    projectMembers,
    {
      searchKeys: ["firstName", "lastName", "name", "email"],
      caseSensitive: false,
      minChars: 0,
    }
  );

  // Update search when mention query changes
  useEffect(() => {
    setSearchTerm(mentionQuery);
  }, [mentionQuery, setSearchTerm]);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
    },
  }));

  // Sync value to editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      onChange(editor.innerHTML);
      return;
    }

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const text = textNode.textContent || "";

    // Check if we're in a mention span (don't trigger inside mentions)
    let currentNode: Node | null = range.startContainer;
    while (currentNode && currentNode !== editor) {
      if (
        currentNode.nodeType === Node.ELEMENT_NODE &&
        (currentNode as Element).hasAttribute("data-mention")
      ) {
        onChange(editor.innerHTML);
        return;
      }
      currentNode = currentNode.parentNode;
    }

    // Find @ trigger
    const cursorPosition = range.startOffset;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const match = textBeforeCursor.match(/@(\w*)$/);

    if (match && projectMembers.length > 0) {
      const query = match[1];
      setMentionQuery(query);
      setShowMentionDropdown(true);

      // Calculate dropdown position
      // getBoundingClientRect may not be available in test environments (jsdom)
      const rect = range.getBoundingClientRect?.() || { bottom: 0, left: 0 };
      const editorRect = editor.getBoundingClientRect();
      setMentionPosition({
        top: rect.bottom - editorRect.top + 5,
        left: rect.left - editorRect.left,
      });
      setSelectedMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery("");
    }

    onChange(editor.innerHTML);
  }, [onChange, projectMembers]);

  const insertMention = useCallback(
    (member: ProjectMember) => {
      if (!editorRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const displayName = getMentionDisplayName(member, projectMembers);

      // Find the @ character and delete everything from @ to cursor
      // The @ should be in the current text node since we just typed it
      const textNode = range.startContainer;
      if (textNode.nodeType === Node.TEXT_NODE) {
        const text = textNode.textContent || "";
        const cursorPosition = range.startOffset;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const atIndex = textBeforeCursor.lastIndexOf("@");
        
        if (atIndex !== -1) {
          // Create a new range that starts at @ and ends at cursor
          const deleteRange = document.createRange();
          deleteRange.setStart(textNode, atIndex);
          deleteRange.setEnd(textNode, cursorPosition);
          deleteRange.deleteContents();
          
          // Set the selection to the start of the deleted range
          range.setStart(textNode, atIndex);
          range.collapse(true);
        }
      } else {
        // If not in a text node, try to find the @ in the editor content
        // This handles edge cases where the DOM structure might be different
        const editorText = editorRef.current.textContent || "";
        const cursorPos = editorRef.current.textContent?.length || 0;
        const textBefore = editorText.substring(0, cursorPos);
        const atIndex = textBefore.lastIndexOf("@");
        
        if (atIndex !== -1) {
          // Find the text node and offset corresponding to atIndex
          const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let currentPos = 0;
          let targetNode: Node | null = null;
          let targetOffset = 0;
          
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent?.length || 0;
            
            if (currentPos + nodeLength >= atIndex) {
              targetNode = node;
              targetOffset = atIndex - currentPos;
              break;
            }
            
            currentPos += nodeLength;
          }
          
          if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
            const deleteRange = document.createRange();
            deleteRange.setStart(targetNode, targetOffset);
            deleteRange.setEnd(range.startContainer, range.startOffset);
            deleteRange.deleteContents();
            
            range.setStart(targetNode, targetOffset);
            range.collapse(true);
          }
        }
      }

      // Create mention span
      const mentionSpan = document.createElement("span");
      mentionSpan.setAttribute("data-mention", "true");
      mentionSpan.setAttribute("data-user-id", member.id);
      mentionSpan.className = "mention";
      mentionSpan.textContent = `@${displayName}`;
      mentionSpan.style.color = "var(--color-primary-600, #65d405)";
      mentionSpan.style.fontWeight = "500";

      // Insert the mention
      range.insertNode(mentionSpan);

      // Add a space after the mention to break any styling
      const spaceNode = document.createTextNode(" ");
      range.setStartAfter(mentionSpan);
      range.insertNode(spaceNode);

      // Move cursor after the space
      range.setStartAfter(spaceNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      // Close dropdown and reset state
      setShowMentionDropdown(false);
      setMentionQuery("");
      setSelectedMentionIndex(0);

      // Update content
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
      editorRef.current?.focus();
    },
    [onChange, projectMembers]
  );

  const execCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    
    // Ensure editor is focused
    editorRef.current.focus();
    const editor = editorRef.current;
    
    // For formatBlock commands (H1, H2, H3, P), ensure we have a selection
    if (command === "formatBlock" && value) {
      let selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // No selection - create a range at the cursor or wrap the current block
        const range = document.createRange();
        
        // Try to find the current block element from the anchor node
        let blockElement: Node | null = null;
        if (selection && selection.anchorNode) {
          let node: Node | null = selection.anchorNode;
          while (node && node !== editor) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'LI'].includes(element.tagName)) {
                blockElement = node;
                break;
              }
            }
            node = node.parentNode;
          }
        }
        
        // Ensure we have a selection object
        if (!selection) {
          selection = window.getSelection();
        }
        
        if (blockElement && selection) {
          // Wrap existing block
          range.selectNodeContents(blockElement);
          selection.removeAllRanges();
          selection.addRange(range);
        } else if (selection) {
          // Create a new block at the end or current position
          const newBlock = document.createElement(value);
          if (editor.childNodes.length === 0 || editor.lastChild?.nodeType === Node.TEXT_NODE) {
            // Editor is empty or ends with text, append new block
            editor.appendChild(newBlock);
            range.selectNodeContents(newBlock);
            range.collapse(false);
          } else {
            // Insert after last block
            editor.appendChild(newBlock);
            range.selectNodeContents(newBlock);
            range.collapse(false);
          }
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        // We have a selection, but formatBlock might not work if selection spans multiple blocks
        // Try to ensure we're formatting a single block
        const range = selection.getRangeAt(0);
        let blockElement: Node | null = null;
        
        // Find common ancestor that's a block element
        let node: Node | null = range.commonAncestorContainer;
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV', 'LI', 'BODY'].includes(element.tagName)) {
              blockElement = node;
              break;
            }
          }
          node = node.parentNode;
        }
        
        // If we found a block, select it entirely for formatting
        if (blockElement && blockElement !== editorRef.current) {
          const newRange = document.createRange();
          newRange.selectNodeContents(blockElement);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }
    
    // Execute the command
    document.execCommand(command, false, value);
    
    // Ensure editor stays focused and update content
    editorRef.current.focus();
    handleInput();
  };

  const isCommandActive = (command: string): boolean => {
    return document.queryCommandState(command);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) for form submission
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (onSubmit && !showMentionDropdown) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredMembers[selectedMentionIndex]) {
          insertMention(filteredMembers[selectedMentionIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionDropdown(false);
        setMentionQuery("");
        setSelectedMentionIndex(0);
      }
    }
  };

  const ToolbarButton = ({
    command,
    icon,
    title,
    value,
  }: {
    command: string;
    icon: React.ReactNode;
    title: string;
    value?: string;
  }) => {
    const active = isCommandActive(command);
    return (
      <button
        type="button"
        onClick={() => execCommand(command, value)}
        className={`px-2 py-1 rounded hover:bg-background-primary ${
          active ? "bg-background-secondary" : ""
        }`}
        title={title}
        onMouseDown={(e) => e.preventDefault()}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Toolbar */}
      <div className="border-b border-gray-300 bg-background-secondary p-2 flex items-center gap-1 flex-wrap">
        <ToolbarButton
          command="formatBlock"
          value="h1"
          title="Heading 1"
          icon={<span className="text-sm font-bold">H1</span>}
        />
        <ToolbarButton
          command="formatBlock"
          value="h2"
          title="Heading 2"
          icon={<span className="text-sm font-semibold">H2</span>}
        />
        <ToolbarButton
          command="formatBlock"
          value="h3"
          title="Heading 3"
          icon={<span className="text-sm font-medium">H3</span>}
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <ToolbarButton
          command="bold"
          title="Bold"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
              />
            </svg>
          }
        />
        <ToolbarButton
          command="italic"
          title="Italic"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20h4M14 4H6m2 8h8"
              />
            </svg>
          }
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <ToolbarButton
          command="insertUnorderedList"
          title="Bullet List"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 6h13M8 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          }
        />
        <ToolbarButton
          command="insertOrderedList"
          title="Numbered List"
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
          }
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = prompt("Enter URL:");
            if (url) {
              execCommand("createLink", url);
            }
          }}
          className="px-2 py-1 rounded hover:bg-background-primary"
          title="Insert Link"
          onMouseDown={(e) => e.preventDefault()}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            execCommand("formatBlock", "p");
          }}
          className="px-2 py-1 rounded hover:bg-background-primary"
          title="Paragraph"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-xs">P</span>
        </button>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            // Don't close dropdown if clicking on it
            if (mentionDropdownRef.current?.contains(e.relatedTarget as Node)) {
              return;
            }
            setIsFocused(false);
            // Small delay to allow click on dropdown
            setTimeout(() => {
              if (document.activeElement !== editorRef.current) {
                setShowMentionDropdown(false);
              }
            }, 200);
          }}
          className={`min-h-[200px] p-4 outline-none ${
            isFocused ? "ring-2 ring-primary-500" : ""
          }`}
          style={{
            whiteSpace: "pre-wrap",
          }}
          data-placeholder={!value ? placeholder : ""}
          suppressContentEditableWarning
        />
        {/* Mention dropdown */}
        {showMentionDropdown && projectMembers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="absolute z-50 bg-background-tertiary border border-border-primary rounded-md shadow-lg max-h-60 overflow-y-auto"
            style={{
              top: `${mentionPosition.top}px`,
              left: `${mentionPosition.left}px`,
              minWidth: "200px",
            }}
          >
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member, index) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  onMouseEnter={() => setSelectedMentionIndex(index)}
                  className={`w-full text-left px-3 py-2 hover:bg-background-primary transition-colors ${
                    index === selectedMentionIndex ? "bg-background-primary" : ""
                  }`}
                >
                  <div className="font-semibold text-text-primary">
                    {getMemberDisplayName(member)}
                  </div>
                  <div className="text-xs text-text-secondary">{member.email}</div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-text-secondary">
                No matches found
              </div>
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        :global(.mention) {
          color: var(--color-primary-600, #65d405) !important;
          font-weight: 500;
        }
        :global(.mention *) {
          color: var(--color-primary-600, #65d405) !important;
        }
        :global([contenteditable] h1) {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        :global([contenteditable] h2) {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        :global([contenteditable] h3) {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
        }
        :global([contenteditable] p) {
          margin: 1em 0;
        }
        :global([contenteditable] ul),
        :global([contenteditable] ol) {
          margin: 1em 0;
          padding-left: 2em;
        }
        :global([contenteditable] li) {
          margin: 0.5em 0;
        }
      `}</style>
    </div>
  );
});

WysiwygEditor.displayName = "WysiwygEditor";

export default WysiwygEditor;
