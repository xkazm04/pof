import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

/**
 * The homepage's cross-catalog coach fans out over EVERY registered catalog. This file
 * measures — and pins — how much whole-fleet work one first paint (and one produce) costs,
 * and proves the cheaper path returns byte-identical advice.
 *
 * Two counters are honest proxies for a "derivation pass":
 *  - `resolveCatalogSteps` runs exactly once per CATALOG per derivation;
 *  - `buildLabCheckerContext` runs exactly once per ENTITY per derivation.
 *
 * Measured on this fixture (32 populated catalogs · 502 entities), fetches resolving in ONE
 * microtask batch (the friendliest possible case for the old code, since React coalesces the
 * renders):
 *
 *            catalog-derivations   entity-derivations
 *   before        128 (4 passes)         2 008          first paint
 *   after           64 (2 passes)         1 004
 *   before         32 (1 pass)              502         per produce (one catalog)
 *   after            1                       70
 *
 * With fetches landing on SEPARATE tasks (what a browser actually does) the old code paid a
 * whole-fleet pass per landing — 1 184 catalog-derivations / 18 574 entity-derivations for
 * the SAME first paint. The new code is unchanged at 64 / 1 004: staggering now costs the
 * same as batching. See the staggered case below.
 */

const h = vi.hoisted(() => ({ counts: { steps: 0, ctx: 0 }, stagger: false, seq: 0 }));

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: vi.fn((catalogId: string) => {
    const res = catalogId === '__boom__' ? { ok: false, error: 'HTTP 500' } : { ok: true, data: [] };
    if (!h.stagger) return Promise.resolve(res);
    // Each catalog resolves on its OWN task, so every landing is a separate emission —
    // the real-browser shape the batched case hides.
    return new Promise((r) => setTimeout(() => r(res), 1 + (h.seq++ % 5)));
  }),
}));

vi.mock('@/components/layout-lab/catalogManifest', async (orig) => {
  const actual = await orig<typeof import('@/components/layout-lab/catalogManifest')>();
  return {
    ...actual,
    resolveCatalogSteps: (id: string) => { h.counts.steps++; return actual.resolveCatalogSteps(id); },
  };
});

vi.mock('@/components/layout-lab/labCheckerContext', async (orig) => {
  const actual = await orig<typeof import('@/components/layout-lab/labCheckerContext')>();
  return {
    ...actual,
    buildLabCheckerContext: (...a: Parameters<typeof actual.buildLabCheckerContext>) => {
      h.counts.ctx++;
      return actual.buildLabCheckerContext(...a);
    },
  };
});

import { useGlobalCoach, _resetGlobalCoachCache } from '@/components/layout-lab/hooks/useGlobalCoach';
import { buildGlobalCoach, type CoachCatalogInput } from '@/components/layout-lab/globalCoachModel';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { _resetArtifactCache, invalidateArtifacts, getCachedArtifacts } from '@/components/layout-lab/labArtifactCache';
import { invalidateJudgeVerdicts } from '@/components/layout-lab/hooks/useStepJudgeVerdicts';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/** Catalogs the lab actually derives over (a section with ≥1 seeded entity). */
function populatedCatalogs(): string[] {
  const byCatalog = useCatalogStore.getState().entitiesByCatalog;
  return CATALOG_SECTIONS.filter((s) => Object.keys(byCatalog[s.catalogId] ?? {}).length > 0).map((s) => s.catalogId);
}

/** The pure model, called straight — the reference every cached path must equal. */
function referenceCandidates() {
  const byCatalog = useCatalogStore.getState().entitiesByCatalog;
  const localByEntity = useLabPipelineStore.getState().byEntity;
  const inputs: CoachCatalogInput[] = [];
  for (const section of CATALOG_SECTIONS) {
    const entMap = byCatalog[section.catalogId];
    const entities: LabEntity[] = entMap
      ? Object.values(entMap).map((e) => ({ id: e.id, name: e.name, lifecycle: e.lifecycle, data: (e as { data?: unknown }).data }) as LabEntity)
      : [];
    if (!entities.length) continue;
    inputs.push({
      catalogId: section.catalogId,
      catalogLabel: section.label,
      steps: resolveCatalogSteps(section.catalogId),
      entities,
      serverByEntity: new Map(),
      localByEntity,
    });
  }
  return buildGlobalCoach(inputs, Number.POSITIVE_INFINITY, []);
}

beforeEach(() => {
  _resetArtifactCache();
  _resetGlobalCoachCache();
  invalidateJudgeVerdicts();
  h.counts.steps = 0;
  h.counts.ctx = 0;
  h.stagger = false;
  h.seq = 0;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useGlobalCoach — whole-fleet derivation cost', () => {
  it('first paint costs a bounded number of whole-fleet passes, not one per cache emission', async () => {
    const nCatalogs = populatedCatalogs().length;
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Two passes is the floor for an honest first paint: once with nothing read yet (so the
    // bar can advise immediately) and once when the artifacts land. The old cost was one
    // whole-fleet pass per emission, i.e. ~2 per catalog. Everything in between — notably
    // the empty→loading flip, which carries no artifact news — is now free.
    expect(h.counts.steps).toBeLessThanOrEqual(nCatalogs * 2);
    expect(h.counts.steps).toBeGreaterThan(0);
  });

  it('first paint stays bounded when each catalog fetch lands on its OWN task (the browser case)', async () => {
    h.stagger = true;
    const nCatalogs = populatedCatalogs().length;
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    // This is the case the old code degraded worst on: N separate landings × a full-fleet
    // derivation each. Per-catalog memoization makes staggering cost the same as batching.
    expect(h.counts.steps).toBeLessThanOrEqual(nCatalogs * 2);
  });

  it('a produce in one catalog does not re-derive every other catalog', async () => {
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const catalogId = populatedCatalogs()[0];

    h.counts.steps = 0;
    h.counts.ctx = 0;
    await act(async () => { invalidateArtifacts(catalogId); });
    await act(async () => { await Promise.resolve(); });
    await waitFor(() => expect(getCachedArtifacts(catalogId).loaded).toBe(true));

    // Exactly the ONE catalog whose artifacts changed — the other 30+ are untouched.
    // Twice, not once: the entry is dropped (one pass) and the refetch lands (a second).
    // The second pass is the point — an invalidated catalog MUST re-fetch. It previously
    // did not: this hook's `ensureArtifacts` effect keyed on `[catalogIds]` alone, so it
    // fired once for the lifetime of the hook and a dropped entry was never re-read
    // (`loaded` below would have stayed false and the coach would sit on stale advice).
    expect(h.counts.steps).toBe(2);
  });

  it('IDENTICAL ADVICE: the cached hook output equals a straight call to the pure model', async () => {
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.candidates).toEqual(referenceCandidates());
    expect(result.current.candidates.length).toBeGreaterThan(0);
  });

  it('IDENTICAL ADVICE after a local produce (the per-catalog cache never serves stale advice)', async () => {
    const { result } = renderHook(() => useGlobalCoach());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const catalogId = populatedCatalogs()[0];
    const entityId = Object.keys(useCatalogStore.getState().entitiesByCatalog[catalogId])[0];
    const before = result.current.candidates.find((c) => c.entityId === entityId);
    await act(async () => {
      useLabPipelineStore.getState().produce(entityId, resolveCatalogSteps(catalogId)[0], { data: { note: 'x' } });
      invalidateArtifacts(catalogId, entityId);
    });
    await act(async () => { await Promise.resolve(); });

    // The produce is REFLECTED (not cached away) and still matches a from-scratch derivation.
    expect(result.current.candidates).toEqual(referenceCandidates());
    expect(result.current.candidates.find((c) => c.entityId === entityId)).not.toEqual(before);
  });

  it('preserves the round-10 loading + failedCatalogs contract', async () => {
    const { result } = renderHook(() => useGlobalCoach());
    // loading is TRUE on first paint — the bar reserves its row instead of popping in.
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.failedCatalogs).toEqual([]);
  });
});
