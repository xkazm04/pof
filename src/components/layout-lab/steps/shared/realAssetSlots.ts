/**
 * THE rule for which real asset may fill a gallery slot — one module, used by every
 * generator that can surface real files (`imageGalleryCandidates`, the bespoke overlay
 * `withGeneratedImages`, `meshGalleryCandidates`).
 *
 * HONEST counts: at most `min(count, assets.length)` slots carry a real asset, rotated by
 * `seq` so a re-roll surfaces a different slice of a library larger than the grid. Every
 * other slot comes from the caller's `fill` (a deterministic swatch, or the untouched
 * bespoke candidate) — one real file is ONE real slot, never the same file repeated to fill
 * the grid as though several assets existed.
 *
 * WHICH assets are eligible is the caller's job and must already be identity-scoped: the
 * 2D manifest is resolved per (catalog, entity, step) server-side, and the 3D manifest is
 * filtered with `meshMatches` before it gets here. Pure + framework-free.
 */
export function slotRealAssets<A, T>(
  count: number,
  assets: readonly A[],
  seq: number,
  real: (asset: A, i: number) => T,
  fill: (i: number) => T,
): T[] {
  const n = Math.max(0, count);
  const realCount = Math.min(n, assets.length);
  return Array.from({ length: n }, (_, i) =>
    i < realCount ? real(assets[(seq + i) % assets.length], i) : fill(i),
  );
}
