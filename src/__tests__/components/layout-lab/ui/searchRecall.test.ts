import { describe, it, expect } from 'vitest';
import { pushRecent, resolveRecents, rankByRecall } from '@/components/layout-lab/ui/searchRecall';

/**
 * Pure half of SearchCombobox recall: the recents list (move-to-front, never duplicated,
 * capped), its re-resolution against the LIVE index (a dead destination never renders),
 * and the history tie-break that reorders the matched set without ever adding to it.
 */

describe('pushRecent — move-to-front, never duplicated, capped', () => {
  it('a re-pick moves to the front and is never duplicated; the first pick starts the list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c', 6)).toEqual(['c', 'a', 'b']);
    expect(pushRecent([], 'a', 6)).toEqual(['a']);
  });

  it('at the cap the newest goes first and the oldest drops', () => {
    const next = pushRecent(['k1', 'k2', 'k3', 'k4', 'k5', 'k6'], 'k7', 6);
    expect(next).toHaveLength(6);
    expect(next[0]).toBe('k7');
    expect(next).not.toContain('k6');
  });
});

describe('resolveRecents — only what the live index can still resolve', () => {
  it('a destination that no longer exists never renders as a dead row', () => {
    const hit = { key: 'c:items', label: 'Items', payload: null };
    const index = new Map([[hit.key, hit]]);
    expect(resolveRecents(['e:items:gone', 'c:items'], (k) => index.get(k) ?? null)).toEqual([hit]);
  });
});

describe('rankByRecall — history breaks ties inside the matched set, never overrides matching', () => {
  const h = (key: string) => ({ key });

  it('a recent match moves first; the rest keep the caller order', () => {
    expect(rankByRecall([h('p'), h('q'), h('r')], ['r']).map((x) => x.key)).toEqual(['r', 'p', 'q']);
  });

  it('a recent that does not match is NOT added', () => {
    expect(rankByRecall([h('p'), h('q')], ['zz', 'q']).map((x) => x.key)).toEqual(['q', 'p']);
  });

  it('several recents keep their recency order', () => {
    expect(rankByRecall([h('a'), h('b'), h('c'), h('d')], ['d', 'b']).map((x) => x.key)).toEqual(['d', 'b', 'a', 'c']);
  });
});
