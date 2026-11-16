/**
 * AssetInventory formats sizes through the shared lib/format helper (one byte format
 * app-wide), not a private copy that rounded differently and broke on negatives.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { formatBytes } from '@/lib/format';
import { scanned } from '@/__tests__/lib/asset-inventory/design-doc-fixture';
import { AssetCard } from '@/components/modules/content/models/AssetInventory/AssetCard';

const TOTAL = 15360;
const ASSET = scanned('Meshes/SM_Rock.uasset', 'mesh', TOTAL);

vi.mock('@/components/modules/content/models/AssetInventory/useAssetInventory', () => ({
  useAssetInventory: () => ({
    projectPath: 'C:/proj',
    bridgeConnected: false,
    bridgeSummary: null,
    scanResult: { scannedAt: 'T', assets: [ASSET], dependencies: [], totalSizeBytes: TOTAL, scanDurationMs: 5 },
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
    typeCounts: { mesh: 1 },
    displayAssets: [],
    edges: [],
    edgeProvenance: { declared: 0, inferred: 0 },
    unresolvedRefs: 0,
    reconcile: { available: false, notInManifest: [] },
    ueListed: null,
    edgeCount: {},
  }),
}));

import { AssetInventory } from '@/components/modules/content/models/AssetInventory';

afterEach(cleanup);

describe('AssetInventory byte format', () => {
  it('the summary bar total is the shared formatBytes output', () => {
    const { container } = render(<AssetInventory />);
    expect(formatBytes(TOTAL)).toBe('15.0 KB');
    expect(container.textContent).toContain(`${formatBytes(TOTAL)} total`);
  });

  it('an asset card size is the shared formatBytes output', () => {
    const { container } = render(
      <AssetCard asset={ASSET} isExpanded={false} edgeCount={{}} allAssets={[ASSET]} dependencies={[]} ueListed={null} setExpandedAsset={() => {}} />,
    );
    expect(container.textContent).toContain(formatBytes(TOTAL));
  });
});
