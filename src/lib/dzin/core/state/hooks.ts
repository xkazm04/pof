import { useSyncExternalStore, useCallback, useEffect } from 'react';
import type { StateEngine, PatchGroup, WorkspaceState } from './types';

// ---------------------------------------------------------------------------
// useWorkspaceState
// ---------------------------------------------------------------------------

/**
 * React hook that subscribes to a StateEngine and re-renders on state changes.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useWorkspaceState<T extends object>(engine: StateEngine<T>) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return engine.subscribe(() => {
        onStoreChange();
      });
    },
    [engine]
  );

  const getSnapshot = useCallback(() => engine.getSnapshot(), [engine]);

  // useSyncExternalStore ensures tear-free reads
  const snapshotStr = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const state = JSON.parse(snapshotStr) as T;

  const undo = useCallback(() => engine.undo(), [engine]);
  const redo = useCallback(() => engine.redo(), [engine]);
  const canUndo = engine.canUndo();
  const canRedo = engine.canRedo();
  const history = engine.getHistory();

  return { state, undo, redo, canUndo, canRedo, history };
}

// ---------------------------------------------------------------------------
// useUndoRedoKeyboard
// ---------------------------------------------------------------------------

/**
 * React hook that binds Ctrl+Z (undo), Ctrl+Shift+Z (redo), and Ctrl+Y (redo)
 * keyboard shortcuts. Handles both ctrlKey and metaKey (Mac Cmd).
 */
export function useUndoRedoKeyboard(
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean
): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
