import {
  ACCENT_ORANGE, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_NEUTRAL,
} from '@/lib/chart-colors';
import type { DodgeParams, DodgePhases, DodgeChainEntry } from './dodge-types';

/** Clamp dodgeDuration to a safe minimum to prevent division-by-zero / Infinity / NaN */
export function safeDur(d: number): number {
  return Number.isFinite(d) && d >= 0.01 ? d : 0.01;
}

/* ── Cross-field validation ───────────────────────────────────────────────── */

/** Enforce cross-field invariants after any individual param change.
 *  Prevents i-frames extending past movement, negative-width cancel windows,
 *  and cancel phases rendering past dodge duration. */
export function clampDodgeParams(p: DodgeParams): DodgeParams {
  const dur = p.dodgeDuration;
  const iFrameStart = Math.min(Math.max(p.iFrameStart, 0), dur);
  const iFrameDuration = Math.min(Math.max(p.iFrameDuration, 0), dur - iFrameStart);
  const cancelWindowStart = Math.min(Math.max(p.cancelWindowStart, 0), dur);
  const cancelWindowEnd = Math.max(cancelWindowStart, Math.min(Math.max(p.cancelWindowEnd, 0), dur));

  return { ...p, iFrameStart, iFrameDuration, cancelWindowStart, cancelWindowEnd };
}

/* ── Derived phase computation ────────────────────────────────────────────── */

export function computePhases(p: DodgeParams): DodgePhases {
  const totalTimeline = p.dodgeDuration + p.cooldown;
  return {
    movement: { start: 0, end: p.dodgeDuration, color: ACCENT_CYAN, label: 'Movement' },
    invuln: { start: p.iFrameStart, end: p.iFrameStart + p.iFrameDuration, color: ACCENT_ORANGE, label: 'I-Frames' },
    cancel: { start: p.cancelWindowStart, end: Math.min(p.cancelWindowEnd, p.dodgeDuration), color: ACCENT_VIOLET, label: 'Cancel' },
    recovery: { start: p.dodgeDuration, end: totalTimeline, color: STATUS_NEUTRAL, label: 'Cooldown' },
    totalTimeline,
  };
}

/** Compute the end time of a dodge chain (last entry start + its full timeline). */
export function getChainEndTime(chain: DodgeChainEntry[]): number {
  if (chain.length === 0) return 0;
  const last = chain[chain.length - 1];
  return last.startTime + computePhases(last.params).totalTimeline;
}

/** Quadratic ease-out: peak speed at start, decelerating to 0 */
export function speedCurve(alpha: number): number {
  return Math.max(0, 1 - alpha * alpha);
}

/** Distance integral of ease-out: alpha - alpha^3/3, normalized */
export function distanceCurve(alpha: number): number {
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return (clamped - (clamped * clamped * clamped) / 3) / (1 - 1 / 3);
}
