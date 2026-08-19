'use client';

import type { GenAssetRef } from '@/lib/catalog/stepSpec';
import type { LabTheme } from '../../theme';
import type { GenCandidate } from './genHistory';

/**
 * The two honesty affordances every bespoke Items preview panel owes the operator, in the
 * exact wording the generic renderer already uses (`ArchetypeStep.tsx` gallery panel), so
 * the reference pipeline and the ~330 generic steps make the SAME claim about the SAME
 * kind of thing.
 *
 * Before this, each bespoke panel painted a fabrication as output: a CSS gradient captioned
 * `◈ LOD0 preview`, four literal hex constants standing in for Albedo/Normal/ORM/Height,
 * and a green `✓ /Game/Items/…/SM_IronLongsword` for a file nothing had written.
 */

/** The honest fallback line — a deterministic swatch is a SEED PREVIEW, never the output. */
export const SEED_PREVIEW_CAPTION = 'Deterministic seed preview — not the generated asset.';

/**
 * Names what the preview beside it actually is. An `imageUrl` is only ever set by
 * `withGeneratedImages` from THIS step's own matched art (the generator's filename rule is
 * re-encoded, never split), so the "real" claim names the file it is showing.
 */
export function GeneratedAssetCaption({ t, selected, placeholder = SEED_PREVIEW_CAPTION }: {
  t: LabTheme;
  selected: GenCandidate | null;
  placeholder?: string;
}) {
  return (
    <span data-testid="gallery-selected-caption" style={{ fontSize: 14, color: t.muted, lineHeight: 1.55 }}>
      {selected?.imageUrl
        ? `Real generated asset for this step: ${selected.caption ?? 'generated image'}`
        : placeholder}
    </span>
  );
}

/**
 * Attach the step's OWN generated art to the first `min(candidates, assets)` slots of a
 * bespoke batch — the bespoke counterpart to `imageGalleryCandidates`.
 *
 * Why an overlay rather than that shared generator: `imageGalleryCandidates` also OWNS the
 * payload (`{ [field]: i }`), and the three bespoke Items generators carry payloads their
 * checkers actually read (`{ selected }`, `{ tris, cap }`, `{ maps }`). Overlaying leaves
 * every payload byte-identical, so this cannot change what a checker reads off the
 * projected artifact.
 *
 * HONEST counts, exactly as the generic path: only as many slots as there are real files
 * carry an `imageUrl` — one generated icon means ONE real thumbnail and the rest honest
 * deterministic swatches, never the same image repeated to fill the grid. An empty
 * manifest returns the batch untouched (same reference). Pure.
 */
export function withGeneratedImages(
  batch: Omit<GenCandidate, 'id'>[],
  assets: GenAssetRef[],
  seq: number,
): Omit<GenCandidate, 'id'>[] {
  if (assets.length === 0) return batch;
  const real = Math.min(batch.length, assets.length);
  return batch.map((c, i) => {
    if (i >= real) return c;
    const asset = assets[(seq + i) % assets.length];
    // Keep the generator's own caption (e.g. "4200 tris") and name the file beside it —
    // the caption is what the gallery and the Selected panel quote as evidence.
    return { ...c, imageUrl: asset.url, caption: c.caption ? `${c.caption} · ${asset.name}` : asset.name };
  });
}

/** An asset PATH is a TARGET the drain writes — never evidence that a file exists. */
export function AssetTarget({ t, path }: { t: LabTheme; path: string }) {
  return (
    <span data-testid="asset-target" className={t.fontMono} style={{ fontSize: 14, color: t.ok }}>
      ✓ asset target: {path} <span style={{ color: t.muted }}>(written by the drain)</span>
    </span>
  );
}
