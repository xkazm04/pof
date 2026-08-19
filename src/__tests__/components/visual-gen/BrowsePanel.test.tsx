import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowsePanel } from '@/components/modules/visual-gen/asset-browser/BrowsePanel';
import { useAssetBrowserStore } from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';

/**
 * `BrowsePanel.handleSearch` contained a literal `} catch { // Silent fail }` and only set
 * results when `json.success` was true, with no else — so a failed search rendered "Click
 * Search to browse free CC0 assets.", indistinguishable from "found nothing" and from
 * "never searched". Beside it, a Sketchfab chip was offered that this route answers with
 * `400 Unknown source`.
 *
 * These tests pin: a failure states its reason with a retry; an empty result renders the
 * EMPTY state; the chip list matches the implemented sources.
 */

afterEach(cleanup);

function asset(over: Partial<AssetSearchResult> = {}): AssetSearchResult {
  return {
    id: 'a1', name: 'Wood Planks', source: 'polyhaven', category: 'textures',
    thumbnailUrl: '', downloadUrl: 'https://dl', license: 'CC0', tags: ['wood'], ...over,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAssetBrowserStore.setState({
    query: '', activeSource: 'polyhaven', activeCategory: 'textures',
    results: [], isSearching: false, isImporting: null, downloads: [],
    error: null, hasSearched: false, importError: null,
  });
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
  useAssetLibraryStore.setState({ assets: [], collections: [], loaded: true, isLoading: false, error: null });
});

function mockFetch(impl: () => Promise<unknown>) {
  globalThis.fetch = vi.fn().mockImplementation(impl) as unknown as typeof fetch;
}

const okJson = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
const errJson = (error: string) => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ success: false, error }) });

describe('BrowsePanel — a failed search is visible', () => {
  it('renders the reason and a retry when the request rejects (was: silent catch)', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Search failed/);
    expect(alert.textContent).toMatch(/ECONNREFUSED/);
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
    // The "never searched" copy must NOT be what a failure shows.
    expect(screen.queryByText(/Click Search to browse free CC0 assets/)).toBeNull();
  });

  it('renders the reason when the route answers a failure envelope', async () => {
    mockFetch(() => errJson('Unknown source: sketchfab. This route serves polyhaven and ambientcg'));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/Unknown source: sketchfab/);
  });

  it('retry re-issues the search and clears the error on success', async () => {
    let fail = true;
    mockFetch(() => (fail ? errJson('upstream 502') : okJson([asset()])));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    await screen.findByRole('alert');

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Wood Planks')).toBeTruthy();
  });

  it('an EMPTY result renders the empty state, not an error', async () => {
    mockFetch(() => okJson([]));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));

    expect(await screen.findByText(/No CC0 assets matched/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('before any search, the copy says so — distinct from both empty and failed', () => {
    render(<BrowsePanel />);
    expect(screen.getByText(/Click Search to browse free CC0 assets/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a failure does not leave hasSearched set, so the empty state cannot claim "found nothing"', async () => {
    mockFetch(() => errJson('boom'));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    await screen.findByRole('alert');

    expect(useAssetBrowserStore.getState().hasSearched).toBe(false);
    expect(screen.queryByText(/No CC0 assets matched/)).toBeNull();
  });

  it('reports a failed Blender import instead of swallowing it', async () => {
    useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: true } });
    mockFetch(() => errJson('Blender is not connected'));
    useAssetBrowserStore.setState({ results: [asset()], hasSearched: true });
    render(<BrowsePanel />);

    fireEvent.click(screen.getByLabelText('Import Wood Planks to Blender'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Blender import failed/);
    expect(alert.textContent).toMatch(/not connected/);
  });
});

describe('BrowsePanel — the chips match the implemented sources', () => {
  it('offers no Sketchfab chip (this route answers 400 for it)', () => {
    render(<BrowsePanel />);
    expect(screen.getByRole('button', { name: 'Poly Haven' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ambientCG' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sketchfab' })).toBeNull();
  });

  it('every source chip is one the store can actually search', () => {
    render(<BrowsePanel />);
    const IMPLEMENTED = ['Poly Haven', 'ambientCG'];
    for (const label of IMPLEMENTED) expect(screen.getByRole('button', { name: label })).toBeTruthy();
    // 3D Models is a Poly Haven category; it must not be a dangling Sketchfab-only tab.
    expect(screen.getByRole('button', { name: '3D Models' })).toBeTruthy();
  });

  it('switching source clears results AND the searched flag, so stale copy cannot linger', async () => {
    mockFetch(() => okJson([]));
    render(<BrowsePanel />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    await screen.findByText(/No CC0 assets matched/);

    fireEvent.click(screen.getByRole('button', { name: 'ambientCG' }));
    expect(screen.getByText(/Click Search to browse free CC0 assets/)).toBeTruthy();
  });
});
