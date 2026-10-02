/**
 * Asset Inventory renders a scan, and draws UE's declared references over
 * name guesses.
 *
 * Before this change the hook stored POST /api/filesystem/scan-assets' raw
 * `{success, data}` envelope as the scan, so the first render after a scan
 * threw ('scanResult.assets is not iterable'): the tab had never rendered one.
 * The connected PoF Bridge manifest was reduced to five array lengths, so the
 * graph only ever showed name guesses (0 of 10 declared references on the
 * plugin design doc's own example project).
 *
 * RED before this change: cases 1, 3, 4 and the render case; the error case
 * and the disconnected 1:1 case are guards.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import type { AssetDependencyEdge, AssetScanResult } from '@/app/api/filesystem/scan-assets/route';
import { DOC_ASSETS, DOC_MANIFEST, scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';

afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => false };
});

// useManifest is a refcounted, suspend-aware feed; the inventory only reads
// {manifest, isConnected}, so the hook itself is stubbed.
const bridge = vi.hoisted(() => ({ manifest: null as unknown, isConnected: false }));
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({
    manifest: bridge.manifest,
    isConnected: bridge.isConnected,
    isLoading: false,
    error: null,
    refresh: async () => {},
  }),
}));

import { useAssetInventory } from '@/components/modules/content/models/AssetInventory/useAssetInventory';
import { AssetInventory } from '@/components/modules/content/models/AssetInventory';
import { useProjectStore } from '@/stores/projectStore';

// ── Fixtures ──

function scanResult(assets = DOC_ASSETS, dependencies: AssetDependencyEdge[] = []): AssetScanResult {
  return {
    scannedAt: '2026-09-30T00:00:00.000Z',
    contentPath: 'C:/Proj/Content',
    assets,
    dependencies,
    totalSizeBytes: assets.reduce((s, a) => s + a.sizeBytes, 0),
    scanDurationMs: 7,
  };
}

/** The REAL wire shape of POST /api/filesystem/scan-assets (apiSuccess / apiError). */
function respond(body: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const ROCK = [scanned('Meshes/SM_Rock.uasset', 'mesh'), scanned('Materials/M_Rock.uasset', 'material')];
const ROCK_EDGE: AssetDependencyEdge = { from: 'Meshes/SM_Rock.uasset', to: 'Materials/M_Rock.uasset', relation: 'uses-material' };

/** The edge counting the hook did before this change, reproduced as the oracle. */
function todaysEdgeCount(deps: AssetDependencyEdge[]) {
  const counts: Record<string, number> = {};
  for (const e of deps) {
    counts[e.from] = (counts[e.from] ?? 0) + 1;
    if (e.to !== e.from) counts[e.to] = (counts[e.to] ?? 0) + 1;
  }
  return counts;
}

async function scanWith(body: unknown, ok = true, status = 200) {
  respond(body, ok, status);
  const hook = renderHook(() => useAssetInventory());
  await act(async () => { await hook.result.current.handleScan(); });
  return hook;
}

beforeEach(() => {
  bridge.manifest = null;
  bridge.isConnected = false;
  useProjectStore.setState({ projectPath: 'C:/Proj' } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAssetInventory: the scan envelope', () => {
  it('unwraps {success, data}: the scan renders', async () => {
    const hook = await scanWith({ success: true, data: scanResult(ROCK, [ROCK_EDGE]) });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.scanResult?.assets).toHaveLength(2);
    expect(Object.keys(hook.result.current.typeCounts)).toHaveLength(2);
  });

  it('[guard] an error envelope keeps its text and no scan', async () => {
    const hook = await scanWith({ success: false, error: 'Project path does not exist' }, false, 404);
    expect(hook.result.current.error).toBe('Project path does not exist');
    expect(hook.result.current.scanResult).toBeNull();
  });
});

describe('useAssetInventory: edges and their provenance', () => {
  it('[guard] bridge disconnected: the route\'s inferred edges 1:1, tagged inferred, same counts', async () => {
    const hook = await scanWith({ success: true, data: scanResult(ROCK, [ROCK_EDGE]) });
    const cur = hook.result.current;
    expect(cur.edges).toEqual([{ ...ROCK_EDGE, provenance: 'inferred' }]);
    expect(cur.edgeCount).toEqual(todaysEdgeCount([ROCK_EDGE]));
    expect(cur.edgeProvenance).toEqual({ declared: 0, inferred: 1 });
    expect(cur.reconcile).toEqual({ available: false });
    expect(cur.ueFilter).toBeNull();
  });

  it('bridge connected: the graph is UE\'s 10 declared references', async () => {
    bridge.manifest = DOC_MANIFEST;
    bridge.isConnected = true;
    const hook = await scanWith({ success: true, data: scanResult() });
    const cur = hook.result.current;
    expect(cur.edges).toHaveLength(10);
    expect(cur.edgeProvenance).toEqual({ declared: 10, inferred: 0 });
    expect(cur.unresolvedRefs).toBe(1);
    expect(cur.edgeCount['Materials/M_Character_Base.uasset']).toBe(4);
  });

  it('setUeFilter(\'not-in-manifest\') narrows to reconcile.notInManifest, composed with type + search', async () => {
    bridge.manifest = DOC_MANIFEST;
    bridge.isConnected = true;
    const hook = await scanWith({ success: true, data: scanResult() });
    const reconcile = hook.result.current.reconcile;
    if (!reconcile.available) throw new Error('expected a reconcile');
    expect(hook.result.current.ueFilter).toBe('all');

    act(() => hook.result.current.setUeFilter('not-in-manifest'));
    const paths = (xs: { relativePath: string }[]) => xs.map((a) => a.relativePath).sort();
    expect(paths(hook.result.current.displayAssets)).toEqual(paths(reconcile.notInManifest));

    act(() => hook.result.current.setTypeFilter('material'));
    expect(paths(hook.result.current.displayAssets)).toEqual([
      'Materials/MI_Character_Blue.uasset',
      'Materials/MI_Character_Red.uasset',
    ]);

    act(() => hook.result.current.setSearch('red'));
    expect(paths(hook.result.current.displayAssets)).toEqual(['Materials/MI_Character_Red.uasset']);
  });
});

describe('AssetInventory: renders a scan and labels every edge\'s source', () => {
  it('shows the grid, the UE filter, missing-on-disk, and declared edges as UE-declared', async () => {
    bridge.manifest = DOC_MANIFEST;
    bridge.isConnected = true;
    respond({ success: true, data: scanResult() });
    render(<AssetInventory />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Scan Content/ })); });

    expect(screen.getByText(/Showing 14 of 14 assets/)).toBeTruthy();
    expect(screen.getByText(/10 UE-declared/)).toBeTruthy();
    expect(screen.getByText(/missing on disk \(1\)/i)).toBeTruthy();

    const chip = screen.getByRole('button', { name: /Not in UE manifest/ });
    await act(async () => { fireEvent.click(chip); });
    expect(screen.getByText(/Showing 9 of 14 assets/)).toBeTruthy();
    await act(async () => { fireEvent.click(chip); });

    const card = screen.getByRole('button', { name: /^M_Character_Base/ });
    expect(within(card).getByText('UE')).toBeTruthy();
    await act(async () => { fireEvent.click(card); });
    const region = screen.getByRole('region', { name: /Dependency graph for M_Character_Base/ });
    expect(within(region).getByText(/4 UE-declared/)).toBeTruthy();
    expect(within(region).getByText(/0 guessed from names/)).toBeTruthy();
    expect(within(region).queryByText(/No known dependencies/)).toBeNull();
  });

  it('bridge disconnected: every edge is labelled a guess, never declared', async () => {
    respond({ success: true, data: scanResult(ROCK, [ROCK_EDGE]) });
    render(<AssetInventory />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Scan Content/ })); });
    expect(screen.queryByRole('button', { name: /Not in UE manifest/ })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^SM_Rock/ })); });
    const region = screen.getByRole('region', { name: /Dependency graph for SM_Rock/ });
    expect(within(region).getByText(/1 guessed from names/)).toBeTruthy();
    expect(within(region).queryByText(/UE-declared/)).toBeNull();
  });
});
