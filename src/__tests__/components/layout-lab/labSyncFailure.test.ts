import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postArtifact } from '@/components/layout-lab/labArtifactClient';
import { useLabPipelineStore, setLabSync, NO_SYNC_SINK_REASON } from '@/components/layout-lab/labPipelineStore';

/**
 * Rule 4 on the WRITE side: a produce that fails to reach the server must say WHY.
 *
 * The three distinct failure modes below used to be indistinguishable — a rejected payload,
 * a dead server and "nothing was even listening" all collapsed into one boolean `false`
 * (and the third into total silence, because the sync sink is a module singleton the
 * Baseline shell nulls on unmount).
 */

const artifactOf = (entityId: string, step: string) => useLabPipelineStore.getState().byEntity[entityId]?.[step];

/** Fake the envelope a route returns; `tryApiFetch` reads `error` and drops `details`. */
function stubEnvelope(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => body }));
}

const BODY = { catalogId: 'items', entityId: 'item-1', step: 'Economy', data: {}, ueAssets: [], status: 'pass' as const };

describe('postArtifact keeps the failure REASON', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('400 with validation issues → the offending fields reach the caller', async () => {
    // What the route now sends: the issue detail folded into the envelope's `error` string.
    stubEnvelope({ success: false, error: 'Invalid artifact payload — data: Expected object, received string', details: [] });
    const res = await postArtifact(BODY);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toContain('data:');
  });

  it('500 → the server message reaches the caller, distinct from a rejected payload', async () => {
    stubEnvelope({ success: false, error: 'Artifacts POST failed: database is locked' });
    const res = await postArtifact(BODY);
    expect(res.ok === false && res.error).toBe('Artifacts POST failed: database is locked');
  });

  it('a network failure is reported, not swallowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    const res = await postArtifact(BODY);
    expect(res.ok === false && res.error).toBe('Failed to fetch');
  });

  it('success carries the persisted row back', async () => {
    stubEnvelope({ success: true, data: { step: 'Economy', status: 'pass' } });
    const res = await postArtifact(BODY);
    expect(res.ok).toBe(true);
  });
});

describe('a produce with NO sync sink is reported, never silent', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); setLabSync(null); });
  afterEach(() => { setLabSync(null); });

  it('produce() records the no-sink reason on the artifact', () => {
    useLabPipelineStore.getState().produce('item-1', 'Economy', { data: { price: 10 } });
    const art = artifactOf('item-1', 'Economy')!;
    // The optimistic local write still happened — only the honesty changes.
    expect(art.done).toBe(true);
    expect(art.data).toEqual({ price: 10 });
    expect(art.syncError).toBe(NO_SYNC_SINK_REASON);
  });

  it('produceFrom() records it too', () => {
    useLabPipelineStore.getState().produceFrom('item-1', 'Icon 2D Art', () => ({ data: { picked: 'a' } }));
    expect(artifactOf('item-1', 'Icon 2D Art')?.syncError).toBe(NO_SYNC_SINK_REASON);
  });

  it('a registered sink means no sync error is invented', () => {
    setLabSync(() => {});
    useLabPipelineStore.getState().produce('item-1', 'Economy', { data: { price: 10 } });
    expect(artifactOf('item-1', 'Economy')?.syncError).toBeUndefined();
  });
});

describe('hydration clears a sync error the server has disproved', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); setLabSync(null); });

  const seedFailed = (at: string) => {
    useLabPipelineStore.setState({
      byEntity: { 'item-1': { Economy: { done: true, data: { price: 10 }, ueAssets: [], at, syncError: 'Not saved to the server: offline' } } },
    });
  };

  it('a server row at least as new as the local artifact clears it', () => {
    seedFailed('2026-07-01T10:00:00.000Z');
    useLabPipelineStore.getState().hydrateEntity('item-1', [
      { step: 'Economy', artifact: { done: true, data: { price: 10 }, ueAssets: [], at: '2026-07-01T10:00:05.000Z', status: 'pass' } },
    ]);
    expect(artifactOf('item-1', 'Economy')?.syncError).toBeUndefined();
    // Content stays add-only; only the (disproved) claim about the server is dropped.
    expect(artifactOf('item-1', 'Economy')?.data).toEqual({ price: 10 });
  });

  it('a STRICTLY OLDER server row does not clear it (that row is a previous produce)', () => {
    seedFailed('2026-07-01T10:00:00.000Z');
    useLabPipelineStore.getState().hydrateEntity('item-1', [
      { step: 'Economy', artifact: { done: true, data: { price: 1 }, ueAssets: [], at: '2026-07-01T09:00:00.000Z', status: 'pass' } },
    ]);
    expect(artifactOf('item-1', 'Economy')?.syncError).toBe('Not saved to the server: offline');
  });
});
