/**
 * Sorting by Modified parses each modifiedAt once per scan, not twice per comparison.
 * Instrument: count `new Date('<modifiedAt>')` constructions across scan + sorts + search.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, act, renderHook } from '@testing-library/react';
import type { AssetScanResult } from '@/app/api/filesystem/scan-assets/route';
import { scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';

afterEach(cleanup);

vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { useAssetInventory } from '@/components/modules/content/models/AssetInventory/useAssetInventory';
import { useProjectStore } from '@/stores/projectStore';

const N = 1000;
const ASSETS = Array.from({ length: N }, (_, i) => ({
  ...scanned(`Meshes/SM_Rock_${i}.uasset`, 'mesh'),
  // Distinct, shuffled timestamps so the comparator really runs.
  modifiedAt: new Date(Date.UTC(2026, 0, 1) + ((i * 7919) % N) * 60000).toISOString(),
}));

const RealDate = Date;

beforeEach(() => {
  useProjectStore.setState({ projectPath: 'C:/Proj' } as never);
  const body: { success: boolean; data: AssetScanResult } = {
    success: true,
    data: { scannedAt: 'T', contentPath: 'C:/Proj/Content', assets: ASSETS, dependencies: [], totalSizeBytes: 0, truncated: false, scanDurationMs: 1 },
  };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response));
});

afterEach(() => {
  globalThis.Date = RealDate;
  vi.unstubAllGlobals();
});

function countModifiedParses() {
  const stamps = new Set(ASSETS.map((a) => a.modifiedAt));
  const counter = { n: 0 };
  class CountingDate extends RealDate {
    constructor(...args: unknown[]) {
      super(...(args as [string]));
      if (typeof args[0] === 'string' && stamps.has(args[0])) counter.n++;
    }
  }
  globalThis.Date = CountingDate as unknown as DateConstructor;
  return counter;
}

describe('useAssetInventory: Modified sort', () => {
  it('parses each modifiedAt at most once per scan across sort and search', async () => {
    const hook = renderHook(() => useAssetInventory());
    const counter = countModifiedParses();
    await act(async () => { await hook.result.current.handleScan(); });
    act(() => { hook.result.current.toggleSort('modified'); });
    act(() => { hook.result.current.setSearch('rock_1'); });
    act(() => { hook.result.current.setSearch('rock'); });
    expect(hook.result.current.sortKey).toBe('modified');
    expect(counter.n).toBeLessThanOrEqual(N);
  });

  it('[guard] Modified ascending is oldest-first, descending reverses', async () => {
    const hook = renderHook(() => useAssetInventory());
    await act(async () => { await hook.result.current.handleScan(); });
    act(() => { hook.result.current.toggleSort('modified'); });
    const asc = hook.result.current.displayAssets.map((a) => a.modifiedAt);
    expect(asc).toEqual([...asc].sort());
    act(() => { hook.result.current.toggleSort('modified'); });
    expect(hook.result.current.displayAssets.map((a) => a.modifiedAt)).toEqual([...asc].reverse());
  });
});
