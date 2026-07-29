import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { StepLibraryPicker } from '@/components/layout-lab/steps/shared/StepLibraryPicker';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { LibraryAsset } from '@/types/asset-library';

const t = LAB_THEMES[0];

const asset = (over: Partial<LibraryAsset> = {}): LibraryAsset => ({
  id: 'a1', assetId: 'rocky', name: 'Rocky Terrain', source: 'polyhaven', category: 'textures',
  license: 'CC0', thumbnailUrl: '', downloadUrl: 'https://x/d.zip', tags: [], favorite: false,
  collectionIds: [], createdAt: 0, ...over,
});

function stubLibrary(assets: LibraryAsset[]) {
  const f = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ success: true, data: assets }) }));
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

const renderPicker = (referencedIds: string[] = []) => {
  const onPick = vi.fn();
  const onUnpick = vi.fn();
  render(<StepLibraryPicker t={t} referencedIds={referencedIds} onPick={onPick} onUnpick={onUnpick} />);
  return { onPick, onUnpick };
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('<StepLibraryPicker />', () => {
  it('reads the library only once opened', () => {
    const f = stubLibrary([asset()]);
    renderPicker();
    expect(f).not.toHaveBeenCalled();
  });

  it('says the library is empty rather than implying a bundled catalogue', async () => {
    stubLibrary([]);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    const empty = await screen.findByTestId('step-library-empty');
    expect(empty.textContent).toMatch(/library is empty/i);
    expect(empty.textContent).toMatch(/Asset Browser/i);
  });

  it('distinguishes "nothing downloaded" from "nothing matches the filter"', async () => {
    stubLibrary([]);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    await screen.findByTestId('step-library-empty');

    fireEvent.change(screen.getByPlaceholderText('Search the library…'), { target: { value: 'zzz' } });
    await waitFor(() =>
      expect(screen.getByTestId('step-library-empty').textContent).toMatch(/matches that filter/i));
  });

  it('shows each asset’s license on the row, before it is picked', async () => {
    stubLibrary([asset({ license: 'CC-BY-4.0' })]);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    expect((await screen.findByTestId('step-library-license')).textContent).toBe('CC-BY-4.0');
  });

  it('flags an asset with no recorded license instead of leaving the field blank', async () => {
    stubLibrary([asset({ license: '' })]);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    expect((await screen.findByTestId('step-library-license')).textContent).toMatch(/not recorded/i);
  });

  it('picks an asset', async () => {
    stubLibrary([asset()]);
    const { onPick } = renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    fireEvent.click(await screen.findByTestId('step-library-pick'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('shows an already-referenced asset as referenced, and unpicks it', async () => {
    stubLibrary([asset()]);
    const { onUnpick } = renderPicker(['a1']);
    fireEvent.click(screen.getByTestId('step-library-toggle'));

    const row = await screen.findByTestId('step-library-row');
    expect(row.getAttribute('data-picked')).toBe('true');
    fireEvent.click(screen.getByTestId('step-library-unpick'));
    expect(onUnpick).toHaveBeenCalledWith('a1');
  });

  it('forwards the search text and category to the library query', async () => {
    const f = stubLibrary([asset()]);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));
    await screen.findByTestId('step-library-row');

    fireEvent.change(screen.getByTestId('step-library-category'), { target: { value: 'models' } });
    await waitFor(() => {
      const urls = f.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('category=models'))).toBe(true);
    });
  });

  it('surfaces a read failure with a retry rather than an empty library', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, json: async () => ({ success: false, error: 'library table missing' }),
    })) as unknown as typeof fetch);
    renderPicker();
    fireEvent.click(screen.getByTestId('step-library-toggle'));

    expect(await screen.findByText(/library table missing/)).toBeTruthy();
    expect(screen.queryByTestId('step-library-empty')).toBeNull();
  });
});
