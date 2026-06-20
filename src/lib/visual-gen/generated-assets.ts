/** Pure helpers for the /3d studio's generated-asset gallery + serving route. */

export interface GeneratedAsset {
  name: string;
  sizeBytes: number;
  mtimeMs: number;
  url: string;
  previewUrl: string | null;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(glb|gltf|png)$/;

/** A safe basename to read from the whitelisted generated dir, or null. Pure. */
export function safeAssetName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return NAME_RE.test(name) ? name : null;
}

/** Shape the gallery list: each .glb → its serving url + sibling preview (if present), newest first. Pure. */
export function buildAssetList(
  glb: { name: string; sizeBytes: number; mtimeMs: number }[],
  previewNames: Set<string>,
): GeneratedAsset[] {
  return glb
    .map((g) => {
      const previewName = g.name.replace(/\.glb$/i, '.preview.png');
      return {
        name: g.name,
        sizeBytes: g.sizeBytes,
        mtimeMs: g.mtimeMs,
        url: `/api/visual-gen/asset/${encodeURIComponent(g.name)}`,
        previewUrl: previewNames.has(previewName) ? `/api/visual-gen/asset/${encodeURIComponent(previewName)}` : null,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}
