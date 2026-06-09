import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { LibraryPanel } from '@/components/modules/visual-gen/asset-browser/LibraryPanel';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import type { LibraryAsset } from '@/types/asset-library';

afterEach(cleanup);

function libAsset(over: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    id: 'lib-1', assetId: 'src-1', name: 'Wood Planks', source: 'polyhaven',
    category: 'textures', license: 'CC0', thumbnailUrl: '', downloadUrl: 'https://dl',
    tags: ['wood'], favorite: false, collectionIds: [], createdAt: 1, ...over,
  };
}

beforeEach(() => {
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
  useAssetLibraryStore.setState({
    assets: [], collections: [],
    filter: { source: 'all', category: 'all', favoritesOnly: false, collectionId: null, query: '' },
    loaded: false, isLoading: false, error: null,
  });
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true, status: 200, json: () => Promise.resolve({ success: true, data: [] }),
  }) as unknown as typeof fetch;
});

describe('LibraryPanel', () => {
  it('renders search, source filters, sidebar, and an empty state', async () => {
    render(<LibraryPanel />);
    expect(screen.getByLabelText('Search library')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Poly Haven' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /All assets/ })).toBeTruthy();
    expect(await screen.findByText(/library is empty/i)).toBeTruthy();
  });

  it('renders a tracked asset with a favorite toggle and download link', () => {
    useAssetLibraryStore.setState({ assets: [libAsset()], loaded: true });
    render(<LibraryPanel />);
    expect(screen.getByText('Wood Planks')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Favorite Wood Planks/i })).toBeTruthy();
    const link = screen.getByRole('link', { name: /Open download for Wood Planks/i });
    expect(link.getAttribute('href')).toBe('https://dl');
  });

  it('shows the favorites count in the sidebar', () => {
    useAssetLibraryStore.setState({
      assets: [libAsset({ id: 'a', favorite: true }), libAsset({ id: 'b', favorite: false })],
      loaded: true,
    });
    render(<LibraryPanel />);
    const favBtn = screen.getByRole('button', { name: /Favorites/ });
    expect(favBtn.textContent).toMatch(/1/);
  });
});
