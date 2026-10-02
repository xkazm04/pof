/**
 * The browser's seed copy follows the code (scan-sweep --challenge challenge-2026-09-30b,
 * catalog-seed-data/A). The `pof-catalog` blob used to let EVERY persisted entity win over the
 * code seed with the same id forever, so a seed correction never reached a returning browser.
 * `planSeedMerge` classifies each persisted row against the hash of the seed it was written
 * from: an untouched copy follows the code, an edit is kept and (only when the code moved too)
 * asks. Pure — no store, no storage.
 */
import { describe, it, expect } from 'vitest';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { planSeedMerge, seedContentHash, seedKey, persistableSeedState } from '@/lib/catalog/seedSync';
import type { CatalogEntityBase } from '@/lib/catalog/types';

type ByCatalog = Record<string, Record<string, CatalogEntityBase>>;

const code: ByCatalog = seedAllCatalogs();
const GRUNT = 'bestiary-melee-grunt';
const LOOT_LINK = { catalogId: 'loot-tables', entityId: 'lt-MeleeGrunt' };

/** The 5-link-era copy: the grunt as a browser that first loaded before d879a109 stored it. */
function staleGrunt(): CatalogEntityBase {
  const cur = code.bestiary[GRUNT];
  return { ...cur, links: (cur.links ?? []).filter((l) => l.catalogId !== 'loot-tables') };
}

describe('planSeedMerge — an untouched copy follows the code, an edit is kept', () => {
  it('follows: an untouched stale copy takes the code seed (the loot link the server cites)', () => {
    const mine = staleGrunt();
    expect(mine.links).not.toContainEqual(expect.objectContaining(LOOT_LINK));
    const plan = planSeedMerge(code, { bestiary: { [GRUNT]: mine } }, { [seedKey('bestiary', GRUNT)]: seedContentHash(mine) });

    expect(plan.entities.bestiary[GRUNT].links).toContainEqual(expect.objectContaining(LOOT_LINK));
    expect(plan.entries).toContainEqual({ catalogId: 'bestiary', entityId: GRUNT, verdict: 'follow' });
    expect(plan.findings).toEqual([]);
    expect(plan.recorded[seedKey('bestiary', GRUNT)]).toBe(seedContentHash(code.bestiary[GRUNT]));
  });

  it('follows the code content but keeps the server overlays (excluded from the content hash)', () => {
    const plain = staleGrunt();
    const mine: CatalogEntityBase = {
      ...plain, lifecycle: 'verified', ueAssets: ['/Game/Enemies/BP_MeleeGrunt'], lastVerifiedAt: '2026-09-29T10:00:00Z',
    };
    expect(seedContentHash(mine)).toBe(seedContentHash(plain));
    const plan = planSeedMerge(code, { bestiary: { [GRUNT]: mine } }, { [seedKey('bestiary', GRUNT)]: seedContentHash(plain) });
    const merged = plan.entities.bestiary[GRUNT];

    expect(merged.links).toContainEqual(expect.objectContaining(LOOT_LINK));
    expect(merged.lifecycle).toBe('verified');
    expect(merged.ueAssets).toEqual(['/Game/Enemies/BP_MeleeGrunt']);
    expect(merged.lastVerifiedAt).toBe('2026-09-29T10:00:00Z');
  });

  it('edited: content moved from its recorded offer while the code did not -> kept verbatim, no finding', () => {
    const shipped = code.items['item-1'];
    const mine = { ...shipped, name: 'My sword' };
    const plan = planSeedMerge(code, { items: { 'item-1': mine } }, { [seedKey('items', 'item-1')]: seedContentHash(shipped) });

    expect(plan.entities.items['item-1']).toBe(mine);
    expect(plan.entries).toContainEqual({ catalogId: 'items', entityId: 'item-1', verdict: 'edited' });
    expect(plan.findings).toEqual([]);
  });

  it('conflict: an edited copy AND a code seed that moved since the recorded offer -> kept, asks', () => {
    const shipped = code.bestiary[GRUNT];
    const recorded = seedContentHash(staleGrunt());
    const mine = { ...staleGrunt(), name: 'Grunt, renamed here' };
    const plan = planSeedMerge(code, { bestiary: { [GRUNT]: mine } }, { [seedKey('bestiary', GRUNT)]: recorded });

    expect(seedContentHash(shipped)).not.toBe(recorded);
    expect(plan.entities.bestiary[GRUNT]).toBe(mine);
    expect(plan.findings).toEqual([expect.objectContaining({ catalogId: 'bestiary', entityId: GRUNT, verdict: 'conflict' })]);
  });

  it('orphaned: an untouched copy of a seed the code no longer ships is removed and reported; a local row is kept', () => {
    const retired: CatalogEntityBase = { id: 'bestiary-retired', catalogId: 'bestiary', name: 'Retired', categoryPath: [], tags: [], lifecycle: 'planned' };
    const dagger: CatalogEntityBase = { id: 'item-user-dagger-k3', catalogId: 'items', name: 'Dagger', categoryPath: [], tags: [], lifecycle: 'planned' };
    const plan = planSeedMerge(
      code,
      { bestiary: { 'bestiary-retired': retired }, items: { 'item-user-dagger-k3': dagger } },
      { [seedKey('bestiary', 'bestiary-retired')]: seedContentHash(retired) },
    );

    expect(plan.entities.bestiary['bestiary-retired']).toBeUndefined();
    expect(plan.findings).toEqual([expect.objectContaining({ catalogId: 'bestiary', entityId: 'bestiary-retired', verdict: 'orphaned' })]);
    expect(plan.entities.items['item-user-dagger-k3']).toBe(dagger);
    expect(plan.entries).toContainEqual({ catalogId: 'items', entityId: 'item-user-dagger-k3', verdict: 'local' });
  });

  it('unrecorded: a legacy row (no recorded offer) that differs from the code is kept and asks, never overwritten', () => {
    const mine = { ...code.items['item-1'], name: 'Renamed locally' };
    const plan = planSeedMerge(code, { items: { 'item-1': mine } }, {});
    expect(plan.entities.items['item-1'].name).toBe('Renamed locally');
    expect(plan.findings).toEqual([expect.objectContaining({ catalogId: 'items', entityId: 'item-1', verdict: 'unrecorded' })]);
  });
});

describe('persistableSeedState — pristine seeds are not mirrored', () => {
  it('a pristine store persists 0 entities; an overlaid one persists with the hash of the seed it was written against', () => {
    expect(persistableSeedState(seedAllCatalogs(), code, {}).entitiesByCatalog).toEqual({});

    const state = seedAllCatalogs();
    state.bestiary[GRUNT] = { ...state.bestiary[GRUNT], lifecycle: 'verified' };
    const out = persistableSeedState(state, code, {});
    expect(Object.keys(out.entitiesByCatalog)).toEqual(['bestiary']);
    expect(Object.keys(out.entitiesByCatalog.bestiary)).toEqual([GRUNT]);
    expect(out.seedHashes[seedKey('bestiary', GRUNT)]).toBe(seedContentHash(code.bestiary[GRUNT]));
  });
});
