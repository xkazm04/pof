import { describe, it, expect, beforeEach } from 'vitest';
import { useBaselineStore, baselineKey } from '@/stores/baselineStore';
import type { BalanceBaseline } from '@/lib/balance/baseline';

const rec: BalanceBaseline = {
  catalogId: 'bestiary', entityId: 'brute', threatScore: 85,
  stats: [{ label: 'Health', value: 200 }], capturedAt: '2026-05-25T00:00:00.000Z',
};

describe('baselineStore', () => {
  beforeEach(() => useBaselineStore.setState({ baselineByEntity: {} }));

  it('baselineKey composes catalog + entity', () => {
    expect(baselineKey('bestiary', 'brute')).toBe('bestiary/brute');
  });

  it('loadBaseline stores a record and getBaseline reads it', () => {
    useBaselineStore.getState().loadBaseline('bestiary', 'brute', rec);
    expect(useBaselineStore.getState().getBaseline('bestiary', 'brute')).toEqual(rec);
  });

  it('loadBaseline(null) records "loaded, none found" (distinct from unloaded undefined)', () => {
    useBaselineStore.getState().loadBaseline('bestiary', 'ghost', null);
    expect(useBaselineStore.getState().getBaseline('bestiary', 'ghost')).toBeNull();
  });

  it('getBaseline returns undefined when never loaded', () => {
    expect(useBaselineStore.getState().getBaseline('bestiary', 'never')).toBeUndefined();
  });

  it('setBaseline overwrites the stored record', () => {
    useBaselineStore.getState().loadBaseline('bestiary', 'brute', rec);
    const next = { ...rec, threatScore: 120 };
    useBaselineStore.getState().setBaseline('bestiary', 'brute', next);
    expect(useBaselineStore.getState().getBaseline('bestiary', 'brute')?.threatScore).toBe(120);
  });
});
