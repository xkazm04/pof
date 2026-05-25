import { describe, it, expect } from 'vitest';
import { buildEntityTree, flattenVisible } from '@/lib/catalog/tree';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function e(id: string, name: string, path: string[]): CatalogEntityBase {
  return { id, catalogId: 'spellbook', name, categoryPath: path, tags: [], lifecycle: 'planned' } as CatalogEntityBase;
}
const entities = [
  e('a', 'Fireball', ['Offensive', 'Fire']),
  e('b', 'Flame Wall', ['Offensive', 'Fire']),
  e('c', 'Gust', ['Offensive', 'Air']),
  e('d', 'Heal', ['Support', 'Restoration']),
];

describe('buildEntityTree + flattenVisible', () => {
  it('produces group rows then entity rows, depth-ordered, all expanded', () => {
    const rows = flattenVisible(buildEntityTree(entities), new Set(), '');
    const offensive = rows.find((r) => r.kind === 'group' && r.label === 'Offensive')!;
    expect(offensive.depth).toBe(0);
    expect(offensive.count).toBe(3);
    const fire = rows.find((r) => r.kind === 'group' && r.label === 'Fire')!;
    expect(fire.depth).toBe(1);
    expect(rows.some((r) => r.kind === 'entity' && r.label === 'Fireball')).toBe(true);
  });
  it('collapsing a group hides its descendants', () => {
    const tree = buildEntityTree(entities);
    const rows = flattenVisible(tree, new Set(['Offensive']), '');
    expect(rows.some((r) => r.label === 'Fire')).toBe(false);
    expect(rows.some((r) => r.label === 'Fireball')).toBe(false);
    expect(rows.some((r) => r.kind === 'group' && r.label === 'Offensive')).toBe(true);
  });
  it('filter prunes to matching entities and keeps their ancestor groups', () => {
    const rows = flattenVisible(buildEntityTree(entities), new Set(), 'gust');
    expect(rows.some((r) => r.label === 'Gust')).toBe(true);
    expect(rows.some((r) => r.label === 'Fireball')).toBe(false);
    expect(rows.some((r) => r.label === 'Air')).toBe(true);
    expect(rows.some((r) => r.label === 'Support')).toBe(false);
  });
});
