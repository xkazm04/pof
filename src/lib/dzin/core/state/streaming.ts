import { applyPatch, compare, type Operation } from 'fast-json-patch';
import type { StateEngine, TaggedOperation } from './types';

// ---------------------------------------------------------------------------
// StreamController Interface
// ---------------------------------------------------------------------------

/** Transport-agnostic controller for progressive LLM response rendering. */
export interface StreamController {
  /** Begin a new streaming session. Auto-commits if a session is already active. */
  start(description: string): void;
  /** Apply a single JSON Patch operation immediately. No-op if not active. */
  applyPatch(patch: Operation): void;
  /** Commit all accumulated patches as a single undo group. */
  commit(): void;
  /** Abort streaming -- keeps rendered content, records as undoable group. */
  abort(): void;
  /** Whether a streaming session is currently active. */
  isActive(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a StreamController that processes JSON Patch streams progressively,
 * integrating with the state engine's undo system.
 *
 * - Patches are applied one-by-one for immediate UI updates.
 * - On commit, all streamed patches become a single undo group.
 * - On abort, rendered content is kept and made undoable.
 */
export function createStreamController<T extends object>(
  engine: StateEngine<T>
): StreamController {
  let active = false;
  let description = '';
  let preStreamSnapshot: T | null = null;
  let pendingPatches: Operation[] = [];

  function start(desc: string): void {
    // Auto-commit previous session if still active
    if (active) {
      commit();
    }

    active = true;
    description = desc;
    preStreamSnapshot = engine.getState();
    pendingPatches = [];
  }

  function applyPatchOp(patch: Operation): void {
    if (!active) return;

    pendingPatches.push(patch);

    // Apply the single patch to a clone of current state
    const currentState = engine.getState();
    const result = applyPatch(
      currentState as object,
      [structuredClone(patch)],
      true,  // validate
      false  // mutateDocument=false
    );

    engine._applyWithoutUndo(result.newDocument as T);
  }

  function commit(): void {
    if (!active) return;

    active = false;

    // No-op if no patches were applied
    if (pendingPatches.length === 0) {
      preStreamSnapshot = null;
      pendingPatches = [];
      return;
    }

    const postStreamState = engine.getState();

    // Generate inverse patches: compare(postStream, preStream) gives us the
    // operations that would revert from post-stream back to pre-stream state.
    const inversePatches = compare(
      postStreamState as object,
      preStreamSnapshot as object
    );

    // Generate forward patches: compare(preStream, postStream) gives us the
    // consolidated set of operations (may differ from individual patches).
    const forwardPatches = compare(
      preStreamSnapshot as object,
      postStreamState as object
    );

    // Tag forward patches with 'llm' origin
    const taggedPatches: TaggedOperation[] = forwardPatches.map((op) => ({
      ...op,
      origin: 'llm' as const,
    }));

    engine._recordUndoGroup(taggedPatches, inversePatches, 'llm', description);

    // Reset
    preStreamSnapshot = null;
    pendingPatches = [];
  }

  function abort(): void {
    // Abort keeps whatever has been rendered -- delegates to commit()
    // so the applied patches become a single undoable group.
    commit();
  }

  function isActiveCheck(): boolean {
    return active;
  }

  return {
    start,
    applyPatch: applyPatchOp,
    commit,
    abort,
    isActive: isActiveCheck,
  };
}
