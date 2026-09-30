/**
 * Asset Inventory edges: UE's declared references over name guesses.
 *
 * `/api/filesystem/scan-assets` lists Content/ files and GUESSES edges from
 * shared base names (`inferDependencies`). When PoF Bridge is connected, the
 * manifest carries what UE itself recorded - every entry's `crossReferences`
 * and a material's `textureReferences`. This module (pure, client-safe) joins
 * the two on ONE key and tags every edge with where it came from:
 *
 *   'declared' - read from the manifest (UE-declared)
 *   'inferred' - guessed from asset names by the scan route
 *
 * A guess is never presented as declared, and for an asset the manifest
 * covers, the declared set replaces the guesses outright.
 */
import type { AssetDependencyEdge, ScannedAsset } from '@/app/api/filesystem/scan-assets/route';
import type { AssetManifest } from '@/types/pof-bridge';

export type EdgeProvenance = 'declared' | 'inferred';

export interface InventoryEdge extends AssetDependencyEdge {
  provenance: EdgeProvenance;
}

export interface DeclaredEdgeResult {
  edges: InventoryEdge[];
  /** Declared references with no scanned file at one end (not drawn). */
  unresolvedRefs: number;
}

export type InventoryReconcile =
  | { available: false }
  | {
      available: true;
      /** Scanned files whose content key is no manifest entry's path. */
      notInManifest: ScannedAsset[];
      /** /Game manifest entry paths (as UE wrote them) with no scanned file. */
      missingOnDisk: string[];
    };

const GAME_ROOT = '/Game/';

/**
 * `/Game/X/Y` or `/Game/X/Y.Y` -> `X/Y` (the Content-relative key); any other
 * mount point (`/Engine/...`, plugin content) -> null: it is not under Content/.
 */
export function gamePathToContentKey(gamePath: string): string | null {
  if (!gamePath.startsWith(GAME_ROOT)) return null;
  const rest = gamePath.slice(GAME_ROOT.length);
  const slash = rest.lastIndexOf('/');
  const dot = rest.indexOf('.', slash + 1);
  const key = dot === -1 ? rest : rest.slice(0, dot);
  return key.length > 0 ? key : null;
}

/** `X/Y.uasset` / `X/Y.umap` -> `X/Y`, the key a /Game path maps to. */
export function contentKeyOf(asset: Pick<ScannedAsset, 'relativePath'>): string {
  return asset.relativePath.replace(/\.(uasset|umap)$/i, '');
}

/** UE package paths are case-insensitive; matching is too. */
const norm = (key: string) => key.toLowerCase();

interface ManifestEntryRefs {
  path: string;
  crossReferences: string[];
  textureReferences?: string[];
}

function manifestEntries(manifest: AssetManifest): ManifestEntryRefs[] {
  return [
    ...manifest.blueprints,
    ...manifest.materials,
    ...manifest.animAssets,
    ...manifest.dataTables,
    ...manifest.otherAssets,
  ];
}

/** Normalised content keys of every manifest entry. */
function coveredKeys(manifest: AssetManifest): Set<string> {
  const keys = new Set<string>();
  for (const entry of manifestEntries(manifest)) {
    const key = gamePathToContentKey(entry.path);
    if (key) keys.add(norm(key));
  }
  return keys;
}

function assetsByKey(assets: ScannedAsset[]): Map<string, ScannedAsset> {
  const byKey = new Map<string, ScannedAsset>();
  for (const a of assets) {
    const key = norm(contentKeyOf(a));
    if (!byKey.has(key)) byKey.set(key, a);
  }
  return byKey;
}

/**
 * The manifest's references as edges between scanned files, keyed by
 * relativePath like the scan's own edges. `textureReferences` become
 * 'uses-texture', `crossReferences` 'references' (a target listed in both is
 * one 'uses-texture' edge). A reference whose source or target has no scanned
 * file is counted in `unresolvedRefs`, never drawn.
 */
export function declaredEdges(manifest: AssetManifest, assets: ScannedAsset[]): DeclaredEdgeResult {
  const byKey = assetsByKey(assets);
  const edges: InventoryEdge[] = [];
  const seen = new Set<string>();
  let unresolvedRefs = 0;

  const add = (from: ScannedAsset | undefined, ref: string, relation: InventoryEdge['relation']) => {
    const toKey = gamePathToContentKey(ref);
    const to = toKey ? byKey.get(norm(toKey)) : undefined;
    if (!from || !to) { unresolvedRefs++; return; }
    if (to.relativePath === from.relativePath) return;
    const id = `${from.relativePath}|${to.relativePath}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ from: from.relativePath, to: to.relativePath, relation, provenance: 'declared' });
  };

  for (const entry of manifestEntries(manifest)) {
    const key = gamePathToContentKey(entry.path);
    const from = key ? byKey.get(norm(key)) : undefined;
    for (const ref of entry.textureReferences ?? []) add(from, ref, 'uses-texture');
    for (const ref of entry.crossReferences) add(from, ref, 'references');
  }
  return { edges, unresolvedRefs };
}

/**
 * The inventory's edge set. An asset the manifest covers keeps ONLY its
 * declared out-edges (UE's list is the truth, including an empty one); an
 * asset it does not cover keeps the route's name guesses, tagged 'inferred'.
 * With no manifest, every edge is the route's guess, 1:1.
 */
export function mergeInventoryEdges(
  inferred: AssetDependencyEdge[],
  declared: InventoryEdge[],
  manifest: AssetManifest | null,
): InventoryEdge[] {
  const tagged = (e: AssetDependencyEdge): InventoryEdge => ({ ...e, provenance: 'inferred' });
  if (!manifest) return inferred.map(tagged);
  const covered = coveredKeys(manifest);
  const guesses = inferred
    .filter((e) => !covered.has(norm(contentKeyOf({ relativePath: e.from }))))
    .map(tagged);
  return [...declared, ...guesses];
}

/** What the scan and the manifest disagree on; unavailable without a manifest. */
export function reconcileInventory(assets: ScannedAsset[], manifest: AssetManifest | null): InventoryReconcile {
  if (!manifest) return { available: false };
  const covered = coveredKeys(manifest);
  const byKey = assetsByKey(assets);
  const notInManifest = assets.filter((a) => !covered.has(norm(contentKeyOf(a))));
  const missingOnDisk = manifestEntries(manifest)
    .map((e) => e.path)
    .filter((p) => {
      const key = gamePathToContentKey(p);
      // A non-/Game entry (engine or plugin content) is not expected under Content/.
      return key !== null && !byKey.has(norm(key));
    });
  return { available: true, notInManifest, missingOnDisk };
}
