import type { PropertyWatchUpdate, SelectedActor } from '@/types/ue5-bridge';

// ── Selection → property watch ─────────────────────────────────────────────
// The live channel already streams each selected actor's object path; these
// helpers turn a selection into a watch entry point instead of making the user
// type '/Game/…' by hand.

/** What the watch form is prefilled with when the user picks an actor. */
export interface WatchDraft {
  objectPath: string;
}

/** Prefill for "Watch…" on an actor — null when it carries no object path. */
export function watchDraftFromActor(actor: SelectedActor): WatchDraft | null {
  const objectPath = actor.path.trim();
  return objectPath ? { objectPath } : null;
}

/** Number of active watches per object path, for the "N watched" row badge. */
export function watchCountsByObjectPath(
  entries: ReadonlyArray<readonly [string, Pick<PropertyWatchUpdate, 'objectPath'>]>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [, { objectPath }] of entries) {
    counts[objectPath] = (counts[objectPath] ?? 0) + 1;
  }
  return counts;
}
