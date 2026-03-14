import type { StateEngine } from './types';

// ---------------------------------------------------------------------------
// Snapshot Serialization
// ---------------------------------------------------------------------------

/**
 * Produces a JSON-serializable snapshot of the current workspace state.
 * Used to provide context to the LLM about the current workspace configuration.
 */
export function serializeSnapshot<T>(engine: StateEngine<T>): string {
  return engine.getSnapshot();
}
