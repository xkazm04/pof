import { describe, it, expect } from 'vitest';
import { nbaFactorSegments, nbaBreakdownAriaLabel, nbaSuccessOdds } from '@/lib/nba-breakdown';
import { NBA_FACTOR_WEIGHTS, type NBARecommendation } from '@/lib/nba-engine';
import {
  STATUS_BLOCKER, STATUS_SUCCESS, STATUS_INFO, STATUS_STALE, STATUS_LIME,
} from '@/lib/chart-colors';

function makeRec(
  breakdown: Partial<NBARecommendation['breakdown']>,
  extra: Partial<NBARecommendation> = {},
): NBARecommendation {
  const full = { urgency: 0, successProb: 0, impact: 0, recency: 0, readiness: 0, ...breakdown };
  const score = Math.round(
    full.urgency + full.successProb + full.impact + full.recency + full.readiness,
  );
  return {
    item: { id: 'i1', label: 'Test item', description: '', prompt: '' },
    moduleId: 'arpg-combat',
    score,
    reason: 'Test reason',
    pitfalls: [],
    successProbability: 0.5,
    successEvidence: {
      source: 'runs',
      runs: 2,
      successes: 1,
      note: '1 of 2 past runs succeeded',
    },
    breakdown: full,
    featureMatch: {
      source: 'mapped',
      featureNames: ['Test feature'],
      unresolved: [],
      dependentCount: Math.round(full.impact / 4),
      note: 'Relation declared in CHECKLIST_FEATURE_MAP.',
    },
    ...extra,
  };
}

describe('nbaFactorSegments', () => {
  it('drops factors that contributed zero points', () => {
    const segs = nbaFactorSegments(makeRec({ urgency: 18, impact: 8 }));
    expect(segs.map((s) => s.key)).toEqual(['urgency', 'impact']);
  });

  it('orders segments by decisiveness (urgency → readiness)', () => {
    const segs = nbaFactorSegments(
      makeRec({ urgency: 6, successProb: 5, impact: 4, recency: 3, readiness: 2 }),
    );
    expect(segs.map((s) => s.key)).toEqual([
      'urgency', 'successProb', 'impact', 'recency', 'readiness',
    ]);
  });

  it('carries each factor weight as the segment max (single-sourced)', () => {
    const segs = nbaFactorSegments(
      makeRec({ urgency: 1, successProb: 1, impact: 1, recency: 1, readiness: 1 }),
    );
    const maxByKey = Object.fromEntries(segs.map((s) => [s.key, s.max]));
    expect(maxByKey).toEqual(NBA_FACTOR_WEIGHTS);
  });

  it('maps each factor to a distinct chart-colors token', () => {
    const segs = nbaFactorSegments(
      makeRec({ urgency: 1, successProb: 1, impact: 1, recency: 1, readiness: 1 }),
    );
    const colorByKey = Object.fromEntries(segs.map((s) => [s.key, s.color]));
    expect(colorByKey).toEqual({
      urgency: STATUS_BLOCKER,
      successProb: STATUS_SUCCESS,
      impact: STATUS_INFO,
      recency: STATUS_STALE,
      readiness: STATUS_LIME,
    });
    // distinct hues
    expect(new Set(segs.map((s) => s.color)).size).toBe(5);
  });

  it('rounds fractional points (the engine may emit them)', () => {
    const segs = nbaFactorSegments(makeRec({ readiness: 6.999 }));
    expect(segs[0].points).toBe(7);
  });

  it('names the recorded sample in the success-odds sentence, not a bare percentage', () => {
    const segs = nbaFactorSegments(makeRec({ successProb: 17 }, {
      successProbability: 0.82,
      successEvidence: {
        source: 'runs', runs: 50, successes: 41, note: '41 of 50 past runs succeeded',
      },
    }));
    const success = segs.find((s) => s.key === 'successProb');
    expect(success?.plain).toBe('41 of 50 past runs succeeded');
  });

  it('recovers the unblocked-feature count from the impact points', () => {
    const segs = nbaFactorSegments(makeRec({ impact: 12 })); // 12 / 4 = 3
    const impact = segs.find((s) => s.key === 'impact');
    expect(impact?.plain).toBe('Unblocks 3 downstream features');
  });

  it('singularises a single unblocked feature', () => {
    const segs = nbaFactorSegments(makeRec({ impact: 4 }));
    expect(segs.find((s) => s.key === 'impact')?.plain).toBe('Unblocks 1 downstream feature');
  });

  it('shows "N+" once impact hits its cap', () => {
    const segs = nbaFactorSegments(makeRec({ impact: NBA_FACTOR_WEIGHTS.impact }));
    expect(segs.find((s) => s.key === 'impact')?.plain).toBe('Unblocks 5+ downstream features');
  });

  it('distinguishes fully-ready from partially-ready', () => {
    const ready = nbaFactorSegments(makeRec({ readiness: NBA_FACTOR_WEIGHTS.readiness }));
    expect(ready[0].plain).toBe('All dependencies satisfied — ready now');
    const partial = nbaFactorSegments(makeRec({ readiness: 5 }));
    expect(partial[0].plain).toBe('Most dependencies satisfied');
  });
});

describe('nbaSuccessOdds', () => {
  it('refuses to produce a percentage when nothing evidences one', () => {
    const odds = nbaSuccessOdds(makeRec({ urgency: 18 }, {
      successProbability: null,
      successEvidence: {
        source: 'none', runs: 0, successes: 0,
        note: 'No recorded runs for this module yet — success odds not scored',
      },
    }));
    expect(odds.pct).toBeNull();
    expect(odds.scored).toBe(false);
    expect(odds.note).toContain('No recorded runs');
  });

  it('still carries a sentence when the segment was dropped for scoring zero', () => {
    // The bar filters out zero-point factors, so a card that read only segments
    // would fall silent exactly where the honest statement is needed.
    const rec = makeRec({ urgency: 18 }, {
      successProbability: null,
      successEvidence: {
        source: 'none', runs: 0, successes: 0,
        note: 'No recorded runs for this module yet — success odds not scored',
      },
    });
    expect(nbaFactorSegments(rec).find((s) => s.key === 'successProb')).toBeUndefined();
    expect(nbaSuccessOdds(rec).note).not.toBe('');
  });

  it('rounds an evidenced probability to a whole percent', () => {
    const odds = nbaSuccessOdds(makeRec({ successProb: 8 }, { successProbability: 2 / 3 }));
    expect(odds.pct).toBe(67);
    expect(odds.scored).toBe(true);
  });
});

describe('nbaBreakdownAriaLabel', () => {
  it('summarises score and every non-zero factor for screen readers', () => {
    const label = nbaBreakdownAriaLabel(makeRec({ urgency: 18, impact: 12 }));
    expect(label).toContain('score 30 of 100');
    expect(label).toContain('Urgency 18 of 30');
    expect(label).toContain('Impact 12 of 20');
    expect(label).toContain('Unblocks 3 downstream features');
  });
});
