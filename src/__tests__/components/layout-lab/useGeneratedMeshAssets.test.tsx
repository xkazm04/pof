import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const tryApiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({
  tryApiFetch: (...a: unknown[]) => tryApiFetch(...a),
}));

const { useGeneratedMeshAssets } = await import('@/components/layout-lab/steps/shared/useGeneratedMeshAssets');

/** Each mesh ref carries the artifact identity its filename encodes, so a 3D step can scope on it. */
describe('useGeneratedMeshAssets', () => {
  beforeEach(() => tryApiFetch.mockReset());

  it('stamps each ref with its identity slug (retry suffix stripped) and keeps the provider tag in the name', async () => {
    tryApiFetch.mockResolvedValue({
      ok: true,
      data: {
        assets: [{
          name: 'character_3d_generation_a2.glb', provider: 'tripo3d', providerLabel: 'Tripo3D (cloud)',
          url: '/api/visual-gen/asset/character_3d_generation_a2.glb?dir=tripo3d', previewUrl: null,
          sizeBytes: 1, mtimeMs: 1, attempt: 2,
        }],
      },
    });
    const { result } = renderHook(() => useGeneratedMeshAssets(true));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].slug).toBe('character_3d_generation');
    expect(result.current[0].name).toBe('character_3d_generation_a2 · tripo3d');
    expect(result.current[0].url).toBe('/api/visual-gen/asset/character_3d_generation_a2.glb?dir=tripo3d');
  });

  it('does not fetch when disabled', () => {
    const { result } = renderHook(() => useGeneratedMeshAssets(false));
    expect(result.current).toEqual([]);
    expect(tryApiFetch).not.toHaveBeenCalled();
  });
});
