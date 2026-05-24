import { describe, it, expect } from 'vitest';
import { montageToEntry, seedAnimationEntries } from '@/lib/catalog/seed-state-graph';
import { ALL_MONTAGES } from '@/components/modules/core-engine/sub_animation/_shared/data';

describe('montageToEntry', () => {
  const m0 = ALL_MONTAGES[0];
  it('prefixes id, keeps name + data', () => {
    const e = montageToEntry(m0);
    expect(e.id).toBe(`anim-${m0.id}`);
    expect(e.name).toBe(m0.name);
    expect(e.data).toBe(m0);
    expect(e.catalogId).toBe('state-graph');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Animations, category] and tags reflect hasRootMotion', () => {
    const e = montageToEntry(m0);
    expect(e.categoryPath).toEqual(['Animations', m0.category]);
    expect(e.tags).toEqual([m0.hasRootMotion ? 'root-motion' : 'in-place']);
  });
});

describe('seedAnimationEntries', () => {
  it('maps every montage with unique ids', () => {
    const entries = seedAnimationEntries();
    expect(entries.length).toBe(ALL_MONTAGES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
