/**
 * One 0-100 score-band table.
 *
 * Every score -> status helper derives from `SCORE_BANDS` in `@/lib/chart-colors`:
 * `scoreBandToken` (4-band severity vocabulary), `scoreStatusToken` and
 * `successRateColor` (3-level ok/warn/bad projection), the retired chart-colors
 * `healthColor`, and the UnifiedSummary `healthColor`/`healthBg` forks. Before
 * this table existed, five live functions disagreed on 45 of 101 integer scores.
 *
 * The honest floor: unifying may only make a surface LESS flattering. Each
 * retired ladder is re-implemented below from its pre-change thresholds and
 * every score 0..100 must land on a band at least as severe as it used to.
 */
import { describe, it, expect } from 'vitest';
import {
  SCORE_BANDS,
  scoreBand,
  scoreBandToken,
  successRateColor,
  healthColor as chartHealthColor,
  SEVERITY_TOKENS,
  withOpacity,
  OPACITY_10,
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_BLOCKER,
  STATUS_ERROR,
  ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { STATUS_TOKENS, scoreStatusToken, type StatusLevel } from '@/lib/status-token';
import {
  healthColor as summaryHealthColor,
  healthBg as summaryHealthBg,
} from '@/components/modules/evaluator/UnifiedSummaryView/helpers';

const SCORES = Array.from({ length: 101 }, (_, i) => i);

type Severity = 'positive' | 'medium' | 'high' | 'critical';

function projectBand(severity: Severity): StatusLevel {
  if (severity === 'positive') return 'ok';
  if (severity === 'critical') return 'bad';
  return 'warn';
}

/** Severity rank of a rendered colour: 0 healthy .. 3 critical. */
const COLOR_RANK: Record<string, number> = {
  [STATUS_SUCCESS]: 0,
  [ACCENT_EMERALD]: 0,
  [STATUS_WARNING]: 1,
  [STATUS_BLOCKER]: 2,
  [STATUS_ERROR]: 3,
};

function rank(color: string): number {
  const r = COLOR_RANK[color];
  if (r === undefined) throw new Error(`unranked colour ${color}`);
  return r;
}

/** The ladders this table retired, exactly as they read before the change. */
const RETIRED: Record<string, { before: (s: number) => string; after: (s: number) => string }> = {
  'chart-colors healthColor 60/30': {
    before: (s) => (s >= 60 ? STATUS_SUCCESS : s >= 30 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => chartHealthColor(s),
  },
  'UnifiedSummary healthColor 70/45/25': {
    before: (s) => (s >= 70 ? STATUS_SUCCESS : s >= 45 ? STATUS_WARNING : s >= 25 ? STATUS_BLOCKER : STATUS_ERROR),
    after: (s) => summaryHealthColor(s),
  },
  'NodeDeepDivePanel healthColor 70/40': {
    before: (s) => (s >= 70 ? STATUS_SUCCESS : s >= 40 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => STATUS_TOKENS[scoreBand(s).level].color,
  },
  'NBABanner oddsColor 70/40': {
    before: (s) => (s >= 70 ? STATUS_SUCCESS : s >= 40 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => STATUS_TOKENS[scoreBand(s).level].color,
  },
  'HolisticHealth rings 70/40': {
    before: (s) => (s >= 70 ? ACCENT_EMERALD : s >= 40 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => STATUS_TOKENS[scoreBand(s).level].color,
  },
  'PerformanceStatCard 70/40': {
    before: (s) => (s >= 70 ? ACCENT_EMERALD : s >= 40 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => STATUS_TOKENS[scoreBand(s).level].color,
  },
  'CoverageView coverageBand 80/50': {
    before: (s) => (s >= 80 ? STATUS_SUCCESS : s >= 50 ? STATUS_WARNING : STATUS_ERROR),
    after: (s) => STATUS_TOKENS[scoreBand(s).level].color,
  },
  'scoreBandToken 80/60/40': {
    before: (s) => (s >= 80 ? STATUS_SUCCESS : s >= 60 ? STATUS_WARNING : s >= 40 ? STATUS_BLOCKER : STATUS_ERROR),
    after: (s) => scoreBandToken(s).color,
  },
};

describe('SCORE_BANDS — the one 0-100 score-band table', () => {
  it('is one frozen ordered table and scoreBandToken reads it', () => {
    expect(Object.isFrozen(SCORE_BANDS)).toBe(true);
    expect(SCORE_BANDS.map((b) => [b.min, b.severity, b.level])).toEqual([
      [80, 'positive', 'ok'],
      [60, 'medium', 'warn'],
      [50, 'high', 'warn'],
      [-Infinity, 'critical', 'bad'],
    ]);
    for (const b of SCORE_BANDS) expect(Object.isFrozen(b)).toBe(true);
    const pins: [number, Severity][] = [
      [80, 'positive'], [79, 'medium'], [60, 'medium'], [59, 'high'], [50, 'high'], [49, 'critical'], [0, 'critical'],
    ];
    for (const [s, sev] of pins) expect(scoreBandToken(s)).toBe(SEVERITY_TOKENS[sev]);
  });

  it('scoreStatusToken is the 3-level projection of scoreBand for every score 0..100', () => {
    const disagree = SCORES.filter((s) => {
      const band = scoreBand(s);
      return scoreStatusToken(s).level !== projectBand(band.severity) || band.level !== projectBand(band.severity);
    });
    expect(disagree).toEqual([]);
  });

  it('successRateColor and chart-colors healthColor draw the band colour for every score 0..100', () => {
    const disagree = SCORES.filter(
      (s) => successRateColor(s) !== STATUS_TOKENS[scoreBand(s).level].color || chartHealthColor(s) !== successRateColor(s),
    );
    expect(disagree).toEqual([]);
  });

  it('UnifiedSummary healthColor/healthBg derive from scoreBandToken for every score 0..100', () => {
    const disagree = SCORES.filter(
      (s) =>
        summaryHealthColor(s) !== scoreBandToken(s).color ||
        summaryHealthBg(s) !== withOpacity(scoreBandToken(s).color, OPACITY_10),
    );
    expect(disagree).toEqual([]);
  });

  it('no band moves upward: every retired ladder x every score lands at least as severe as before', () => {
    const upward: string[] = [];
    let pairs = 0;
    for (const [name, { before, after }] of Object.entries(RETIRED)) {
      for (const s of SCORES) {
        pairs += 1;
        if (rank(after(s)) < rank(before(s))) upward.push(`${name} @ ${s}`);
      }
    }
    expect(pairs).toBe(Object.keys(RETIRED).length * 101);
    expect(upward).toEqual([]);
  });
});
