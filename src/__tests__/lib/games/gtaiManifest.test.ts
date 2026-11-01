/**
 * GTAI's pipeline manifest (WP1 criterion 2): every registered pipeline is in the manifest or
 * deliberately omitted in `GTAI_OMITTED` — a new pipeline that is neither fails here, so it cannot
 * silently vanish from (or silently appear on) GTAI's board. Plus the gtai canon inheritance:
 * engineering conventions only, never design or balance law.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { GTAI_GAME, GTAI_OMITTED } from '@/lib/games/gtai';
import { catalogsForGame } from '@/lib/games/registry';
import type { ManifestEntry } from '@/lib/games/types';
import { CANON_PROFILES } from '@/lib/catalog/canon/profiles';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const registered = allCatalogPipelines().map((p) => p.catalogId);
const manifest = GTAI_GAME.manifest as readonly ManifestEntry[];
const PLANNED = ['vehicles', 'wanted-heat', 'traffic', 'city-blocks', 'contracts', 'radio', 'firearms', 'top-down-camera', 'garages'];
const sorted = (xs: readonly string[]) => [...xs].sort();

describe('GTAI manifest', () => {
  it('is an explicit list, not "all"', () => {
    expect(Array.isArray(GTAI_GAME.manifest)).toBe(true);
    expect(registered.length).toBeGreaterThan(0);
  });

  it('accounts for every registered pipeline: in the manifest or in GTAI_OMITTED', () => {
    const inManifest = new Set(manifest.map((e) => e.catalogId));
    const omitted = new Set(GTAI_OMITTED.map((o) => o.catalogId));
    const unaccounted = registered.filter((c) => !inManifest.has(c) && !omitted.has(c));
    expect(unaccounted, `pipelines neither in the GTAI manifest nor in GTAI_OMITTED: ${unaccounted.join(', ')}`).toEqual([]);
  });

  it('never lists a pipeline both as used and omitted, and has no duplicates', () => {
    const ids = manifest.map((e) => e.catalogId);
    expect(new Set(ids).size).toBe(ids.length);
    const omitted = GTAI_OMITTED.map((o) => o.catalogId);
    expect(ids.filter((c) => omitted.includes(c))).toEqual([]);
  });

  it('omits exactly the ARPG-only pipelines, each with a reason', () => {
    expect(sorted(GTAI_OMITTED.map((o) => o.catalogId))).toEqual(['affixes', 'codex', 'crafting-recipes', 'items', 'loot-tables']);
    for (const o of GTAI_OMITTED) {
      expect(o.reason.length, o.catalogId).toBeGreaterThan(10);
      expect(registered, `omitted ${o.catalogId} is not registered`).toContain(o.catalogId);
    }
  });

  it('every reuse/reskin entry is a registered pipeline; every reskin carries a note', () => {
    for (const e of manifest.filter((m) => m.fit !== 'planned')) {
      expect(registered, `${e.catalogId} (${e.fit}) is not registered`).toContain(e.catalogId);
      if (e.fit === 'reskin') expect(e.note, `${e.catalogId} reskin has no note`).toBeTruthy();
    }
  });

  it('lists the 9 planned genre pipelines, with notes, none of them already registered', () => {
    const planned = manifest.filter((e) => e.fit === 'planned');
    expect(sorted(planned.map((e) => e.catalogId))).toEqual(sorted(PLANNED));
    for (const e of planned) {
      expect(e.note, e.catalogId).toBeTruthy();
      expect(registered).not.toContain(e.catalogId);
    }
  });

  it('declares no expected counts yet (absent = no target declared)', () => {
    expect(manifest.filter((e) => 'expected' in e)).toEqual([]);
  });

  it('catalogsForGame("gtai") returns the planned pipelines as planned and the omitted ones off-manifest', () => {
    const split = catalogsForGame('gtai', registered);
    expect(sorted(split.planned.map((e) => e.catalogId))).toEqual(sorted(PLANNED));
    expect(split.planned.every((e) => e.fit === 'planned')).toBe(true);
    expect(sorted(split.offManifest)).toEqual(sorted(GTAI_OMITTED.map((o) => o.catalogId)));
    expect(split.inManifest).toHaveLength(registered.length - GTAI_OMITTED.length);
    for (const p of PLANNED) expect(split.inManifest).not.toContain(p);
  });

  it('pof keeps every registered pipeline in registration order (the existing view)', () => {
    expect(catalogsForGame('pof', registered)).toEqual({ inManifest: registered, offManifest: [], planned: [] });
  });
});

describe('gtai canon inheritance', () => {
  const seedById = new Map(CANON_SEED.map((r) => [r.id, r]));
  const inherits = CANON_PROFILES.gtai.inheritsPof;

  it('inherits only existing PoF `project` (engineering) rules', () => {
    expect(inherits.length).toBeGreaterThan(0);
    for (const id of inherits) {
      expect(seedById.get(id), `${id} is not a PoF seed rule`).toBeDefined();
      expect(seedById.get(id)?.category, id).toBe('project');
    }
  });

  it('inherits no balance or economy law and no rule scoped to an omitted pipeline', () => {
    for (const id of ['proj-balance', 'proj-economy', 'vendor-laws', 'repair-value-scaled', 'arpg-affix-is-ge']) {
      expect(inherits).not.toContain(id);
    }
    const omitted = new Set(GTAI_OMITTED.map((o) => o.catalogId));
    for (const id of inherits) expect(omitted.has(seedById.get(id)?.scope ?? ''), id).toBe(false);
  });
});
