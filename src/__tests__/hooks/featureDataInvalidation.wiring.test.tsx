/**
 * One mutation, BOTH derived caches.
 *
 * `/api/feature-matrix/all-statuses` (per-feature statuses) and
 * `/api/feature-matrix/aggregate` (the per-module roll-up) are two projections of
 * the SAME `feature_matrix` rows, and wave 13 composed `invalidateFeatureData()`
 * to drop them together. Four mutation sites kept calling the narrow
 * `invalidateFeatureStatuses` directly — a seed, an auto-verify, a CLI PATCH
 * picked up by the refetch signature diff, and the NBA refresh — so each of them
 * refreshed the status cells while the module roll-ups beside them kept serving
 * pre-mutation numbers for a whole TTL window.
 *
 * RED before this change: every "aggregate refetched" assertion below failed,
 * while its statuses twin passed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { mockFetchRoutes } from '@/__tests__/setup';

// Auto-verify runs the REAL engine against a fixture manifest held in the bridge
// store: no UE connection exists here, and every feature-matrix call is routed below.
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { useNBA } from '@/hooks/useNBA';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleAggregates, invalidateFeatureData } from '@/hooks/useModuleAggregates';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;
const FEATURE = MODULE_FEATURE_DEFINITIONS[MODULE]![0].featureName;

const AGGREGATE = {
  body: {
    success: true,
    data: {
      modules: [
        { moduleId: MODULE, total: 1, implemented: 1, improved: 0, partial: 0, missing: 0, unknown: 0, avgQuality: 4, lastReviewedAt: null },
      ],
    },
  },
};

function matrixRows(status: string) {
  return {
    body: {
      success: true,
      data: {
        features: [{ id: 1, moduleId: MODULE, featureName: FEATURE, category: 'Core', status }],
        summary: { total: 1, implemented: 1, improved: 0, partial: 0, missing: 0, unknown: 0 },
      },
    },
  };
}

// Re-installing routes (to simulate an out-of-band write) swaps `globalThis.fetch`
// for a fresh mock, so request counts are summed across every mock installed in
// the case rather than read off the last one.
const mocks: ReturnType<typeof mockFetchRoutes>[] = [];

/** Route order matters — first substring match wins. */
function installRoutes(status = 'implemented') {
  const mock = mockFetchRoutes([
    { match: '/api/feature-matrix/aggregate', response: AGGREGATE },
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
    { match: '/api/feature-matrix?moduleId=', response: matrixRows(status) },
    // The seed POST (no query string).
    { match: '/api/feature-matrix', response: { body: { success: true, data: { inserted: 1 } } } },
  ]);
  mocks.push(mock);
  return mock;
}

const callsTo = (fragment: string) =>
  mocks.reduce((n, m) => n + m.mock.calls.filter((c) => String(c[0]).includes(fragment)).length, 0);
const aggregateCalls = () => callsTo('feature-matrix/aggregate');
const postCalls = () =>
  mocks.reduce((n, m) => n + m.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST').length, 0);

/** A connected editor's manifest with no assets: every rule for the module reads
 *  `missing`, so the preview has flips to propose without any UE connection. */
const EMPTY_MANIFEST = {
  version: 1, generatedAt: '2026-09-30T00:00:00.000Z', projectName: 'PoF', engineVersion: '5.8',
  assetCount: 0, checksumSha256: 'c', blueprints: [], materials: [], animAssets: [], dataTables: [], otherAssets: [],
};
const statusCalls = () => callsTo('all-statuses');

/** A status consumer and an aggregate consumer mounted beside the mutating hook. */
function Consumers() {
  const { loaded } = useFeatureStatuses();
  const { aggregates } = useModuleAggregates();
  return <span data-testid="consumers">{`${loaded}:${aggregates.length}`}</span>;
}

/** Both cache consumers live in the SAME tree as the hook under test. */
function withConsumers({ children }: { children: ReactNode }) {
  return (
    <>
      <Consumers />
      {children}
    </>
  );
}

/** Both caches settled and quiet, so a later count is attributable to the mutation. */
async function settle() {
  await waitFor(() => expect(aggregateCalls()).toBe(1));
  await waitFor(() => expect(statusCalls()).toBe(1));
}

beforeEach(() => {
  // Module-level caches survive remounts by design — start every case cold.
  invalidateFeatureData();
  mocks.length = 0;
});
afterEach(() => {
  cleanup();
  usePofBridgeStore.setState({ manifest: null, connectionStatus: 'disconnected' } as never);
});

describe('feature-matrix mutations invalidate BOTH derived caches', () => {
  it('seed: a status consumer AND an aggregate consumer both refetch', async () => {
    installRoutes();
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();

    await act(async () => { await result.current.seed(); });

    await waitFor(() => expect(statusCalls()).toBe(2));
    await waitFor(() => expect(aggregateCalls()).toBe(2));
  });

  it('auto-verify preview reads the current rows and writes nothing', async () => {
    installRoutes();
    usePofBridgeStore.setState({ manifest: EMPTY_MANIFEST, connectionStatus: 'connected' } as never);
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();
    const rowReadsBefore = callsTo('/api/feature-matrix?moduleId=');

    let plan: Awaited<ReturnType<typeof result.current.previewAutoVerify>> = null;
    await act(async () => { plan = await result.current.previewAutoVerify(); });

    expect(plan).not.toBeNull();
    expect(plan!.changes.length).toBeGreaterThan(0);
    expect(callsTo('/api/feature-matrix?moduleId=')).toBe(rowReadsBefore + 1);
    expect(postCalls()).toBe(0);
    // Nothing was written, so no derived cache moved.
    expect(statusCalls()).toBe(1);
    expect(aggregateCalls()).toBe(1);
  });

  it('auto-verify preview with a cached manifest but no connected editor plans nothing and reads nothing', async () => {
    installRoutes();
    usePofBridgeStore.setState({ manifest: EMPTY_MANIFEST, connectionStatus: 'disconnected' } as never);
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();
    const rowReadsBefore = callsTo('/api/feature-matrix?moduleId=');

    let plan: Awaited<ReturnType<typeof result.current.previewAutoVerify>> = null;
    await act(async () => { plan = await result.current.previewAutoVerify(); });

    expect(plan).toBeNull();
    expect(callsTo('/api/feature-matrix?moduleId=')).toBe(rowReadsBefore);
    expect(postCalls()).toBe(0);
  });

  it('auto-verify apply: one POST, then a status consumer AND an aggregate consumer both refetch', async () => {
    installRoutes();
    usePofBridgeStore.setState({ manifest: EMPTY_MANIFEST, connectionStatus: 'connected' } as never);
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();

    await act(async () => { await result.current.previewAutoVerify(); });
    const picked = result.current.verifyPlan!.changes[0].featureName;
    await act(async () => { await result.current.applyAutoVerify([picked]); });

    expect(postCalls()).toBe(1);
    await waitFor(() => expect(statusCalls()).toBe(2));
    await waitFor(() => expect(aggregateCalls()).toBe(2));
  });

  it('an out-of-band PATCH seen by the refetch signature diff drops both caches', async () => {
    installRoutes('implemented');
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();

    // The CLI fix flow PATCHes the row by curl; the next refetch is where the app
    // learns the shared caches are stale.
    installRoutes('partial');
    await act(async () => { await result.current.refetch(); });

    await waitFor(() => expect(statusCalls()).toBe(2));
    await waitFor(() => expect(aggregateCalls()).toBe(2));
  });

  it('an unchanged refetch invalidates nothing (no cache churn on a poll)', async () => {
    installRoutes('implemented');
    const { result } = renderHook(() => useFeatureMatrix(MODULE), { wrapper: withConsumers });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await settle();

    await act(async () => { await result.current.refetch(); });
    await new Promise((r) => setTimeout(r, 0));

    expect(statusCalls()).toBe(1);
    expect(aggregateCalls()).toBe(1);
  });

  it('NBA refresh re-reads the whole matrix, not just the statuses half', async () => {
    installRoutes();
    const { result } = renderHook(() => useNBA(MODULE), { wrapper: withConsumers });
    await settle();

    await act(async () => { result.current.refresh(); });

    await waitFor(() => expect(statusCalls()).toBe(2));
    await waitFor(() => expect(aggregateCalls()).toBe(2));
  });
});
