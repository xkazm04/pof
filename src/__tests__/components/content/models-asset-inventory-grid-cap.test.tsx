/**
 * AssetInventory mounts one page of cards, not every scanned asset: each card is a
 * framer `layout` node, and a real Content/ folder holds thousands of assets.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';

const ASSETS = Array.from({ length: 2000 }, (_, i) => scanned(`Meshes/SM_Rock_${String(i).padStart(4, '0')}.uasset`, 'mesh'));
let expanded: string | null = null;

vi.mock('@/components/modules/content/models/AssetInventory/AssetCard', () => ({
  AssetCard: ({ asset }: { asset: { relativePath: string } }) => <div data-card={asset.relativePath} />,
}));

vi.mock('@/components/modules/content/models/AssetInventory/useAssetInventory', () => ({
  useAssetInventory: () => ({
    projectPath: 'C:/proj',
    bridgeConnected: false,
    bridgeSummary: null,
    scanResult: { scannedAt: 'T', assets: ASSETS, dependencies: [], totalSizeBytes: 0, scanDurationMs: 5 },
    isScanning: false,
    error: null,
    search: '',
    setSearch: () => {},
    typeFilter: 'all',
    setTypeFilter: () => {},
    ueFilter: 'all',
    setUeFilter: () => {},
    sortKey: 'name',
    sortDir: 'asc',
    toggleSort: () => {},
    SortIcon: () => null,
    expandedAsset: expanded,
    setExpandedAsset: () => {},
    handleScan: () => {},
    typeCounts: { mesh: ASSETS.length },
    displayAssets: ASSETS,
    edges: [],
    edgeProvenance: { declared: 0, inferred: 0 },
    unresolvedRefs: 0,
    reconcile: { available: false, notInManifest: [] },
    ueListed: null,
    edgeCount: {},
  }),
}));

import { AssetInventory, GRID_PAGE_SIZE } from '@/components/modules/content/models/AssetInventory';

afterEach(() => { cleanup(); expanded = null; });

const cards = (c: HTMLElement) => c.querySelectorAll('[data-card]').length;

describe('AssetInventory grid cap', () => {
  it('mounts one page of 2000 assets and says how many are hidden', () => {
    const { container } = render(<AssetInventory />);
    expect(cards(container)).toBe(GRID_PAGE_SIZE);
    expect(container.textContent).toContain(`Showing ${GRID_PAGE_SIZE} of 2000 assets`);
    expect(container.textContent).toContain(`${2000 - GRID_PAGE_SIZE} hidden`);
  });

  it('Show more grows the grid by one page', () => {
    const { container, getByText } = render(<AssetInventory />);
    fireEvent.click(getByText(/more \(/));
    expect(cards(container)).toBe(GRID_PAGE_SIZE * 2);
  });

  it('keeps an expanded asset mounted even when it sits past the page', () => {
    expanded = ASSETS[1500].relativePath;
    const { container } = render(<AssetInventory />);
    expect(cards(container)).toBe(GRID_PAGE_SIZE + 1);
    expect(container.querySelector(`[data-card="${expanded}"]`)).not.toBeNull();
  });
});
