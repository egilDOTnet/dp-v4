import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseInlineEditOptions<T> {
  onSave: (data: T) => Promise<void>;
  onCancel?: () => void;
  autoSaveDelay?: number;
}

export interface UseInlineEditReturn<T> {
  isEditing: boolean;
  isAnimating: boolean;
  isSaving: boolean;
  error: string | null;
  startEditing: () => void;
  cancelEditing: () => void;
  save: (data: T) => Promise<void>;
  setError: (error: string | null) => void;
}

export function useInlineEdit<T>({
  onSave,
  onCancel,
  autoSaveDelay,
}: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const [isEditing, setIsEditing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setIsAnimating(false);
    setError(null);
    
    // Trigger animation after element is in DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setIsAnimating(false);
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsEditing(false);
      setError(null);
      onCancel?.();
    }, 300);
  }, [onCancel]);

  const save = useCallback(
    async (data: T) => {
      // Clear any pending auto-save
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }

      setIsSaving(true);
      setError(null);

      try {
        await onSave(data);
        
        // Animate out
        setIsAnimating(false);
        
        // Wait for animation then close
        setTimeout(() => {
          setIsEditing(false);
        }, 300);
      } catch (err: any) {
        setError(err.message || 'Failed to save');
        throw err; // Re-throw so caller can handle if needed
      } finally {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  const _scheduleAutoSave = useCallback(
    (data: T) => {
      if (!autoSaveDelay) return;

      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }

      autoSaveTimeout.current = setTimeout(() => {
        save(data);
      }, autoSaveDelay);
    },
    [autoSaveDelay, save]
  );

  return {
    isEditing,
    isAnimating,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    save,
    setError,
  };
}
