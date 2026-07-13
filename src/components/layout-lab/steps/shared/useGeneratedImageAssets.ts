'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

/**
 * Pre-fetch the manifest of real generated image thumbnails for a gallery step, so a
 * `GenCandidatesSpec.build` (which must stay synchronous) can surface real assets.
 *
 * Reuses the existing read-only `/api/visual-gen/assets` route (no new endpoint): it
 * lists the generated TripoSR meshes with their sibling preview PNGs; we take the
 * preview images (real served URLs) as 2D thumbnails. When the dir is empty the route
 * returns `{ assets: [] }`, so this resolves to `[]` and the generator falls back to
 * the honest swatch preview.
 *
 * `enabled` gates the fetch so the ~330 steps that don't request assets never call it.
 * Returns `[]` until (and unless) the fetch resolves with previews.
 */
export function useGeneratedImageAssets(enabled: boolean): GenAssetRef[] {
  const [assets, setAssets] = useState<GenAssetRef[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const res = await tryApiFetch<{ assets: GeneratedAsset[] }>('/api/visual-gen/assets');
      if (!live || !res.ok) return;
      setAssets(
        res.data.assets
          .filter((a): a is GeneratedAsset & { previewUrl: string } => a.previewUrl != null)
          .map((a) => ({ name: a.name.replace(/\.glb$/i, ''), url: a.previewUrl })),
      );
    })();
    return () => { live = false; };
  }, [enabled]);

  return assets;
}
