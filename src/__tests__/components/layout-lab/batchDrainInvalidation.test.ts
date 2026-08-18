import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { DrainOutcome } from '@/components/layout-lab/batchDrainModel';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { Result } from '@/types/result';

/**
 * The batch drain against the REAL shared artifact cache (only the HTTP client is mocked).
 *
 * A batch drain used to call `invalidateArtifacts(catalogId)` — the whole-catalog form, which
 * drops the cached rows of EVERY entity in the catalog even though `collectDeferred` filters
 * the drain to exactly the requested ids. These cases pin the narrowing from both sides:
 * an untouched entity keeps its rows, and a drained entity (plus the catalog-wide key the
 * matrix grid reads, and the coach's summary projection) is still dropped so the new verdict
 * shows up immediately. Revert the narrowing and the first case fails.
 */

const drainMock = vi.fn();
const fetchMock = vi.fn();
const summaryMock = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  drainCatalogGates: (...a: unknown[]) => drainMock(...a),
  fetchArtifactsResult: (...a: unknown[]) => fetchMock(...a),
  fetchStepSummaryResult: (...a: unknown[]) => summaryMock(...a),
}));

import { useBatchDrain, type BatchEntity } from '@/components/layout-lab/hooks/useBatchDrain';
import {
  ensureArtifacts, getCachedArtifacts, _resetArtifactCache,
} from '@/components/layout-lab/labArtifactCache';

const art = (entityId: string, step: string): PipelineArtifact => ({
  catalogId: 'c', entityId, step, data: {}, ueAssets: [], status: 'deferred', updatedAt: 0,
} as unknown as PipelineArtifact);

const okFetch = (rows: PipelineArtifact[]): Result<PipelineArtifact[], string> => ({ ok: true, data: rows });
const okOutcome = (): DrainOutcome => ({
  kind: 'ok', summary: { ran: 1, passed: 1, failed: 0, deferred: 0, skipped: 0, screenshots: [], results: [] },
});

const ents: BatchEntity[] = [{ id: 'e1', name: 'One' }];

/** Seed a cache key by driving the real `ensureArtifacts` fetch to completion. */
async function seed(catalogId: string, entityId: string | undefined, rows: PipelineArtifact[]) {
  fetchMock.mockResolvedValueOnce(okFetch(rows));
  ensureArtifacts(catalogId, entityId);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  drainMock.mockReset(); fetchMock.mockReset(); summaryMock.mockReset();
  _resetArtifactCache();
});
afterEach(cleanup);

describe('batch drain invalidates only what it drained', () => {
  it('keeps an UNTOUCHED entity\'s cached rows and drops the drained one', async () => {
    await seed('c', 'e1', [art('e1', 'Gate')]);
    await seed('c', 'e2', [art('e2', 'Gate'), art('e2', 'Art')]);
    await seed('c', undefined, [art('e1', 'Gate'), art('e2', 'Gate'), art('e2', 'Art')]);
    expect(getCachedArtifacts('c', 'e2').loaded).toBe(true);
    const fetchesBefore = fetchMock.mock.calls.length;

    drainMock.mockResolvedValue(okOutcome());
    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => { await result.current.start(ents); }); // drains e1 only

    // e2 was never in the drained set, so nothing could have changed its rows — they stay.
    // This is the assertion that fails if the whole-catalog invalidation is restored.
    const kept = getCachedArtifacts('c', 'e2');
    expect(kept.loaded).toBe(true);
    expect(kept.arts).toHaveLength(2);

    // …and no refetch was issued for it.
    expect(fetchMock.mock.calls.slice(fetchesBefore).some((c) => c[1] === 'e2')).toBe(false);
  });

  it('still drops the drained entity, the catalog-wide key and the summary (verdict shows immediately)', async () => {
    await seed('c', 'e1', [art('e1', 'Gate')]);
    await seed('c', undefined, [art('e1', 'Gate')]);
    expect(getCachedArtifacts('c').loaded).toBe(true);

    drainMock.mockResolvedValue(okOutcome());
    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => { await result.current.start(ents); });

    // Both the drained entity's key and the whole-catalog key the matrix grid reads are gone,
    // so the next read refetches server truth rather than rendering the pre-drain verdict.
    expect(getCachedArtifacts('c', 'e1').loaded).toBe(false);
    expect(getCachedArtifacts('c').loaded).toBe(false);
  });

  it('drops every entity it DID drain when the batch covers several', async () => {
    await seed('c', 'e1', [art('e1', 'Gate')]);
    await seed('c', 'e2', [art('e2', 'Gate')]);
    await seed('c', 'e3', [art('e3', 'Gate')]);

    drainMock.mockResolvedValue(okOutcome());
    const { result } = renderHook(() => useBatchDrain('c', 0));
    await act(async () => {
      await result.current.start([{ id: 'e1', name: 'One' }, { id: 'e3', name: 'Three' }]);
    });

    expect(getCachedArtifacts('c', 'e1').loaded).toBe(false);
    expect(getCachedArtifacts('c', 'e3').loaded).toBe(false);
    expect(getCachedArtifacts('c', 'e2').loaded).toBe(true); // untouched
  });
});
