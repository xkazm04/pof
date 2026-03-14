import type { Operation } from 'fast-json-patch';
import type { StreamController } from './streaming';

// ---------------------------------------------------------------------------
// User Lock Set
// ---------------------------------------------------------------------------

/**
 * Set of JSON Pointer paths currently locked by user interaction.
 * LLM patches targeting locked paths (or their children) are dropped.
 */
const lockedPaths = new Set<string>();

// ---------------------------------------------------------------------------
// Lock Management
// ---------------------------------------------------------------------------

/** Lock a JSON Pointer path, preventing LLM patches from modifying it. */
export function acquireUserLock(path: string): void {
  lockedPaths.add(path);
}

/** Release a previously locked JSON Pointer path. */
export function releaseUserLock(path: string): void {
  lockedPaths.delete(path);
}

/** Get a copy of all currently locked paths. */
export function getUserLockedPaths(): string[] {
  return [...lockedPaths];
}

// ---------------------------------------------------------------------------
// Conflict Check
// ---------------------------------------------------------------------------

/**
 * Check if a patch path conflicts with any user-locked path.
 * A conflict exists if the patch path starts with a locked path
 * (i.e., the locked path is an ancestor or exact match).
 */
function isPathLocked(patchPath: string): boolean {
  for (const locked of lockedPaths) {
    // Exact match or nested child (locked="/panels/0", patch="/panels/0/density")
    if (patchPath === locked || patchPath.startsWith(locked + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * Apply an LLM patch through the stream controller, but only if the
 * target path is not locked by the user.
 *
 * User-wins conflict resolution: if the user is directly manipulating
 * a path while the LLM is streaming changes, the LLM's changes to
 * that path are silently dropped.
 *
 * @returns true if patch was applied, false if dropped due to conflict
 */
export function applyLLMPatchWithConflictCheck(
  stream: StreamController,
  patch: Operation
): boolean {
  if (isPathLocked(patch.path)) {
    return false;
  }

  stream.applyPatch(patch);
  return true;
}
