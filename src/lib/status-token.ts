/**
 * Colorblind-safe status tokens — a three-level semantic ramp that always pairs
 * a color with a **glyph** and a **shape** (stroke dash / hatch pattern), so a
 * status is never carried by hue alone (WCAG 1.4.1).
 *
 * Roughly 8% of users cannot reliably distinguish the red/amber/green status
 * triad. Every consumer that previously leaned on color alone — chart strokes,
 * budget bars, legends, recovery rows — reads its color, icon, and shape from
 * the same token here, so the encoding can no longer drift between surfaces and
 * always offers a non-color cue.
 *
 * Color is sourced from `chart-colors` (the single color source of truth); this
 * module adds the glyph + shape layer on top.
 */

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import {
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_ERROR,
  statusBg,
  statusBorder,
  withOpacity,
  OVERLAY_WHITE,
  OPACITY_40,
  OPACITY_60,
} from '@/lib/chart-colors';

/**
 * Canonical three-level status ramp:
 *  - `ok`   — healthy / under-budget / recovered / easy
 *  - `warn` — caution / nearing-limit / partial / balanced
 *  - `bad`  — error / over-budget / lost / hard
 */
export type StatusLevel = 'ok' | 'warn' | 'bad';

export interface StatusToken {
  level: StatusLevel;
  /** Solid hex — text, icons, SVG/canvas fills, progress fills. */
  color: string;
  /** Translucent fill (color @ 8%) — badge / card backgrounds. */
  bg: string;
  /** Translucent border (color @ 20%). */
  border: string;
  /** Distinct glyph per level (check / triangle / x) — shape cue #1. */
  Icon: LucideIcon;
  /** SVG `stroke-dasharray`: '' solid (ok) · '6 3' dashed (warn) · '2 3' dotted (bad). */
  dash: string;
  /** CSS `border-style` keyword matching `dash`. */
  borderStyle: 'solid' | 'dashed' | 'dotted';
  /** CSS `background-image` hatch overlay for bar fills ('' when solid) — shape cue #2. */
  pattern: string;
  /** Short uppercase word — default OK / WARN / OVER (consumers may override). */
  word: string;
  /** Accessible label for `aria-label` / `title`. */
  label: string;
}

// White diagonal hatching layered over a (translucent) status fill so the
// pattern reads on any color and on the dark surfaces. `warn` is a coarse dash,
// `bad` a tighter dotted line — mirroring the dashed/dotted stroke language.
const HATCH_WARN = `repeating-linear-gradient(45deg, ${withOpacity(OVERLAY_WHITE, OPACITY_40)} 0 2px, transparent 2px 6px)`;
const HATCH_BAD = `repeating-linear-gradient(45deg, ${withOpacity(OVERLAY_WHITE, OPACITY_60)} 0 1.5px, transparent 1.5px 4px)`;

export const STATUS_TOKENS: Record<StatusLevel, StatusToken> = {
  ok: {
    level: 'ok',
    color: STATUS_SUCCESS,
    bg: statusBg(STATUS_SUCCESS),
    border: statusBorder(STATUS_SUCCESS),
    Icon: CheckCircle2,
    dash: '',
    borderStyle: 'solid',
    pattern: '',
    word: 'OK',
    label: 'OK',
  },
  warn: {
    level: 'warn',
    color: STATUS_WARNING,
    bg: statusBg(STATUS_WARNING),
    border: statusBorder(STATUS_WARNING),
    Icon: AlertTriangle,
    dash: '6 3',
    borderStyle: 'dashed',
    pattern: HATCH_WARN,
    word: 'WARN',
    label: 'Warning',
  },
  bad: {
    level: 'bad',
    color: STATUS_ERROR,
    bg: statusBg(STATUS_ERROR),
    border: statusBorder(STATUS_ERROR),
    Icon: XCircle,
    dash: '2 3',
    borderStyle: 'dotted',
    pattern: HATCH_BAD,
    word: 'OVER',
    label: 'Over limit',
  },
};

/** Ordered ramp (best → worst) — drive legends from this so order is stable. */
export const STATUS_RAMP: readonly StatusToken[] = [
  STATUS_TOKENS.ok,
  STATUS_TOKENS.warn,
  STATUS_TOKENS.bad,
];

/** Map `getBudgetStatus` output (`'ok' | 'amber' | 'red'`) to a ramp token. */
export function budgetStatusToken(status: 'ok' | 'amber' | 'red'): StatusToken {
  return status === 'red' ? STATUS_TOKENS.bad : status === 'amber' ? STATUS_TOKENS.warn : STATUS_TOKENS.ok;
}

/** Map a recovery-result status to a ramp token. */
export function recoveryStatusToken(status: 'recovered' | 'partial' | 'lost'): StatusToken {
  return status === 'lost' ? STATUS_TOKENS.bad : status === 'partial' ? STATUS_TOKENS.warn : STATUS_TOKENS.ok;
}

/**
 * Map a 0-100 score/confidence to a ramp token: ≥80 healthy (ok), ≥50 caution
 * (warn), else failing (bad). Keeps the threshold logic in one place so a value,
 * its glyph, and its color always agree.
 */
export function scoreStatusToken(score: number): StatusToken {
  if (score >= 80) return STATUS_TOKENS.ok;
  if (score >= 50) return STATUS_TOKENS.warn;
  return STATUS_TOKENS.bad;
}
