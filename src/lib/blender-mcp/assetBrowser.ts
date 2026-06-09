import type { Result } from '@/types/result';
import type { AssetResult, AssetSource } from './types';

/**
 * Pure helpers for the visual Asset Browser (PolyHaven + Sketchfab).
 *
 * Kept DOM-free and side-effect-free so the parallel-search merge and the
 * catalog of PolyHaven categories/resolutions can be unit-tested without a
 * Blender connection. The stateful orchestration lives in `useAssetBrowser`.
 */

// ─── PolyHaven facets ─────────────────────────────────────────────────────────

/** Download resolutions PolyHaven exposes (texture/model maps). */
export const POLYHAVEN_RESOLUTIONS = ['1k', '2k', '4k', '8k'] as const;
export type PolyHavenResolution = (typeof POLYHAVEN_RESOLUTIONS)[number];
export const DEFAULT_POLYHAVEN_RESOLUTION: PolyHavenResolution = '1k';

/**
 * Curated category chips that filter the PolyHaven half of a search. Sketchfab
 * has no comparable taxonomy in the addon API, so chips scope PolyHaven only.
 */
export const POLYHAVEN_CATEGORIES = [
  'nature',
  'furniture',
  'rock',
  'wood',
  'metal',
  'fabric',
  'building',
  'terrain',
] as const;

// ─── Identity ─────────────────────────────────────────────────────────────────

/** Stable React/grid key — id can collide across sources, source can't. */
export function assetKey(asset: Pick<AssetResult, 'source' | 'id'>): string {
  return `${asset.source}:${asset.id}`;
}

// ─── Parallel-search merge ────────────────────────────────────────────────────

export interface AssetSearchOutcome {
  /** Combined, de-duplicated results from every source that succeeded. */
  assets: AssetResult[];
  /** One source failed but the other returned results (soft, non-blocking). */
  warning: string | null;
  /** Every source failed — there is nothing to show (hard error). */
  error: string | null;
}

const SOURCE_LABEL: Record<AssetSource, string> = {
  polyhaven: 'PolyHaven',
  sketchfab: 'Sketchfab',
};

/**
 * Fold the two parallel source searches into a single outcome.
 *
 * - Both succeed → merged assets, no error.
 * - One fails → the survivor's assets plus a soft `warning` naming the failure.
 * - Both fail → empty assets and a combined `error` so the UI degrades loudly.
 *
 * De-dupes on {@link assetKey} so a source returning overlapping ids can't
 * produce duplicate cards.
 */
export function mergeAssetResults(
  polyhaven: Result<AssetResult[], string>,
  sketchfab: Result<AssetResult[], string>,
): AssetSearchOutcome {
  const seen = new Set<string>();
  const assets: AssetResult[] = [];
  const push = (list: AssetResult[]) => {
    for (const a of list) {
      const key = assetKey(a);
      if (seen.has(key)) continue;
      seen.add(key);
      assets.push(a);
    }
  };
  if (polyhaven.ok) push(polyhaven.data);
  if (sketchfab.ok) push(sketchfab.data);

  const failures: string[] = [];
  if (!polyhaven.ok) failures.push(`${SOURCE_LABEL.polyhaven}: ${polyhaven.error}`);
  if (!sketchfab.ok) failures.push(`${SOURCE_LABEL.sketchfab}: ${sketchfab.error}`);

  if (failures.length === 2) {
    return { assets: [], warning: null, error: failures.join(' · ') };
  }
  if (failures.length === 1) {
    return { assets, warning: failures[0], error: null };
  }
  return { assets, warning: null, error: null };
}
