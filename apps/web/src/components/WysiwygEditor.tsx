"use client";

import { useState, useRef, useEffect } from "react";

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function WysiwygEditor({
  value,
  onChange,
  placeholder = "Start typing...",
}: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value to editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
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
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`min-h-[200px] p-4 outline-none ${
          isFocused ? "ring-2 ring-primary-500" : ""
        }`}
        style={{
          whiteSpace: "pre-wrap",
        }}
        data-placeholder={!value ? placeholder : ""}
        suppressContentEditableWarning
      />
      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
