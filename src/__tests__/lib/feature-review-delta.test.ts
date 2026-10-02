/**
 * A review says what it moved. `diffFeatureStates` compares the per-feature
 * states two consecutive review snapshots recorded; `deriveReviewDelta` refuses
 * to diff when either side predates per-feature capture (measured:false with a
 * reason — never an empty diff that reads as "nothing changed").
 */
import { describe, it, expect } from 'vitest';
import {
  diffFeatureStates,
  deriveReviewDelta,
  summarizeDelta,
  deltaToastType,
  changedFeatureNames,
  parseFeatureStates,
  type FeatureStateEntry,
} from '@/lib/feature-review-delta';

const e = (featureName: string, status: FeatureStateEntry['status'], quality: number | null = null): FeatureStateEntry => ({
  featureName, status, quality,
});

describe('diffFeatureStates', () => {
  it('implemented -> partial is a regression, not an improvement', () => {
    const d = diffFeatureStates([e('Dodge roll', 'implemented', 4)], [e('Dodge roll', 'partial', 3)]);
    expect(d.regressed).toEqual([{ featureName: 'Dodge roll', from: 'implemented', to: 'partial' }]);
    expect(d.improved).toEqual([]);
  });

  it('same status, quality 4 -> 2 lands in qualityDropped and not in regressed', () => {
    const d = diffFeatureStates([e('Dodge roll', 'implemented', 4)], [e('Dodge roll', 'implemented', 2)]);
    expect(d.qualityDropped).toEqual([{ featureName: 'Dodge roll', from: 4, to: 2 }]);
    expect(d.regressed).toEqual([]);
  });

  it('unknown -> implemented is assessed (never improved); missing -> partial is improved; added/removed by name', () => {
    const d = diffFeatureStates(
      [e('A', 'unknown'), e('B', 'missing'), e('Gone', 'partial')],
      [e('A', 'implemented'), e('B', 'partial'), e('New', 'missing')],
    );
    expect(d.assessed).toEqual([{ featureName: 'A', from: 'unknown', to: 'implemented' }]);
    expect(d.improved).toEqual([{ featureName: 'B', from: 'missing', to: 'partial' }]);
    expect(d.improved.map((m) => m.featureName)).not.toContain('A');
    expect(d.removed.map((x) => x.featureName)).toEqual(['Gone']);
    expect(d.added.map((x) => x.featureName)).toEqual(['New']);
  });

  it('a verdict that falls back to unknown is cleared, never a measured regression', () => {
    const d = diffFeatureStates([e('A', 'implemented')], [e('A', 'unknown')]);
    expect(d.cleared).toEqual([{ featureName: 'A', from: 'implemented', to: 'unknown' }]);
    expect(d.regressed).toEqual([]);
  });

  it('a quality that appears or disappears is not a measured quality move', () => {
    const d = diffFeatureStates([e('A', 'partial', null), e('B', 'partial', 3)], [e('A', 'partial', 2), e('B', 'partial', null)]);
    expect(d.qualityDropped).toEqual([]);
    expect(d.qualityRaised).toEqual([]);
  });
});

describe('deriveReviewDelta', () => {
  const at1 = '2026-09-01T00:00:00.000Z';
  const at2 = '2026-09-02T00:00:00.000Z';

  it('measured pair carries both timestamps and the diff', () => {
    const delta = deriveReviewDelta(
      { reviewedAt: at1, featureStates: [e('Dodge roll', 'implemented', 4)] },
      { reviewedAt: at2, featureStates: [e('Dodge roll', 'partial', 3)] },
    );
    expect(delta.measured).toBe(true);
    if (!delta.measured) return;
    expect(delta.fromReviewedAt).toBe(at1);
    expect(delta.toReviewedAt).toBe(at2);
    expect(delta.regressed).toHaveLength(1);
  });

  it('a predecessor without per-feature states is measured:false with a reason, never an empty diff', () => {
    const delta = deriveReviewDelta(
      { reviewedAt: at1, featureStates: null },
      { reviewedAt: at2, featureStates: [e('Dodge roll', 'partial', 3)] },
    );
    expect(delta.measured).toBe(false);
    expect(delta).not.toHaveProperty('regressed');
    if (delta.measured) return;
    expect(delta.reason).toMatch(/predates/i);
    expect(delta.fromReviewedAt).toBe(at1);
  });

  it('fewer than two snapshots is measured:false', () => {
    expect(deriveReviewDelta(undefined, undefined).measured).toBe(false);
    expect(deriveReviewDelta(undefined, { reviewedAt: at2, featureStates: [] }).measured).toBe(false);
  });
});

describe('summary + helpers', () => {
  const delta = deriveReviewDelta(
    { reviewedAt: 'a', featureStates: [e('Dodge roll', 'implemented', 4), e('Parry', 'missing')] },
    { reviewedAt: 'b', featureStates: [e('Dodge roll', 'partial', 4), e('Parry', 'missing')] },
  );

  it('summarizes as "<n> regressed, <n> improved" and warns on a regression', () => {
    expect(summarizeDelta(delta)).toContain('1 regressed, 0 improved');
    expect(deltaToastType(delta)).toBe('warning');
  });

  it('changedFeatureNames lists only the moved features', () => {
    expect([...changedFeatureNames(delta)]).toEqual(['Dodge roll']);
  });

  it('parseFeatureStates: NULL and corrupt JSON are unknown (null), not an empty list', () => {
    expect(parseFeatureStates(null)).toBeNull();
    expect(parseFeatureStates('{oops')).toBeNull();
    expect(parseFeatureStates('[]')).toEqual([]);
  });
});
