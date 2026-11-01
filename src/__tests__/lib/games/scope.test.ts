/**
 * Active-game scoping (spark gtai-uprising-project, WP2). Pinned against a TEST manifest for
 * gtai so the rules hold whatever the real manifest says: pof scopes to exactly what it is
 * given; gtai keeps only its manifest (registered order), reveals the rest under showAll, and
 * keeps only its own entities; readiness with nothing measured is "unmeasured", never R0.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/games/gtai', () => ({
  GTAI_OMITTED: [],
  GTAI_GAME: {
    id: 'gtai',
    title: 'GTAI: Uprising',
    canonProfiles: ['gtai'],
    manifest: [
      { catalogId: 'quests', fit: 'reskin', note: 'quests -> hitman contracts' },
      { catalogId: 'vfx', fit: 'reuse', expected: 4 },
      { catalogId: 'ghost-pipeline', fit: 'reuse' },
      { catalogId: 'vehicles', fit: 'planned', note: 'stealable cars' },
    ],
    engine: { kind: 'undecided' },
    designDir: 'games/gtai',
  },
}));

import {
  bestReadiness, coverageText, engineStateOf, entitiesInGame, entityInGame, gameOfEntitySafe,
  gamePipelineRows, rowsInGame, scopeCatalogIds, statusEntitiesForGame, type ProfiledEntity,
} from '@/lib/games/scope';

const REGISTERED = ['items', 'vfx', 'quests', 'affixes'];
type TestEntity = ProfiledEntity & { id: string; name: string };
const seed = (id: string): TestEntity => ({ id, name: id });
const authored = (id: string, canonProfile: string): TestEntity => ({ id, name: id, provenance: { canonProfile } });

describe('scopeCatalogIds', () => {
  it('pof (manifest all) scopes to exactly the registered list, same order, nothing off-manifest', () => {
    const s = scopeCatalogIds('pof', REGISTERED, false);
    expect(s.visible).toEqual(REGISTERED);
    expect(s.offManifest.size).toBe(0);
    expect(s.planned).toEqual([]);
    expect(scopeCatalogIds('pof', REGISTERED, true).visible).toEqual(REGISTERED);
  });

  it('gtai keeps only registered manifest catalogs, in REGISTERED order; planned/unregistered never show', () => {
    const s = scopeCatalogIds('gtai', REGISTERED, false);
    expect(s.visible).toEqual(['vfx', 'quests']);
    expect(s.offManifest.size).toBe(0);
    expect(s.planned.map((p) => p.catalogId)).toEqual(['vehicles']);
  });

  it('showAll reveals the off-manifest catalogs and marks them', () => {
    const s = scopeCatalogIds('gtai', REGISTERED, true);
    expect(s.visible).toEqual(REGISTERED);
    expect([...s.offManifest].sort()).toEqual(['affixes', 'items']);
  });
});

describe('entity game', () => {
  it('code seeds, diablo1 ingests and pof-authored are pof; gtai-authored is gtai', () => {
    expect(gameOfEntitySafe(seed('a'))).toBe('pof');
    expect(gameOfEntitySafe(authored('b', 'diablo1'))).toBe('pof');
    expect(gameOfEntitySafe(authored('c', 'gtai'))).toBe('gtai');
    expect(gameOfEntitySafe({ canonProfile: 'gtai' })).toBe('gtai'); // a LabEntity
    expect(entityInGame(undefined, 'pof')).toBe(true);
  });

  it('an unmapped profile is in NO game (not silently PoF) and does not throw', () => {
    expect(gameOfEntitySafe(authored('x', 'no-such-profile'))).toBeNull();
    expect(entityInGame(authored('x', 'no-such-profile'), 'pof')).toBe(false);
    expect(entityInGame(authored('x', 'no-such-profile'), 'gtai')).toBe(false);
  });

  it('entitiesInGame filters per catalog and keeps the inner object when nothing was filtered', () => {
    const items = { a: seed('a'), b: seed('b') };
    const mixed = { c: seed('c'), d: authored('d', 'gtai') };
    const pof = entitiesInGame({ items, mixed }, 'pof');
    expect(pof.items).toBe(items);
    expect(Object.keys(pof.mixed)).toEqual(['c']);
    expect(entitiesInGame({ items, mixed }, 'gtai')).toEqual({ mixed: { d: mixed.d } });
  });

  it('statusEntitiesForGame: pof is EXACTLY the seed map; gtai is its seeds + persisted rows', () => {
    const seeds = { items: { a: seed('a') } };
    const persisted = { quests: { 'gtai-q1': authored('gtai-q1', 'gtai'), p: authored('p', 'pof') } };
    expect(statusEntitiesForGame('pof', seeds, persisted)).toBe(seeds);
    expect(statusEntitiesForGame('gtai', seeds, persisted)).toEqual({ quests: { 'gtai-q1': persisted.quests['gtai-q1'] } });
  });

  it('rowsInGame: an artifact inherits its entity game; an unknown entity reads as pof', () => {
    const rows = [{ entityId: 'seed-1' }, { entityId: 'gtai-q1' }, { entityId: 'gone' }];
    const lookup = (id: string) => (id === 'gtai-q1' ? authored(id, 'gtai') : id === 'seed-1' ? seed(id) : undefined);
    expect(rowsInGame(rows, 'pof', lookup).map((r) => r.entityId)).toEqual(['seed-1', 'gone']);
    expect(rowsInGame(rows, 'gtai', lookup).map((r) => r.entityId)).toEqual(['gtai-q1']);
  });
});

describe('Game home model', () => {
  it('gtai rows: built manifest pipelines first (manifest order), then planned; counts are this game only', () => {
    const entities = { quests: { 'gtai-q1': authored('gtai-q1', 'gtai'), s: seed('s') }, vfx: {} };
    const rows = gamePipelineRows('gtai', REGISTERED, entities);
    expect(rows.map((r) => [r.catalogId, r.fit, r.registered, r.count])).toEqual([
      ['quests', 'reskin', true, 1],
      ['vfx', 'reuse', true, 0],
      ['ghost-pipeline', 'reuse', false, 0],
      ['vehicles', 'planned', false, 0],
    ]);
    expect(rows[0].note).toBe('quests -> hitman contracts');
    expect(rows[1].expected).toBe(4);
    expect('expected' in rows[0]).toBe(false); // absent = no target declared, never 0
  });

  it('pof rows: every registered pipeline, fit "all"', () => {
    const rows = gamePipelineRows('pof', REGISTERED, { items: { a: seed('a') } });
    expect(rows.map((r) => r.catalogId)).toEqual(REGISTERED);
    expect(rows.every((r) => r.fit === 'all')).toBe(true);
    expect(rows[0].count).toBe(1);
  });

  it('coverage text names a missing target instead of inventing one', () => {
    expect(coverageText({ count: 3, expected: 10 })).toBe('3 / 10');
    expect(coverageText({ count: 3 })).toBe('3 · no target declared');
  });

  it('readiness: unmeasured (never R0) with no rows or nothing reached above R0; else the best reached rung', () => {
    expect(bestReadiness(0, [])).toBe('unmeasured');
    expect(bestReadiness(2, [{ level: 'R0', state: 'reached' }])).toBe('unmeasured');
    expect(bestReadiness(3, [
      { level: 'R2', state: 'reached' },
      { level: 'R4', state: 'waiting' },
      { level: 'R3', state: 'blocked' },
      { level: 'R1', state: 'reached' },
    ])).toBe('R2');
  });

  it('engine state: gtai undecided; pof the project default; a root binds; null elsewhere is unbound', () => {
    expect(engineStateOf({ id: 'gtai', engine: { kind: 'undecided' } })).toEqual({ kind: 'undecided' });
    expect(engineStateOf({ id: 'pof', engine: { kind: 'ue5', root: null } })).toEqual({ kind: 'project-default' });
    expect(engineStateOf({ id: 'gtai', engine: { kind: 'ue5', root: null } })).toEqual({ kind: 'unbound' });
    expect(engineStateOf({ id: 'gtai', engine: { kind: 'ue5', root: 'D:/GTAI' } })).toEqual({ kind: 'bound', root: 'D:/GTAI' });
  });
});
