/**
 * AssetInventory discloses a capped scan: scan-assets answers `truncated: true` when it
 * stopped at its file cap, and the view must not present those totals as the whole project.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

let truncated: boolean | undefined = true;

vi.mock('@/components/modules/content/models/AssetInventory/useAssetInventory', () => ({
  useAssetInventory: () => ({
    projectPath: 'C:/proj',
    bridgeConnected: false,
    bridgeSummary: null,
    scanResult: {
      scannedAt: '2026-11-08T00:00:00Z',
      assets: [],
      dependencies: [],
      totalSizeBytes: 0,
      scanDurationMs: 5,
      truncated,
    },
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
    expandedAsset: null,
    setExpandedAsset: () => {},
    handleScan: () => {},
    typeCounts: {},
    displayAssets: [],
    edges: [],
    edgeProvenance: { declared: 0, inferred: 0 },
    unresolvedRefs: 0,
    reconcile: { available: false, notInManifest: [] },
    ueListed: null,
    edgeCount: 0,
  }),
}));

import { AssetInventory } from '@/components/modules/content/models/AssetInventory';

afterEach(cleanup);

describe('AssetInventory truncated notice', () => {
  it('says the scan is partial when the route reports truncated', () => {
    truncated = true;
    const { container } = render(<AssetInventory />);
    expect(container.textContent).toContain('Partial scan');
  });

  it('[guard] a complete scan shows no notice', () => {
    truncated = false;
    const { container } = render(<AssetInventory />);
    expect(container.textContent).not.toContain('Partial scan');
  });
});
