/**
 * NBA score-breakdown → plain-language factor segments.
 *
 * The Next Best Action engine ({@link nba-engine}) computes a rich
 * {@link ScoreBreakdown} (urgency / successProb / impact / recency / readiness)
 * for every recommendation, but the UI only ever surfaced a single reason
 * string. This pure helper turns that opaque numeric breakdown into an ordered
 * list of colored, human-readable segments so a non-technical user can see
 * *why* an action ranks first — not just that it does.
 *
 * Kept DOM-free and side-effect-free so it can be unit-tested in isolation;
 * the visual bar lives in `components/modules/shared/NBAScoreBar.tsx`.
 */

import {
  STATUS_BLOCKER, STATUS_SUCCESS, STATUS_INFO, STATUS_STALE, STATUS_LIME,
} from '@/lib/chart-colors';
import { NBA_FACTOR_WEIGHTS, type NBARecommendation } from '@/lib/nba-engine';

/** One of the five scored factors. */
export type NBAFactorKey = keyof typeof NBA_FACTOR_WEIGHTS;

export interface NBAFactorSegment {
  /** Factor identity. */
  key: NBAFactorKey;
  /** Short factor name for the legend (e.g. "Urgency"). */
  label: string;
  /** Points this factor contributed to the composite score (0–`max`). */
  points: number;
  /** Maximum points this factor can contribute (its scoring weight). */
  max: number;
  /** Token color for the segment — a chart-colors token, never a raw hex. */
  color: string;
  /** Plain-language, non-technical explanation of this factor's contribution. */
  plain: string;
}

/**
 * Render order — most decisive factor first, so the bar reads left-to-right by
 * importance and the legend mirrors it.
 */
const FACTOR_ORDER: NBAFactorKey[] = [
  'urgency', 'successProb', 'impact', 'recency', 'readiness',
];

const FACTOR_LABEL: Record<NBAFactorKey, string> = {
  urgency: 'Urgency',
  successProb: 'Success odds',
  impact: 'Impact',
  recency: 'Priority',
  readiness: 'Readiness',
};

/** Distinct, semantically-chosen tokens — one hue per factor. */
const FACTOR_COLOR: Record<NBAFactorKey, string> = {
  urgency: STATUS_BLOCKER,    // orange — clears blocked / do-now work
  successProb: STATUS_SUCCESS, // green — likely to succeed
  impact: STATUS_INFO,         // blue — ripples outward to other features
  recency: STATUS_STALE,       // purple — recently flagged by the evaluator
  readiness: STATUS_LIME,      // lime — ready to start right now
};

/** Build the plain-language sentence for a factor from real recommendation data. */
function plainFor(key: NBAFactorKey, rec: NBARecommendation): string {
  const b = rec.breakdown;
  switch (key) {
    case 'urgency':
      return 'Clears a path for blocked or critical work';
    case 'successProb':
      return `${Math.round(rec.successProbability * 100)}% past success on similar work`;
    case 'impact': {
      // Engine: impact = min(dependentCount × 4, 20) — recover the count exactly
      // below the cap, show "5+" at the cap.
      const capped = b.impact >= NBA_FACTOR_WEIGHTS.impact;
      const count = Math.max(1, Math.round(b.impact / 4));
      const plural = count === 1 && !capped ? '' : 's';
      return `Unblocks ${count}${capped ? '+' : ''} downstream feature${plural}`;
    }
    case 'recency':
      return 'Flagged as a priority by the evaluator';
    case 'readiness':
      return b.readiness >= NBA_FACTOR_WEIGHTS.readiness
        ? 'All dependencies satisfied — ready now'
        : 'Most dependencies satisfied';
  }
}

/**
 * Project a recommendation's score breakdown into ordered, non-zero factor
 * segments. Points are already 0–100 across all factors (the weights sum to
 * 100), so a segment's `points` doubles as its percent width on the bar.
 */
export function nbaFactorSegments(rec: NBARecommendation): NBAFactorSegment[] {
  const b = rec.breakdown;
  return FACTOR_ORDER
    .map((key): NBAFactorSegment => ({
      key,
      label: FACTOR_LABEL[key],
      points: Math.round(b[key]),
      max: NBA_FACTOR_WEIGHTS[key],
      color: FACTOR_COLOR[key],
      plain: plainFor(key, rec),
    }))
    .filter((seg) => seg.points > 0);
}

/**
 * Screen-reader summary of the whole breakdown — used as the bar's `aria-label`
 * so assistive tech gets the full reasoning without needing the hover legend.
 */
export function nbaBreakdownAriaLabel(rec: NBARecommendation): string {
  const segments = nbaFactorSegments(rec);
  const detail = segments
    .map((s) => `${s.label} ${s.points} of ${s.max}, ${s.plain}`)
    .join('; ');
  return `Why recommended — score ${rec.score} of 100: ${detail}`;
}
