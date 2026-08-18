/**
 * Catalog-wide refresh — the whole-board twin of the per-entity one.
 *
 * The per-entity refresh could only ever reconcile the OPEN entity, so another session's
 * commit, a headless drain or an MCP write stayed invisible on the Matrix until a hard
 * reload. These cases hold the two properties that make a whole-catalog reconcile safe:
 * a server-side change to a NON-open entity lands, and local-only work survives it — and is
 * reported rather than quietly kept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

const fetchArtifactsResult = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifactsResult: (...a: unknown[]) => fetchArtifactsResult(...a),
  fetchStepSummaryResult: () => Promise.resolve({ ok: true, data: [] }),
}));

import { refreshCatalogFromServer, describeCatalogRefresh } from '@/components/layout-lab/labCatalogRefresh';
import { useLabPipelineStore, SERVER_MISSING_REASON, type LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache, ensureSummary, getCachedSummary } from '@/components/layout-lab/labArtifactCache';

const OLD = '2026-08-17T09:00:00.000Z';
const NEW = '2026-08-17T12:00:00.000Z';

const serverRow = (entityId: string, step: string, over: Partial<PipelineArtifact> = {}): PipelineArtifact => ({
  catalogId: 'cat', entityId, step, data: { body: 'server' }, ueAssets: [],
  status: 'pass', tier: 'L0', updatedAt: NEW, ...over,
});

/** A local artifact that CAME from the server (provably server-derived, safely reconcilable). */
const derived = (over: Partial<LabStepArtifact> = {}): LabStepArtifact =>
  ({ done: true, data: { body: 'stale' }, ueAssets: [], at: OLD, serverSeen: OLD, status: 'pass', tier: 'L0', ...over });

/** A local artifact the server has never seen — work that exists only in this browser. */
const localOnly = (): LabStepArtifact => ({ done: true, data: { body: 'mine' }, ueAssets: [], at: NEW });

const ENTITIES = [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }];

/** Let the summary fetch settle (the cache resolves it on a microtask). */
const waitForSummary = async (catalogId: string) => {
  for (let i = 0; i < 10 && !getCachedSummary(catalogId).loaded; i++) await Promise.resolve();
};

beforeEach(() => {
  _resetArtifactCache();
  fetchArtifactsResult.mockReset();
  useLabPipelineStore.setState({ byEntity: {} });
});

describe('refreshCatalogFromServer', () => {
  it('adopts a server-side change to a NON-open entity and keeps local-only work', async () => {
    // e2 is not the open entity: its StepA was rewritten server-side (and re-graded `fail`),
    // and it also holds a step that never reached the server.
    useLabPipelineStore.setState({
      byEntity: {
        e2: { StepA: derived(), StepLocal: localOnly() },
      },
    });
    fetchArtifactsResult.mockResolvedValue({
      ok: true,
      data: [
        serverRow('e1', 'StepA'),
        serverRow('e2', 'StepA', { data: { body: 'rewritten' }, status: 'fail', reason: 'gate failed' }),
      ],
    });

    const res = await refreshCatalogFromServer('cat', ENTITIES);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const store = useLabPipelineStore.getState().byEntity;
    // The non-open entity's change is now VISIBLE (content + the server's verdict).
    expect(store.e2.StepA.data).toEqual({ body: 'rewritten' });
    expect(store.e2.StepA.status).toBe('fail');
    expect(store.e2.StepA.reason).toBe('gate failed');
    // …and the local-only step SURVIVED, flagged rather than destroyed.
    expect(store.e2.StepLocal.data).toEqual({ body: 'mine' });
    expect(store.e2.StepLocal.syncError).toBe(SERVER_MISSING_REASON);
    // An entity with no local state is left alone — the refreshed cache rows are what the
    // board renders for it, and copying them into the persisted store buys nothing.
    expect(store.e1).toBeUndefined();

    // Only e2 held local state, so only e2 was RECONCILED — e1's change reaches the board
    // through the refreshed cache rows (hydrating it would copy the catalog's blobs into
    // localStorage for no benefit).
    expect(res.data).toMatchObject({ rows: 2, reconciled: 1, adopted: 1, kept: 1, removed: 0 });
    expect(res.data.entities.map((e) => e.entityName)).toEqual(['Two']);
    expect(res.data.entities[0].outcome.kept).toEqual(['StepLocal']);
  });

  it('reconciles away a step the server no longer has — but only when it is provably server-derived', async () => {
    useLabPipelineStore.setState({
      byEntity: { e1: { StepA: derived(), StepGone: derived(), StepMine: localOnly() } },
    });
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [serverRow('e1', 'StepA')] });

    const res = await refreshCatalogFromServer('cat', ENTITIES);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const store = useLabPipelineStore.getState().byEntity;
    expect(store.e1.StepGone).toBeUndefined();     // was the server's, the server dropped it
    expect(store.e1.StepMine).toBeDefined();        // never was the server's — kept
    expect(res.data).toMatchObject({ removed: 1, kept: 1 });
    expect(res.data.entities[0].outcome.removed).toEqual(['StepGone']);
  });

  it('reports "up to date" without listing anything when nothing moved', async () => {
    useLabPipelineStore.setState({ byEntity: { e1: { StepA: derived({ data: { body: 'server' }, serverSeen: NEW, at: NEW }) } } });
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [serverRow('e1', 'StepA')] });

    const res = await refreshCatalogFromServer('cat', ENTITIES);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ rows: 1, reconciled: 1, adopted: 0, removed: 0, kept: 0, unchanged: 1 });
    expect(res.data.entities).toEqual([]);
    expect(describeCatalogRefresh(res.data)).toBe('Up to date — 1 step across 1 entity match the server.');
  });

  it('reconciles NOTHING and reports the reason when the GET fails', async () => {
    useLabPipelineStore.setState({ byEntity: { e1: { StepA: derived() } } });
    fetchArtifactsResult.mockResolvedValue({ ok: false, error: 'HTTP 500' });

    const res = await refreshCatalogFromServer('cat', ENTITIES);
    expect(res).toEqual({ ok: false, error: 'HTTP 500' });
    // The local store is untouched — a failed read must never look like an empty server.
    expect(useLabPipelineStore.getState().byEntity.e1.StepA.data).toEqual({ body: 'stale' });
  });

  it('reports the re-read honestly when nothing local needed reconciling', async () => {
    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [serverRow('e1', 'StepA'), serverRow('e2', 'StepA')] });
    const res = await refreshCatalogFromServer('cat', ENTITIES);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ rows: 2, reconciled: 0 });
    expect(useLabPipelineStore.getState().byEntity).toEqual({}); // nothing copied into localStorage
    // NOT "nothing changed" — the board renders the refreshed rows and may well have moved.
    expect(describeCatalogRefresh(res.data)).toBe('Re-read 2 steps from the server. Nothing on this machine needed reconciling.');
  });

  it("drops the coach's blob-free read, so the global coach re-ranks against the refreshed rows", async () => {
    ensureSummary('cat');
    await waitForSummary('cat');
    expect(getCachedSummary('cat').loaded).toBe(true);

    fetchArtifactsResult.mockResolvedValue({ ok: true, data: [] });
    await refreshCatalogFromServer('cat', ENTITIES);

    // Dropped, not stale: the coach's ensure effect re-issues it on the cache version bump.
    expect(getCachedSummary('cat').loaded).toBe(false);
  });

  it('describes a mixed outcome in the RefreshOutcome idiom', () => {
    expect(describeCatalogRefresh({
      entities: [{ entityId: 'e', entityName: 'E', outcome: { adopted: ['A'], removed: [], kept: ['B'], unchanged: 2 } }],
      rows: 4, reconciled: 3, adopted: 1, removed: 0, kept: 1, unchanged: 2,
    })).toBe('1 entity changed · 1 adopted · 1 kept · 2 unchanged');
  });
});
