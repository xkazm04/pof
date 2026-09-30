// A catalog entity is persisted as `JSON.stringify(entity)` (catalog-db.ts `upsertEntity`).
// Anything in the payload that JSON cannot carry is destroyed there SILENTLY — and the
// worst case is not a dropped key (an `undefined` check would catch that) but a React
// component, which stringifies to `{}` and so survives every `'key' in obj` guard while
// carrying nothing. This names those keys before the write instead of after.
import { describe, it, expect } from 'vitest';
import { Skull } from 'lucide-react';
import { jsonUnsafeKeys } from '@/lib/catalog/entityPayload';

describe('jsonUnsafeKeys', () => {
  it('says nothing about a payload JSON can carry', () => {
    expect(jsonUnsafeKeys({ a: 1, b: 'x', c: [1, 2], d: { e: true }, f: null })).toEqual([]);
  });

  it('names a function-valued key (dropped outright by JSON.stringify)', () => {
    expect(jsonUnsafeKeys({ id: 'x', render: () => null })).toEqual(['render']);
  });

  it('names a lucide icon — the real defect: it survives as {} and fools an `in` check', () => {
    const archetype = { id: 'melee-grunt', label: 'Grunt', icon: Skull, stats: [] };
    const round = JSON.parse(JSON.stringify(archetype));
    // The trap, pinned so nobody "fixes" this by adding a presence check:
    expect('icon' in round).toBe(true);
    expect(round.icon).toEqual({});
    // What the helper is for:
    expect(jsonUnsafeKeys(archetype)).toEqual(['icon']);
  });

  it('reports nested keys by their dotted path, including through arrays', () => {
    expect(jsonUnsafeKeys({ data: { ui: { icon: Skull } } })).toEqual(['data.ui.icon']);
    expect(jsonUnsafeKeys({ rows: [{ ok: 1 }, { bad: Skull }] })).toEqual(['rows.1.bad']);
  });

  it('does not flag an object that is GENUINELY empty', () => {
    // `{}` is a legitimate payload value; only an object with own keys that stringifies
    // to `{}` has actually lost something.
    expect(jsonUnsafeKeys({ btSummary: {} })).toEqual([]);
  });

  it('names a Map/Set, which also collapses to {}', () => {
    expect(jsonUnsafeKeys({ byId: new Map([['a', 1]]) })).toEqual(['byId']);
  });
});
