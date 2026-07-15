'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';
import type { GenAssetRef } from '@/lib/catalog/stepSpec';

/**
 * Pre-fetch the manifest of real generated `.glb` meshes for a 3D gallery step, so a
 * `GenCandidatesSpec.build` (which must stay synchronous) can surface real meshes.
 *
 * Reuses the read-only `/api/visual-gen/assets` route (no new endpoint): every entry
 * it lists is a served TripoSR `.glb`, so — unlike the 2D image hook — we keep ALL of
 * them (a mesh needn't have a sibling preview PNG) and carry each asset's `.glb`
 * serving `url`. `meshGalleryCandidates` puts that url in `payload.glbUrl` so selecting
 * a candidate renders the real mesh in the interactive GlbViewer.
 *
 * When the dir is empty the route returns `{ assets: [] }`, so this resolves to `[]`
 * and the generator falls back to the honest deterministic swatch (no fake 3D preview).
 *
 * `enabled` gates the fetch so steps that don't request 3D assets never call it.
 */
export function useGeneratedMeshAssets(enabled: boolean): GenAssetRef[] {
  const [assets, setAssets] = useState<GenAssetRef[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const res = await tryApiFetch<{ assets: GeneratedAsset[] }>('/api/visual-gen/assets');
      if (!live || !res.ok) return;
      setAssets(
        res.data.assets.map((a) => ({ name: a.name.replace(/\.glb$/i, ''), url: a.url })),
      );
    })();
    return () => { live = false; };
  }, [enabled]);

  return assets;
}
