import { describe, it, expect, beforeEach } from 'vitest';
import { useAssetBrowserStore } from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';

const MOCK_RESULT: AssetSearchResult = {
  id: 'brick-wall-01',
  name: 'Brick Wall',
  source: 'polyhaven',
  category: 'textures',
  thumbnailUrl: 'https://example.com/thumb.png',
  downloadUrl: 'https://example.com/download',
  license: 'CC0',
  tags: ['brick', 'wall'],
};

describe('useAssetBrowserStore', () => {
  beforeEach(() => {
    useAssetBrowserStore.setState({
      query: '',
      activeSource: 'polyhaven',
      activeCategory: 'textures',
      results: [],
      isSearching: false,
      downloads: [],
    });
  });

  it('starts with default state', () => {
    const state = useAssetBrowserStore.getState();
    expect(state.query).toBe('');
    expect(state.activeSource).toBe('polyhaven');
    expect(state.activeCategory).toBe('textures');
    expect(state.results).toEqual([]);
    expect(state.isSearching).toBe(false);
    expect(state.downloads).toEqual([]);
  });

  it('sets query', () => {
    useAssetBrowserStore.getState().setQuery('stone wall');
    expect(useAssetBrowserStore.getState().query).toBe('stone wall');
  });

  it('sets active source and clears results', () => {
    useAssetBrowserStore.getState().setResults([MOCK_RESULT]);
    expect(useAssetBrowserStore.getState().results).toHaveLength(1);

    useAssetBrowserStore.getState().setActiveSource('ambientcg');
    const state = useAssetBrowserStore.getState();
    expect(state.activeSource).toBe('ambientcg');
    expect(state.results).toEqual([]);
  });

  it('sets active category and clears results', () => {
    useAssetBrowserStore.getState().setResults([MOCK_RESULT]);
    useAssetBrowserStore.getState().setActiveCategory('hdris');

    const state = useAssetBrowserStore.getState();
    expect(state.activeCategory).toBe('hdris');
    expect(state.results).toEqual([]);
  });

  it('sets results', () => {
    useAssetBrowserStore.getState().setResults([MOCK_RESULT]);
    expect(useAssetBrowserStore.getState().results).toHaveLength(1);
    expect(useAssetBrowserStore.getState().results[0].id).toBe('brick-wall-01');
  });

  it('sets searching flag', () => {
    useAssetBrowserStore.getState().setSearching(true);
    expect(useAssetBrowserStore.getState().isSearching).toBe(true);
    useAssetBrowserStore.getState().setSearching(false);
    expect(useAssetBrowserStore.getState().isSearching).toBe(false);
  });

  it('adds a download', () => {
    useAssetBrowserStore.getState().addDownload('brick-wall-01', 'Brick Wall');

    const { downloads } = useAssetBrowserStore.getState();
    expect(downloads).toHaveLength(1);
    expect(downloads[0].assetId).toBe('brick-wall-01');
    expect(downloads[0].name).toBe('Brick Wall');
    expect(downloads[0].status).toBe('downloading');
    expect(downloads[0].progress).toBe(0);
  });

  it('updates a download', () => {
    useAssetBrowserStore.getState().addDownload('tex-01', 'Texture');
    useAssetBrowserStore.getState().updateDownload('tex-01', { progress: 75, status: 'downloading' });

    const dl = useAssetBrowserStore.getState().downloads[0];
    expect(dl.progress).toBe(75);
    expect(dl.status).toBe('downloading');
  });

  it('removes a download', () => {
    useAssetBrowserStore.getState().addDownload('tex-01', 'Texture');
    useAssetBrowserStore.getState().removeDownload('tex-01');
    expect(useAssetBrowserStore.getState().downloads).toHaveLength(0);
  });
});
