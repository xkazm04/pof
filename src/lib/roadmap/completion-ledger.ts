/* ------------------------------------------------------------------ */
/*  Completion ledger — WHEN each checklist item was first completed  */
/* ------------------------------------------------------------------ */
//
// `checklistProgress` records THAT an item is done, never WHEN — so no velocity
// or forecast can be derived from it alone. The ledger is the missing ground
// truth: `ledger[module][item] = epoch ms of the transition to done`. It is
// stamped by moduleStore on the first completion and by the server when the CLI
// marks an item (`/api/checklist/complete`), removed when the item is un-done,
// and persisted in the project_progress row (`completed_json`) through
// `src/lib/project-progress-db.ts` — two copies meet via `mergeLedgers` (the
// earliest stamp wins).
//
// Items that are done but carry no stamp (completed before the ledger existed,
// or by a path that did not stamp yet) are UNDATED: counted and disclosed,
// never placed in a week. A forecast with no dated sample is null, not a guess
// (game-production ▸ production-work-prioritization: a rate travels with its
// sample; unmeasured is not a pass).

import type { VelocityPoint, VelocitySample } from '@/types/project-health';

export type CompletionLedger = Record<string, Record<string, number>>;
export type ChecklistProgress = Record<string, Record<string, boolean>>;

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Most recent weeks drawn as bars; older dated completions carry into the cumulative. */
export const MAX_HISTORY_WEEKS = 12;
/** Weeks averaged into `avgVelocity`. */
export const VELOCITY_WINDOW_WEEKS = 3;

/**
 * Apply one checklist transition to the ledger. A first completion stamps `at`;
 * a repeat keeps the original stamp; un-doing removes it. Returns the SAME
 * reference when nothing changed (Zustand no-op set).
 */
export function stampCompletion(
  ledger: CompletionLedger,
  moduleId: string,
  itemId: string,
  checked: boolean,
  at: number,
): CompletionLedger {
  const mod = ledger[moduleId] ?? {};
  const has = Object.prototype.hasOwnProperty.call(mod, itemId);
  if (checked) {
    if (has) return ledger;
    return { ...ledger, [moduleId]: { ...mod, [itemId]: at } };
  }
  if (!has) return ledger;
  const rest = { ...mod };
  delete rest[itemId];
  return { ...ledger, [moduleId]: rest };
}

/**
 * Union two ledgers of the SAME project; where both date an item the earliest
 * stamp wins (a completion happened once, at its first recorded time). Non-finite
 * values are dropped rather than trusted.
 */
export function mergeLedgers(a: CompletionLedger, b: CompletionLedger): CompletionLedger {
  const out: CompletionLedger = {};
  for (const src of [a, b]) {
    for (const [moduleId, stamps] of Object.entries(src ?? {})) {
      if (!stamps || typeof stamps !== 'object') continue;
      for (const [itemId, at] of Object.entries(stamps)) {
        if (typeof at !== 'number' || !Number.isFinite(at)) continue;
        const mod = (out[moduleId] ??= {});
        const prev = mod[itemId];
        mod[itemId] = prev === undefined ? at : Math.min(prev, at);
      }
    }
  }
  return out;
}

/** Keep only stamps whose item is done in `progress` (a load replaced the checklist). */
export function pruneLedger(ledger: CompletionLedger, progress: ChecklistProgress): CompletionLedger {
  const out: CompletionLedger = {};
  for (const [moduleId, stamps] of Object.entries(ledger)) {
    const done = progress[moduleId] ?? {};
    const kept: Record<string, number> = {};
    for (const [itemId, at] of Object.entries(stamps)) if (done[itemId] === true) kept[itemId] = at;
    if (Object.keys(kept).length > 0) out[moduleId] = kept;
  }
  return out;
}

export interface WeeklySeries {
  velocityHistory: VelocityPoint[];
  sample: VelocitySample;
  /** Mean items/week over the last VELOCITY_WINDOW_WEEKS buckets; null with no dated sample. */
  avgVelocity: number | null;
}

/**
 * Bucket the dated completions of DONE items (in `moduleIds` only) into rolling
 * 7-day windows ending at `now`. Pure: `now` is injected, never read ambiently.
 */
export function weeklyCompletionSeries(
  progress: ChecklistProgress,
  ledger: CompletionLedger,
  moduleIds: readonly string[],
  now: number,
): WeeklySeries {
  const stamps: number[] = [];
  let undated = 0;
  for (const moduleId of moduleIds) {
    const done = progress[moduleId] ?? {};
    const dates = ledger[moduleId] ?? {};
    for (const [itemId, isDone] of Object.entries(done)) {
      if (!isDone) continue;
      const at = dates[itemId];
      if (typeof at === 'number' && Number.isFinite(at)) stamps.push(Math.min(at, now));
      else undated += 1;
    }
  }

  if (stamps.length === 0) {
    return { velocityHistory: [], sample: { datedCompletions: 0, undated, weeks: 0 }, avgVelocity: null };
  }

  const earliest = Math.min(...stamps);
  const spanWeeks = Math.max(1, Math.ceil((now - earliest) / WEEK_MS));
  const shown = Math.min(spanWeeks, MAX_HISTORY_WEEKS);
  const windowStart = now - shown * WEEK_MS;

  const counts = new Array<number>(shown).fill(0);
  let carried = 0;
  for (const at of stamps) {
    if (at < windowStart) { carried += 1; continue; }
    counts[Math.min(shown - 1, Math.floor((at - windowStart) / WEEK_MS))] += 1;
  }

  let cumulative = carried;
  const velocityHistory: VelocityPoint[] = counts.map((itemsCompleted, i) => {
    cumulative += itemsCompleted;
    return {
      weekLabel: `W${i + 1}`,
      weekStart: new Date(windowStart + i * WEEK_MS).toISOString(),
      itemsCompleted,
      cumulativeCompleted: cumulative,
    };
  });

  const recent = counts.slice(-VELOCITY_WINDOW_WEEKS);
  const avg = recent.reduce((s, n) => s + n, 0) / recent.length;
  return {
    velocityHistory,
    sample: { datedCompletions: stamps.length, undated, weeks: spanWeeks },
    avgVelocity: Math.round(avg * 10) / 10,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The provenance line rendered beside a velocity — a rate never travels without its sample. */
export function describeVelocitySample(sample: VelocitySample): string {
  const undated = sample.undated > 0 ? ` (${sample.undated} undated)` : '';
  if (sample.datedCompletions === 0) return `no dated completions yet${undated}`;
  return `from ${plural(sample.datedCompletions, 'dated completion', 'dated completions')} over ${plural(
    sample.weeks,
    'week',
    'weeks',
  )}${undated}`;
}
