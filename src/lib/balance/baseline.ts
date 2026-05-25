/**
 * Balance baselines (ECW Phase 10-B, idea 375a9f88). A baseline is a captured
 * snapshot of an archetype's threat score + stats; drift functions compare the
 * current values against it so designers can catch unintended balance changes.
 * Pure model + drift calcs (persistence in baseline-db.ts / baselineStore).
 */

import type { StatRow } from './threat-score';

export interface BalanceBaseline {
  catalogId: string;
  entityId: string;
  threatScore: number;
  stats: StatRow[];
  capturedAt?: string;
}

export interface ThreatDrift {
  delta: number;
  /** Percent change vs baseline, or null when the baseline is 0. */
  pct: number | null;
}

export interface StatDrift {
  label: string;
  baseline: number;
  current: number;
  delta: number;
}

/** A small dead-band so tiny float noise doesn't read as a change. */
const FLAT_TOLERANCE = 0.5;

export function threatDrift(current: number, baseline: number): ThreatDrift {
  const delta = current - baseline;
  const pct = baseline === 0 ? null : Math.round((delta / baseline) * 100);
  return { delta, pct };
}

export function driftDirection(delta: number): 'up' | 'down' | 'flat' {
  if (delta > FLAT_TOLERANCE) return 'up';
  if (delta < -FLAT_TOLERANCE) return 'down';
  return 'flat';
}

/** Per-stat drift for stats that changed (matched by label; missing = 0). */
export function computeStatDrift(current: StatRow[], baseline: StatRow[]): StatDrift[] {
  const baseByLabel = new Map(baseline.map((s) => [s.label, s.value]));
  const out: StatDrift[] = [];
  for (const s of current) {
    const base = baseByLabel.get(s.label) ?? 0;
    const delta = s.value - base;
    if (Math.abs(delta) > FLAT_TOLERANCE) {
      out.push({ label: s.label, baseline: base, current: s.value, delta });
    }
  }
  return out;
}
