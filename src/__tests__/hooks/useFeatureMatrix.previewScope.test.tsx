/**
 * An Auto-Verify preview belongs to the module + project it was READ under.
 *
 * `useFeatureMatrix` drops a held plan when the module or project switches, and its
 * contract says an apply can therefore never write one project's picks into another.
 * That held only for a plan that had already landed: a preview still in flight when
 * the switch happened resolved afterwards and seated the old scope's plan as the
 * new scope's preview — Apply would then write it under the new project.
 *
 * RED before the fix: `verifyPlan` was the old module's plan after the switch.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';

const h = vi.hoisted(() => ({
  pending: [] as Array<(v: { ok: true; rows: FeatureRow[] }) => void>,
}));

vi.mock('@/lib/pof-bridge/verification-engine', async (orig) => {
  const real = await orig<typeof import('@/lib/pof-bridge/verification-engine')>();
  return {
    ...real,
    // Held open so the test decides when the preview's read lands.
    readVerificationRows: vi.fn(() => new Promise((resolve) => { h.pending.push(resolve); })),
  };
});

import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useProjectStore } from '@/stores/projectStore';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';

const EMPTY_MANIFEST = {
  version: 1, generatedAt: '2026-09-30T00:00:00.000Z', projectName: 'PoF', engineVersion: '5.8',
  assetCount: 0, checksumSha256: 'c', blueprints: [], materials: [], animAssets: [], dataTables: [], otherAssets: [],
};

function rows(moduleId: string) {
  return {
    body: {
      success: true,
      data: {
        features: [{ id: 1, moduleId, featureName: 'X', category: 'Core', status: 'unknown' }],
        summary: { total: 1, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 1 },
      },
    },
  };
}

afterEach(() => {
  cleanup();
  h.pending.length = 0;
  invalidateFeatureData();
  usePofBridgeStore.setState({ manifest: null, connectionStatus: 'disconnected' } as never);
  useProjectStore.setState({ projectPath: '' } as never);
});

function setup() {
  mockFetchRoutes([
    { match: '/api/feature-matrix/', response: { body: { success: true, data: { statuses: [], modules: [] } } } },
    { match: '/api/feature-matrix?moduleId=', response: rows('arpg-combat') },
    { match: '/api/feature-matrix', response: { body: { success: true, data: {} } } },
  ]);
  usePofBridgeStore.setState({ manifest: EMPTY_MANIFEST, connectionStatus: 'connected' } as never);
  useProjectStore.setState({ projectPath: 'C:/Projects/A' } as never);
}

describe('useFeatureMatrix — a preview in flight across a scope switch', () => {
  it('a preview dispatched under module A does not land as module B\'s plan', async () => {
    setup();
    const { result, rerender } = renderHook(
      ({ m }: { m: SubModuleId }) => useFeatureMatrix(m),
      { initialProps: { m: 'arpg-combat' as SubModuleId } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let preview!: Promise<unknown>;
    act(() => { preview = result.current.previewAutoVerify(); });
    await waitFor(() => expect(h.pending.length).toBe(1));

    rerender({ m: 'arpg-loot' as SubModuleId });
    await act(async () => { h.pending[0]({ ok: true, rows: [] }); await preview; });

    expect(result.current.verifyPlan).toBeNull();
    expect(result.current.isVerifying).toBe(false);
    // And an Apply has nothing to write.
    let written: unknown[] = ['sentinel'];
    await act(async () => { written = await result.current.applyAutoVerify(['X']); });
    expect(written).toEqual([]);
  });

  it('a preview dispatched under project A does not land after switching to project B', async () => {
    setup();
    const { result } = renderHook(() => useFeatureMatrix('arpg-combat' as SubModuleId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let preview!: Promise<unknown>;
    act(() => { preview = result.current.previewAutoVerify(); });
    await waitFor(() => expect(h.pending.length).toBe(1));

    act(() => { useProjectStore.setState({ projectPath: 'C:/Projects/B' } as never); });
    await act(async () => { h.pending[0]({ ok: true, rows: [] }); await preview; });

    expect(result.current.verifyPlan).toBeNull();
  });

  it('[control] a preview that lands in its own scope is held', async () => {
    setup();
    const { result } = renderHook(() => useFeatureMatrix('arpg-combat' as SubModuleId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let preview!: Promise<unknown>;
    act(() => { preview = result.current.previewAutoVerify(); });
    await waitFor(() => expect(h.pending.length).toBe(1));
    await act(async () => { h.pending[0]({ ok: true, rows: [] }); await preview; });

    expect(result.current.verifyPlan).not.toBeNull();
    expect(result.current.verifyPlan?.moduleId).toBe('arpg-combat');
  });
});
