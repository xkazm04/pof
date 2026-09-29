import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('@/lib/download', () => ({ downloadBlob: vi.fn() }));

import { downloadBlob } from '@/lib/download';
import { BrowsePanel } from '@/components/modules/visual-gen/asset-browser/BrowsePanel';
import { LibraryAssetCard } from '@/components/modules/visual-gen/asset-browser/LibraryAssetCard';
import { useAssetBrowserStore } from '@/components/modules/visual-gen/asset-browser/useAssetBrowserStore';
import { useAssetLibraryStore } from '@/components/modules/visual-gen/asset-browser/useAssetLibraryStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { ambientCgVariants, polyHavenVariants, type PolyHavenFiles } from '@/lib/visual-gen/download-variants';
import { formatBytes } from '@/lib/format';
import type { AssetSearchResult } from '@/lib/visual-gen/asset-sources';
import type { LibraryAsset } from '@/types/asset-library';

/**
 * cases 7 + 8 — Download opens a picker of the source's real files (format x resolution,
 * each with its size) instead of `window.open`ing a JSON listing; a pick saves THAT file and
 * the library records it. Opening the picker costs one listing fetch (Poly Haven) or none
 * (ambientCG: the variants rode in on the search row). A 1 GB zip is handed to the browser
 * as a direct download — never fetched into memory.
 */

const FIX = join(process.cwd(), 'src/__tests__/fixtures/asset-sources');
const read = (n: string) => readFileSync(join(FIX, n), 'utf8');
const armchairVariants = polyHavenVariants(JSON.parse(read('ph-files-ArmChair_01.json')) as PolyHavenFiles, 'models');
const groundRow = JSON.parse(read('acg-search-Ground112.json')).foundAssets[0];
const groundVariants = ambientCgVariants(groundRow);
const GLTF_2K = 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/ArmChair_01/ArmChair_01_2k.gltf';

const armchair: AssetSearchResult = {
  id: 'ArmChair_01', name: 'Arm Chair 01', source: 'polyhaven', category: 'models',
  thumbnailUrl: '', downloadUrl: 'https://api.polyhaven.com/files/ArmChair_01', license: 'CC0', tags: [],
};
const ground: AssetSearchResult = {
  id: 'Ground112', name: 'Ground 112', source: 'ambientcg', category: 'materials', thumbnailUrl: '',
  downloadUrl: groundVariants[0].mainUrl, license: 'CC0', tags: [], variants: groundVariants,
};

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let filesFail: string | null;
let anchorHrefs: string[];
let openSpy: MockInstance<typeof window.open>;

const ok = (data: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
const libRow = (over: Partial<LibraryAsset> = {}): LibraryAsset => ({
  id: 'lib-1', assetId: 'ArmChair_01', name: 'Arm Chair 01', source: 'polyhaven', category: 'models',
  license: 'CC0', thumbnailUrl: '', downloadUrl: GLTF_2K, tags: [], favorite: false, collectionIds: [], createdAt: 1, ...over,
});

beforeEach(() => {
  calls = []; filesFail = null; anchorHrefs = [];
  vi.mocked(downloadBlob).mockReset();
  useAssetBrowserStore.setState({
    query: '', activeSource: 'polyhaven', activeCategory: 'models', results: [], isSearching: false,
    isImporting: null, downloads: [], error: null, hasSearched: true, importError: null, variantLists: {},
  });
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
  useAssetLibraryStore.setState({ assets: [], collections: [], loaded: true, isLoading: false, error: null });
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('/api/visual-gen/browse/files')) {
      return filesFail
        ? { ok: false, status: 502, json: () => Promise.resolve({ success: false, error: filesFail }) }
        : ok({ variants: armchairVariants });
    }
    if (url === '/api/visual-gen/library') return ok(libRow());
    if (url.startsWith('https://dl.polyhaven.org/')) {
      // The captured .gltf is the 1k one; the 2k document is the same with _2k texture names.
      const res = /_(\d+k)\.gltf$/.exec(url)?.[1] ?? '1k';
      const body = url.endsWith('.gltf') ? read('ArmChair_01_1k.gltf.json').replaceAll('_1k.jpg', `_${res}.jpg`) : 'bytes';
      return { ok: true, status: 200, text: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob([body])) };
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as unknown as typeof fetch;
  openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchorHrefs.push(this.href);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const libraryPosts = () => calls.filter((c) => c.url === '/api/visual-gen/library' && c.init?.method === 'POST');
const blobText = (b: Blob) => new Promise<string>((resolve) => {
  const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b);
});

describe('case 7 — Download opens a file picker, a pick acquires that file', () => {
  it('opening the Poly Haven picker issues only the one listing fetch and shows every size', async () => {
    useAssetBrowserStore.setState({ results: [armchair] });
    render(<BrowsePanel />);
    fireEvent.click(screen.getByLabelText('Download Arm Chair 01'));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: /2K glTF/ });
    expect(calls.map((c) => c.url)).toEqual(['/api/visual-gen/browse/files?source=polyhaven&id=ArmChair_01&category=models']);
    expect(openSpy).not.toHaveBeenCalled();
    expect(anchorHrefs).toEqual([]);
    for (const v of armchairVariants) {
      expect(within(dialog).getByRole('button', { name: new RegExp(v.label) }).textContent).toContain(formatBytes(v.totalBytes));
    }
  });

  it("choosing '2K glTF' saves the flat bundle and records the .gltf on dl.polyhaven.org", async () => {
    useAssetBrowserStore.setState({ results: [armchair] });
    render(<BrowsePanel />);
    fireEvent.click(screen.getByLabelText('Download Arm Chair 01'));
    fireEvent.click(await screen.findByRole('button', { name: /2K glTF/ }));

    await waitFor(() => expect(libraryPosts()).toHaveLength(1));
    expect(JSON.parse(String(libraryPosts()[0].init!.body)).downloadUrl).toBe(GLTF_2K);
    const v2k = armchairVariants[1];
    const saved = vi.mocked(downloadBlob).mock.calls.map(([, name]) => name);
    expect(saved.sort()).toEqual(v2k.files.map((f) => f.path).sort());
    const gltfBlob = vi.mocked(downloadBlob).mock.calls.find(([, n]) => n.endsWith('.gltf'))![0];
    const gltfText = await blobText(gltfBlob);
    expect(gltfText).not.toMatch(/"uri":\s*"textures\//);
    expect(gltfText).toContain('"uri":"Armchair_01_diff_2k.jpg"');
    expect(openSpy.mock.calls.some(([u]) => String(u).includes('api.polyhaven.com'))).toBe(false);
    expect(calls.some((c) => c.url.includes('api.polyhaven.com'))).toBe(false);
  });

  it('a failed listing fetch renders the reason with a retry and records nothing', async () => {
    filesFail = 'Poly Haven files API error: 503';
    useAssetBrowserStore.setState({ results: [armchair] });
    render(<BrowsePanel />);
    fireEvent.click(screen.getByLabelText('Download Arm Chair 01'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/503/);
    expect(within(alert).getByRole('button', { name: /Retry/ })).toBeTruthy();
    expect(libraryPosts()).toHaveLength(0);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('ambientCG: 0 fetches to open; 8K-PNG (1.09 GB) is a direct browser download, never fetched', async () => {
    useAssetBrowserStore.setState({ activeSource: 'ambientcg', activeCategory: 'materials', results: [ground] });
    render(<BrowsePanel />);
    fireEvent.click(screen.getByLabelText('Download Ground 112'));

    const dialog = await screen.findByRole('dialog');
    expect(calls).toEqual([]);
    expect(openSpy).not.toHaveBeenCalled();
    expect(anchorHrefs).toEqual([]);
    for (const v of groundVariants) {
      expect(within(dialog).getByRole('button', { name: new RegExp(`^${v.label}`) }).textContent).toContain(formatBytes(v.totalBytes));
    }

    fireEvent.click(within(dialog).getByRole('button', { name: /^8K-PNG/ }));
    const url8k = 'https://ambientcg.com/get?file=Ground112_8K-PNG.zip';
    await waitFor(() => expect(libraryPosts()).toHaveLength(1));
    const started = [...anchorHrefs, ...openSpy.mock.calls.map(([u]) => String(u))];
    expect(started).toEqual([url8k]);
    expect(calls.filter((c) => c.url.includes('ambientcg.com'))).toHaveLength(0);
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(JSON.parse(String(libraryPosts()[0].init!.body)).downloadUrl).toBe(url8k);
  });
});

describe('case 8 — a legacy library row that points at a listing', () => {
  it('offers Choose a file instead of linking to the JSON, and opens the picker for that asset', async () => {
    const legacy = libRow({ assetId: 'Barrel_01', name: 'Barrel 01', downloadUrl: 'https://api.polyhaven.com/files/Barrel_01' });
    const { container } = render(<LibraryAssetCard asset={legacy} collections={[]} />);
    expect(container.querySelector('a[href="https://api.polyhaven.com/files/Barrel_01"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Choose a file/ }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual([
      '/api/visual-gen/browse/files?source=polyhaven&id=Barrel_01&category=models',
    ]));
  });

  it('[guard] a row holding a real file keeps its link', () => {
    render(<LibraryAssetCard asset={libRow()} collections={[]} />);
    expect(screen.getByRole('link', { name: /Open download for Arm Chair 01/ }).getAttribute('href')).toBe(GLTF_2K);
  });
});
