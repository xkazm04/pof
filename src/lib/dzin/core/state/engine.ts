import { applyPatch, compare, type Operation } from 'fast-json-patch';
import type {
  PatchOrigin,
  PatchGroup,
  TaggedOperation,
  StateEngine,
  StateSubscriber,
  UndoStack,
} from './types';

// ---------------------------------------------------------------------------
// No-op Undo Stack (stub until Task 2 provides createUndoStack)
// ---------------------------------------------------------------------------

function createNoopUndoStack(): UndoStack {
  return {
    push: () => {},
    undo: () => null,
    redo: () => null,
    canUndo: () => false,
    canRedo: () => false,
    getHistory: () => [],
    clear: () => {},
  };
}

// ---------------------------------------------------------------------------
// State Engine Factory
// ---------------------------------------------------------------------------

/**
 * Creates a state engine that manages workspace state through RFC 6902
 * JSON Patch operations with origin tracking and undo/redo support.
 *
 * @param initialState - The initial state document.
 * @param undoStack - Optional UndoStack implementation (defaults to no-op stub).
 */
export function createStateEngine<T>(
  initialState: T,
  undoStack?: UndoStack
): StateEngine<T> {
  let state: T = structuredClone(initialState);
  const subscribers = new Set<StateSubscriber<T>>();
  const stack: UndoStack = undoStack ?? createNoopUndoStack();

  function getState(): T {
    return structuredClone(state);
  }

  function getSnapshot(): string {
    return JSON.stringify(state);
  }

  function notify(group: PatchGroup): void {
    const currentState = getState();
    for (const listener of subscribers) {
      listener(currentState, group);
    }
  }

  function dispatch(
    operations: Operation[],
    origin: PatchOrigin,
    description: string
  ): void {
    const prevState = structuredClone(state);

    // Apply patches immutably
    const result = applyPatch(
      structuredClone(state),
      structuredClone(operations),
      true,  // validate
      false  // mutateDocument=false
    );
    state = result.newDocument as T;

    // Generate inverse patches (compare new -> old to get reverse)
    const inversePatches = compare(state as object, prevState as object);

    // Tag operations with origin
    const taggedPatches: TaggedOperation[] = operations.map((op) => ({
      ...op,
      origin,
    }));

    // Create patch group
    const group: PatchGroup = {
      id: crypto.randomUUID(),
      patches: taggedPatches,
      inversePatches,
      origin,
      description,
      timestamp: Date.now(),
    };

    // Record in undo stack
    stack.push(group);

    // Notify subscribers
    notify(group);
  }

  function undo(): PatchGroup | null {
    const group = stack.undo();
    if (!group) return null;

    // Apply inverse patches
    const result = applyPatch(
      structuredClone(state),
      structuredClone(group.inversePatches),
      true,
      false
    );
    state = result.newDocument as T;

    // Notify with the group (so subscribers know what was undone)
    notify(group);
    return group;
  }

  function redo(): PatchGroup | null {
    const group = stack.redo();
    if (!group) return null;

    // Re-apply forward patches (strip origin tag for applyPatch)
    const rawOps: Operation[] = group.patches.map(
      ({ origin: _o, ...rest }) => rest as Operation,
    );
    const result = applyPatch(
      structuredClone(state),
      structuredClone(rawOps),
      true,
      false
    );
    state = result.newDocument as T;

    // Notify
    notify(group);
    return group;
  }

  function canUndo(): boolean {
    return stack.canUndo();
  }

  function canRedo(): boolean {
    return stack.canRedo();
  }

  function getHistory(): PatchGroup[] {
    return stack.getHistory();
  }

  function subscribe(listener: StateSubscriber<T>): () => void {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }

  function _applyWithoutUndo(newDoc: T): void {
    state = structuredClone(newDoc);
  }

  function _recordUndoGroup(
    patches: TaggedOperation[],
    inversePatches: Operation[],
    origin: PatchOrigin,
    description: string
  ): void {
    const group: PatchGroup = {
      id: crypto.randomUUID(),
      patches,
      inversePatches,
      origin,
      description,
      timestamp: Date.now(),
    };
    stack.push(group);
  }

  return {
    getState,
    getSnapshot,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    getHistory,
    subscribe,
    _applyWithoutUndo,
    _recordUndoGroup,
  };
}
