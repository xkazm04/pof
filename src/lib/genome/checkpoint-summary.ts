/** ── Checkpoint Auto-Summary ──────────────────────────────────────────────── *
 * Derives a short, human-readable "what changed since last checkpoint" line
 * for any genome checkpoint by running `diffGenomes` against the previous
 * checkpoint's snapshot. The full delta list is kept too for the timeline's
 * expanded view.
 *
 * Type-parameterised on the genome shape and DiffFieldSpec list so it can be
 * reused for item genomes (or anything else with a diff spec) without the lib
 * importing from a specific editor's component tree.
 * ────────────────────────────────────────────────────────────────────────── */

import { diffGenomes, type DiffFieldSpec, type GenomeFieldDelta } from './genome-diff';

export interface CheckpointSummary {
  /** Field-level deltas vs. the previous checkpoint (empty for the first). */
  deltas: GenomeFieldDelta[];
  /** Short one-line summary, e.g. "Crit Chance +7%, Walk Speed +200 cm/s". */
  headline: string;
  /** True when this is the first checkpoint and there is nothing to diff. */
  isInitial: boolean;
}

const MAX_HEADLINE_ENTRIES = 3;

function formatDeltaLine(delta: GenomeFieldDelta): string {
  // Numeric: prefer the signed delta when present ("+7%"); fall back to from→to.
  if (delta.delta) return `${delta.label} ${delta.delta}`;
  return `${delta.label} ${delta.from} → ${delta.to}`;
}

/**
 * Build a CheckpointSummary describing how `current` differs from `previous`.
 * If `previous` is undefined, returns the initial-checkpoint summary.
 */
export function summarizeCheckpoint<T>(
  current: T,
  previous: T | undefined,
  specs: DiffFieldSpec<T>[],
): CheckpointSummary {
  if (previous === undefined) {
    return { deltas: [], headline: 'Initial checkpoint', isInitial: true };
  }
  const deltas = diffGenomes(previous, current, specs);
  if (deltas.length === 0) {
    return { deltas, headline: 'No stat changes', isInitial: false };
  }
  const head = deltas.slice(0, MAX_HEADLINE_ENTRIES).map(formatDeltaLine).join(', ');
  const overflow = deltas.length - MAX_HEADLINE_ENTRIES;
  const headline = overflow > 0 ? `${head} +${overflow} more` : head;
  return { deltas, headline, isInitial: false };
}

/**
 * Given snapshots in CHRONOLOGICAL order (oldest first), pair each entry with
 * its auto-summary diffed against the prior entry. The first entry is "Initial".
 *
 * Returns the input ids paired with their summary so the caller can map them
 * back onto whatever checkpoint object it is rendering.
 */
export function summarizeSnapshotSeries<T>(
  snapshots: T[],
  specs: DiffFieldSpec<T>[],
): CheckpointSummary[] {
  return snapshots.map((snap, i) =>
    summarizeCheckpoint(snap, i > 0 ? snapshots[i - 1] : undefined, specs),
  );
}
