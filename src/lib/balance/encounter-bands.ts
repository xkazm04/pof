/**
 * Encounter-band law — the ONE place a fight's survival rate and fight length
 * are turned into a verdict.
 *
 * Registry: game-production/encounter-balance-simulation, "Bands are judgments,
 * floors are laws" — a band's cuts are written once and shared by every surface
 * that reports a fight. Readers today:
 *  - Combat Simulator Fight Report Card (`@/lib/combat/fight-report`) — headline band.
 *  - GAS Balance health report (`gas-balance/balanceHealth.ts`) — survival and
 *    duration findings, headline, narrative, win-margin gates.
 *  - GAS Balance level sweep (`gas-balance/simulation.ts` `detectBreakpoints`) —
 *    a level is a breakpoint exactly when the report would flag it.
 *  - Survival badges (ResultsSummary StatBadge, LevelSweepPanel table cell) —
 *    `survivalTone`.
 *
 * Pure: no React, no DOM. Tuning a cut here moves every reader at once, which is
 * the point; never restate a cut inline in a reader.
 */

import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';

/* ── Survival bands ─────────────────────────────────────────────────────────── */

/** Overall difficulty band, derived from survival rate (0–1). */
export type ReportBand = 'easy' | 'fair' | 'tough' | 'brutal';

/**
 * Lower edge (inclusive) of each band: ≥ 9/10 wins easy, ≥ 6/10 fair,
 * ≥ ~1/3 tough, below that brutal. Moved verbatim from the Combat Simulator.
 */
export const SURVIVAL_BAND_CUTS = { easy: 0.9, fair: 0.6, tough: 0.35 } as const;

/** The survival rate a tuned encounter aims for — the centre of the fair band. */
export const SURVIVAL_TARGET = 0.65;

export function difficultyBand(rate: number): ReportBand {
  if (rate >= SURVIVAL_BAND_CUTS.easy) return 'easy';
  if (rate >= SURVIVAL_BAND_CUTS.fair) return 'fair';
  if (rate >= SURVIVAL_BAND_CUTS.tough) return 'tough';
  return 'brutal';
}

/* ── Severity ───────────────────────────────────────────────────────────────── */

/** Verdict severity a band carries; a subset of the health report's severities. */
export type BandSeverity = 'good' | 'warning' | 'critical';

const SURVIVAL_SEVERITY: Record<ReportBand, BandSeverity> = {
  easy: 'warning',
  fair: 'good',
  tough: 'warning',
  brutal: 'critical',
};

export function bandSeverity(band: ReportBand): BandSeverity {
  return SURVIVAL_SEVERITY[band];
}

/** A verdict worth surfacing as a problem (report finding, sweep breakpoint). */
export function isFlaggedSeverity(severity: string): boolean {
  return severity === 'warning' || severity === 'critical';
}

/* ── Fight-length bands ─────────────────────────────────────────────────────── */

export type FightLengthBand = 'instant' | 'healthy' | 'long' | 'stall';

/** instant: mean TTK below 1s; long: above 20s; stall: above 45s. */
export const FIGHT_LENGTH_CUTS = { instant: 1, long: 20, stall: 45 } as const;

/** The mean fight length (seconds) a tuned encounter aims for. */
export const TTK_TARGET_SEC = 4;

export function fightLengthBand(ttkSec: number): FightLengthBand {
  if (ttkSec < FIGHT_LENGTH_CUTS.instant) return 'instant';
  if (ttkSec > FIGHT_LENGTH_CUTS.stall) return 'stall';
  if (ttkSec > FIGHT_LENGTH_CUTS.long) return 'long';
  return 'healthy';
}

const LENGTH_SEVERITY: Record<FightLengthBand, BandSeverity> = {
  instant: 'warning',
  healthy: 'good',
  long: 'warning',
  stall: 'critical',
};

export function fightLengthSeverity(band: FightLengthBand): BandSeverity {
  return LENGTH_SEVERITY[band];
}

/* ── Tone ───────────────────────────────────────────────────────────────────── */

const SEVERITY_TONE: Record<BandSeverity, string> = {
  good: STATUS_SUCCESS,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

/** Colour a survival rate renders in — the tone of its band's severity. */
export function survivalTone(rate: number): string {
  return SEVERITY_TONE[bandSeverity(difficultyBand(rate))];
}
