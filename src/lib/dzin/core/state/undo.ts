import type { PatchGroup, UndoStack } from './types';

// ---------------------------------------------------------------------------
// Undo Stack Factory
// ---------------------------------------------------------------------------

/** Default maximum number of undo entries. */
const DEFAULT_MAX_DEPTH = 20;

/**
 * Creates a bounded undo/redo stack.
 *
 * - `push()` adds a group, evicts oldest if beyond maxDepth, clears redo.
 * - `undo()` pops from undo, pushes to redo.
 * - `redo()` pops from redo, pushes to undo.
 *
 * @param maxDepth Maximum number of undo entries (default 20).
 */
export function createUndoStack(maxDepth = DEFAULT_MAX_DEPTH): UndoStack {
  const undoEntries: PatchGroup[] = [];
  const redoEntries: PatchGroup[] = [];

  function push(group: PatchGroup): void {
    undoEntries.push(group);
    // Evict oldest if over max depth
    while (undoEntries.length > maxDepth) {
      undoEntries.shift();
    }
    // New action clears redo
    redoEntries.length = 0;
  }

  function undo(): PatchGroup | null {
    const group = undoEntries.pop();
    if (!group) return null;
    redoEntries.push(group);
    return group;
  }

  function redo(): PatchGroup | null {
    const group = redoEntries.pop();
    if (!group) return null;
    undoEntries.push(group);
    return group;
  }

  function canUndo(): boolean {
    return undoEntries.length > 0;
  }

  function canRedo(): boolean {
    return redoEntries.length > 0;
  }

  function getHistory(): PatchGroup[] {
    return [...undoEntries];
  }

  function clear(): void {
    undoEntries.length = 0;
    redoEntries.length = 0;
  }

  return { push, undo, redo, canUndo, canRedo, getHistory, clear };
}
