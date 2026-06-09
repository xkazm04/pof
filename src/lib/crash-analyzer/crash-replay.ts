/* ------------------------------------------------------------------ */
/*  UE5 Crash Analyzer — Replay (Time Machine) ordering                */
/* ------------------------------------------------------------------ */
//
// Pure, DOM-free helpers that turn a raw callstack into a left→right
// execution narrative for the Crash Time Machine timeline. Kept separate from
// the React component (like the constellation `layout.ts`) so the ordering /
// culprit-detection logic is unit-testable without rendering.

import type { CallstackFrame } from '@/types/crash-analyzer';

/** A callstack frame stamped with its position in the replay timeline. */
export interface ReplayFrame extends CallstackFrame {
  /** Position on the timeline: 0 = entry/outermost caller, last = crash point. */
  pos: number;
}

/**
 * Order callstack frames into a left→right execution story: the outermost
 * caller (entry point — the highest stack index) on the left, flowing inward to
 * the deepest crash point (index 0) on the right. This reads as "execution
 * flows from the engine into game code and stops on the culprit," which is the
 * opposite of the raw top-of-stack-first frame list.
 *
 * Sorts a copy by descending `index` so it is robust to an unsorted callstack
 * (e.g. a freshly parsed import).
 */
export function orderCallstackForReplay(callstack: CallstackFrame[]): ReplayFrame[] {
  return [...callstack]
    .sort((a, b) => b.index - a.index)
    .map((frame, pos) => ({ ...frame, pos }));
}

/**
 * The timeline position the replay "stops" on — the dramatic climax:
 *   1. the frame flagged `isCrashOrigin` (set by the analysis engine), else
 *   2. the deepest game-code frame (closest to the crash point), else
 *   3. the final frame.
 *
 * Returns 0 for an empty timeline.
 */
export function findCulpritPos(ordered: ReplayFrame[]): number {
  if (ordered.length === 0) return 0;

  const origin = ordered.find((f) => f.isCrashOrigin);
  if (origin) return origin.pos;

  // `ordered` runs entry → crash, so the last (highest-pos) game-code frame is
  // the deepest one before execution dives into engine internals.
  const gameFrames = ordered.filter((f) => f.isGameCode);
  if (gameFrames.length > 0) return gameFrames[gameFrames.length - 1].pos;

  return ordered.length - 1;
}
