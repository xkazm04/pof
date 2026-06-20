import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { AssetGallery } from '@/components/studio-3d/AssetGallery';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;
const ASSET = { name: 'chair.glb', sizeBytes: 1000, mtimeMs: 1, url: '/api/visual-gen/asset/chair.glb', previewUrl: null };

describe('AssetGallery', () => {
  it('lists generated assets and fires onPick on click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ assets: [ASSET] })));
    const onPick = vi.fn();
    render(<AssetGallery activeUrl={null} onPick={onPick} />);
    await waitFor(() => expect(screen.getByText('chair.glb')).toBeTruthy());
    fireEvent.click(screen.getByText('chair.glb'));
    expect(onPick).toHaveBeenCalledWith(ASSET);
  });

  it('shows the empty state when there are no assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ assets: [] })));
    render(<AssetGallery activeUrl={null} onPick={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No generated assets/i)).toBeTruthy());
  });
});
