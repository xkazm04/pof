/**
 * Icon-binding pass — the durability fix for the per-step generated 2D art library.
 *
 * `scripts/gap-loop/batch-generate.mjs` writes one gated image per `(catalogId, step)`
 * into `generated/icons/`, and the LAB already surfaces it: `ArchetypeStep` pre-fetches
 * `/api/visual-gen/icons?catalogId=&step=` and `imageGalleryCandidates` paints it over the
 * swatch. But the PERSISTED artifact never learned about it — a produce stub seeds
 * deterministic swatch candidates (`gallerySeed`), so `gradeGallerySelection` reports
 * `deferred` ("the selected candidate is a deterministic swatch preview") for a step whose
 * art demonstrably exists on disk. Every re-produce re-opened that hole, which is why the
 * map's media cells kept falling back to R4-waiting after each pipeline campaign.
 *
 * This pass closes it from the artifact side: for a gallery step whose SELECTED candidate
 * carries no real asset, bind the image that was generated FOR that exact step and re-grade.
 *
 * Honesty rules baked in — this can never manufacture a pass:
 *  - the file must EXIST and must match `iconSlug(catalogId, step)` by the generator's own
 *    filename rule (`generated-icons.ts`), so a step can only ever be bound to art made
 *    for it — never a sibling's, never a "closest match";
 *  - a candidate that already carries a real asset is left untouched;
 *  - an artifact with NO generation history is skipped (the "nothing was ever produced"
 *    deferral is a different, still-true claim — binding art onto an empty history would
 *    invent a batch that never ran);
 *  - the binding is DISCLOSED in the artifact data (`iconBinding`), so a reader of the raw
 *    artifact sees the image came from the library, not from this batch's generator run.
 *
 * Pure: no fs, no clock, no db. The caller supplies the icon url and the timestamp.
 */
import { readHistory, selectedCandidate, GEN_HISTORY_KEY, type GenHistory, type GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import { candidateAsset } from './galleryArtifact';

/** Additive provenance key written next to `genHistory` when art is bound from the library. */
export const ICON_BINDING_KEY = 'iconBinding';

export interface IconBinding {
  /** The candidate the image was attached to. */
  candidateId: string;
  /** Served url of the bound image (`/api/visual-gen/icon/<name>`). */
  url: string;
  /** ISO timestamp of the bind. */
  boundAt: string;
  /** Where the art came from — never "this batch's generator run". */
  source: 'generated/icons';
}

export type BindSkip =
  | 'no-history'      // nothing was ever produced — a different, still-true deferral
  | 'no-selection'    // the artifact selects nothing resolvable
  | 'already-real';   // the selected candidate already carries a generated asset

export interface BindResult {
  data: Record<string, unknown>;
  binding: IconBinding;
}

/**
 * Attach `iconUrl` to the artifact's selected candidate, or explain why not.
 * Returns the NEW data (input is never mutated) plus the disclosed binding.
 */
export function bindGeneratedIcon(
  data: Record<string, unknown>,
  iconUrl: string,
  boundAt: string,
): BindResult | { skipped: BindSkip } {
  const history = readHistory(data);
  if (history.batches.length === 0) return { skipped: 'no-history' };
  const cand = selectedCandidate(history);
  if (!cand) return { skipped: 'no-selection' };
  if (candidateAsset(cand) != null) return { skipped: 'already-real' };

  const bound: GenHistory = {
    ...history,
    batches: history.batches.map((b) => ({
      ...b,
      candidates: b.candidates.map((c: GenCandidate) => (c.id === cand.id ? { ...c, imageUrl: iconUrl } : c)),
    })),
  };
  const binding: IconBinding = { candidateId: cand.id, url: iconUrl, boundAt, source: 'generated/icons' };
  return { data: { ...data, [GEN_HISTORY_KEY]: bound, [ICON_BINDING_KEY]: binding }, binding };
}
