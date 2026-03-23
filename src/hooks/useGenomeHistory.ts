import { useState, useCallback, useRef, useEffect } from 'react';
import type { CharacterGenome } from '@/types/character-genome';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

interface GenomeHistoryState {
  /** Full history stack of genome snapshots */
  stack: CharacterGenome[][];
  /** Current position in the stack (0 = initial) */
  cursor: number;
}

interface GenomeHistoryReturn {
  genomes: CharacterGenome[];
  setGenomes: (updater: CharacterGenome[] | ((prev: CharacterGenome[]) => CharacterGenome[])) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Wraps a `CharacterGenome[]` state with an immutable snapshot-based undo/redo stack.
 * Snapshots are captured after a 300ms debounce so rapid slider drags produce a single entry.
 * History is capped at 50 entries to bound memory.
 */
export function useGenomeHistory(initial: () => CharacterGenome[]): GenomeHistoryReturn {
  const [genomes, setGenomesRaw] = useState<CharacterGenome[]>(initial);
  const [history, setHistory] = useState<GenomeHistoryState>(() => ({
    stack: [initial()],
    cursor: 0,
  }));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the current update is an undo/redo to skip snapshot capture
  const isUndoRedoRef = useRef(false);

  // Snapshot the current genomes state after debounce
  const scheduleSnapshot = useCallback((nextGenomes: CharacterGenome[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setHistory((prev) => {
        // Discard any future entries beyond current cursor
        const base = prev.stack.slice(0, prev.cursor + 1);
        const next = [...base, nextGenomes];
        // Cap at MAX_HISTORY, dropping oldest entries
        const trimmed = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
        return { stack: trimmed, cursor: trimmed.length - 1 };
      });
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setGenomes = useCallback(
    (updater: CharacterGenome[] | ((prev: CharacterGenome[]) => CharacterGenome[])) => {
      setGenomesRaw((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // Only schedule snapshot for user edits, not undo/redo
        if (!isUndoRedoRef.current) {
          scheduleSnapshot(next);
        }
        return next;
      });
    },
    [scheduleSnapshot],
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.cursor <= 0) return prev;
      // Flush any pending debounce so we don't overwrite the undo
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const newCursor = prev.cursor - 1;
      isUndoRedoRef.current = true;
      setGenomesRaw(prev.stack[newCursor]);
      // Reset flag asynchronously so subsequent user edits capture snapshots
      queueMicrotask(() => { isUndoRedoRef.current = false; });
      return { ...prev, cursor: newCursor };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.cursor >= prev.stack.length - 1) return prev;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const newCursor = prev.cursor + 1;
      isUndoRedoRef.current = true;
      setGenomesRaw(prev.stack[newCursor]);
      queueMicrotask(() => { isUndoRedoRef.current = false; });
      return { ...prev, cursor: newCursor };
    });
  }, []);

  return {
    genomes,
    setGenomes,
    undo,
    redo,
    canUndo: history.cursor > 0,
    canRedo: history.cursor < history.stack.length - 1,
  };
}
