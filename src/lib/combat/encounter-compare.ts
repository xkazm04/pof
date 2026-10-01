import type { ChoreographyAlert, ChoreographySimResult, EncounterOutcome } from './choreography-sim';
import type { DramaticBeat, DramaticBeatType } from './tension-curve';

/**
 * Encounter compare — what one tuning pass changed against a pinned baseline.
 *
 * Diffs two choreography sim runs on the facts a designer judges a pass by:
 * the outcome (died at 18.8s -> survives), duration, story beats gained, lost
 * or moved, and findings resolved, new or persisting.
 *
 * - Beats pair by type in time order; a pair further apart than
 *   `BEAT_MOVE_TOLERANCE_SEC` (start or end) is reported as moved.
 * - Findings pair by their stable `kind` (encounter-findings.ts) in time order,
 *   never by message text, which embeds numbers ("Player dies at 18.8s").
 *
 * Pure: same two runs -> same diff.
 */

/** Beat drift below this is noise (the curve samples at 0.5s). */
export const BEAT_MOVE_TOLERANCE_SEC = 0.25;

export interface MovedBeat {
  type: DramaticBeatType;
  fromSec: number;
  toSec: number;
  /** Set for ranged beats (dead zone, flat pacing) */
  fromEndSec?: number;
  toEndSec?: number;
}

export interface PersistingFinding {
  base: ChoreographyAlert;
  next: ChoreographyAlert;
}

export interface EncounterRunDiff {
  outcome: { base: EncounterOutcome; next: EncounterOutcome };
  /** next − base, rounded to 0.1s */
  durationDeltaSec: number;
  beatsAdded: DramaticBeat[];
  beatsRemoved: DramaticBeat[];
  beatsMoved: MovedBeat[];
  alertsResolved: ChoreographyAlert[];
  alertsNew: ChoreographyAlert[];
  alertsPersisting: PersistingFinding[];
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Pair two lists by key, in time order within a key. Leftovers are unpaired. */
function pairByKey<T extends { timeSec: number }>(base: readonly T[], next: readonly T[], key: (x: T) => string) {
  const pending = new Map<string, T[]>();
  for (const n of [...next].sort((a, b) => a.timeSec - b.timeSec)) {
    const k = key(n);
    pending.set(k, [...(pending.get(k) ?? []), n]);
  }
  const pairs: Array<{ base: T; next: T }> = [];
  const removed: T[] = [];
  for (const b of [...base].sort((a, c) => a.timeSec - c.timeSec)) {
    const queue = pending.get(key(b));
    const match = queue?.shift();
    if (match) pairs.push({ base: b, next: match });
    else removed.push(b);
  }
  const added = next.filter((n) => !pairs.some((p) => p.next === n));
  return { pairs, removed, added };
}

const drifted = (a?: number, b?: number): boolean =>
  (a === undefined) !== (b === undefined) || Math.abs((a ?? 0) - (b ?? 0)) > BEAT_MOVE_TOLERANCE_SEC;

export function diffEncounterRuns(base: ChoreographySimResult, next: ChoreographySimResult): EncounterRunDiff {
  const beats = pairByKey(base.tensionCurve.beats, next.tensionCurve.beats, (b) => b.type);
  const beatsMoved: MovedBeat[] = [];
  for (const { base: b, next: n } of beats.pairs) {
    if (!drifted(b.timeSec, n.timeSec) && !drifted(b.endTimeSec, n.endTimeSec)) continue;
    beatsMoved.push({
      type: b.type, fromSec: b.timeSec, toSec: n.timeSec,
      ...(b.endTimeSec !== undefined || n.endTimeSec !== undefined ? { fromEndSec: b.endTimeSec, toEndSec: n.endTimeSec } : {}),
    });
  }
  const findings = pairByKey(base.alerts, next.alerts, (a) => a.kind);
  // Preserve each run's own finding order (balance first, then pacing).
  const resolved = new Set(findings.removed);
  return {
    outcome: { base: base.outcome, next: next.outcome },
    durationDeltaSec: r1(next.totalDurationSec - base.totalDurationSec),
    beatsAdded: beats.added,
    beatsRemoved: base.tensionCurve.beats.filter((b) => beats.removed.includes(b)),
    beatsMoved,
    alertsResolved: base.alerts.filter((a) => resolved.has(a)),
    alertsNew: findings.added,
    alertsPersisting: findings.pairs,
  };
}
