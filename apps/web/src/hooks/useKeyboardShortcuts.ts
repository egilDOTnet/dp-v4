import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: {
    ctrlOrMeta?: boolean;
    shift?: boolean;
    alt?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { ctrlOrMeta = false, shift = false, alt = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesModifiers =
        (ctrlOrMeta ? event.metaKey || event.ctrlKey : !event.metaKey && !event.ctrlKey) &&
        (shift ? event.shiftKey : !event.shiftKey) &&
        (alt ? event.altKey : !event.altKey);

      if (event.key.toLowerCase() === key.toLowerCase() && matchesModifiers) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, handler, ctrlOrMeta, shift, alt, enabled]);
}

// Global shortcuts hook for common application shortcuts
export function useGlobalShortcuts() {
  // Cmd/Ctrl + K for search is handled in SearchBar component
  // Escape for closing modals/menus is handled in individual components
  
  // Cmd/Ctrl + ? for help (future feature)
  useKeyboardShortcut('/', () => {
    // Could open a shortcuts help modal
    console.log('Keyboard shortcuts help');
  }, { ctrlOrMeta: true });

  return null;
}

// Helper to get the platform-specific modifier key text
export function getModifierKeyText() {
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
}
