import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AssetManifestCard } from '@/components/ecw/live/AssetManifestCard';
import { useCatalogStore } from '@/stores/catalogStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

function mkEntity(id: string, catalogId: string, ueAssets?: string[]): CatalogEntityBase {
  return { id, catalogId, name: id, categoryPath: [], tags: [], lifecycle: 'planned', ueAssets };
}

describe('AssetManifestCard', () => {
  beforeEach(() => {
    const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
    usePofBridgeStore.setState({ pluginInfo: null });
  });
  afterEach(cleanup);

  it('renders the card title', () => {
    render(<AssetManifestCard />);
    expect(screen.getByRole('heading', { level: 2, name: /Asset Manifest/ })).toBeTruthy();
  });

  it('counts entities with ueAssets across all catalogs', () => {
    useCatalogStore.setState({
      entitiesByCatalog: {
        spellbook: {
          a: mkEntity('a', 'spellbook', ['/Script/PoF.GA_Fireball']),
          b: mkEntity('b', 'spellbook'),  // no ueAssets → 0 generated
        },
        items: { c: mkEntity('c', 'items', ['/Game/Items/Sword']) },
        'loot-tables': {}, bestiary: {}, 'combat-map': {},
        'screen-flow': {}, 'zone-map': {}, 'state-graph': {},
      },
    });
    render(<AssetManifestCard />);
    // Total: 3 defined entities, 2 with at least one ueAsset.
    expect(screen.getByText(/3 entities/i)).toBeTruthy();
  });

  it('renders one row per catalog (8)', () => {
    render(<AssetManifestCard />);
    expect(screen.getAllByTestId('asset-manifest-row')).toHaveLength(CATALOG_SECTIONS.length);
  });

  it('shows UE manifest count from bridge when available', () => {
    usePofBridgeStore.setState({
      pluginInfo: {
        pluginVersion: '1.4.0', engineVersion: '5.7.0',
        projectName: 'PoF', projectRoot: 'C:/PoF',
        editorState: 'idle', pieRunning: false, liveCodingEnabled: true,
        manifestReady: true, manifestAssetCount: 1247,
        manifestLastUpdated: '2026-05-24T12:39:00Z',
        uptimeSeconds: 3600, port: 30040,
      },
    });
    render(<AssetManifestCard />);
    expect(screen.getByText(/1,?247 assets in UE/i)).toBeTruthy();
  });
});
