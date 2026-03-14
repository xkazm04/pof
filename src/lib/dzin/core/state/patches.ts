import { compare, type Operation } from 'fast-json-patch';
import type { PatchOrigin, TaggedOperation, StateEngine } from './types';

// ---------------------------------------------------------------------------
// Tagged Patch Creation
// ---------------------------------------------------------------------------

/**
 * Tags a single RFC 6902 JSON Patch operation with an origin.
 */
export function createTaggedPatch(
  op: Operation,
  origin: PatchOrigin
): TaggedOperation {
  return { ...op, origin };
}

// ---------------------------------------------------------------------------
// User Change Capture
// ---------------------------------------------------------------------------

/**
 * Captures a user-initiated state change by:
 * 1. Cloning the current state
 * 2. Applying the mutator function to the clone
 * 3. Diffing the original vs mutated state
 * 4. Dispatching the resulting patches with origin='user'
 *
 * If the mutator produces no changes, no dispatch occurs.
 */
export function captureUserChange<T extends object>(
  engine: StateEngine<T>,
  mutator: (state: T) => void,
  description: string
): void {
  const before = engine.getState();
  const after = structuredClone(before);
  mutator(after);

  const ops: Operation[] = compare(before as object, after as object);
  if (ops.length === 0) return;

  engine.dispatch(ops, 'user', description);
}
