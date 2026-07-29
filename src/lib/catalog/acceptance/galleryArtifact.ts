import {
  appendBatch,
  emptyHistory,
  historyData,
  makeBatch,
  readHistory,
  selectedCandidate,
} from '@/components/layout-lab/steps/shared/genHistory';
import { genericGalleryCandidates } from '@/components/layout-lab/steps/shared/genericGalleryCandidates';
import type { GenCandidate } from '@/components/layout-lab/steps/shared/genHistory';
import type { AcceptanceResult } from './types';

/**
 * THE GALLERY ARTIFACT — the two faces of one contract, single-sourced.
 *
 * `gallerySeed` is what a gallery step's Produce stub writes; `gradeGallerySelection` is what
 * its Acceptance reads. They live together because the second is only honest if it can rely
 * on the shape of the first.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Every generative step in the fleet used to pass on the existence of an INTEGER. The whole
 * of `selected()` was `typeof v === 'number' && v >= 0`, so a gallery step went green whether
 * or not anything had ever been generated — 44 of the 47 registered gallery steps were
 * provably insensitive to any change in their own content (numeric-scaling and
 * string-replacement mutation over the live registry both left the verdict untouched).
 *
 * The data to grade on already exists on the artifact: `data.genHistory` holds every kept
 * re-roll batch, each candidate's swatch/`imageUrl`, and the selected candidate's payload.
 * So the verdict now examines the SELECTED CANDIDATE:
 *
 *  • a candidate carrying a REAL generated asset (a served `imageUrl`, or a `glbUrl` /
 *    `imageUrl` in its payload) → `pass` (L1) naming the asset;
 *  • a candidate that is only a DETERMINISTIC SWATCH → `deferred` (L4) with a reason. It is
 *    a placeholder preview, not a generated asset, and no local edit can conjure one — the
 *    generator has to run. **Honesty over greenness**: this is deliberately not a pass;
 *  • a selection that does not resolve to any kept candidate, or whose candidate projects a
 *    DIFFERENT index than the artifact's graded field, → `fail`. That is a genuinely broken
 *    artifact (the graded value is not the selected candidate's), and it cannot arise from a
 *    clean Produce;
 *  • no generation history at all → `deferred` (L4): the index alone proves nothing.
 *
 * Tier note: the swatch/no-history deferrals are reported at **L4**, because what is missing
 * is a *visual* asset — a generator run, not a config edit. That keeps Rule 5 satisfied (a
 * cleanly-produced step is `pass` or `deferred`, never `fail`/`pending`) and keeps the
 * deferred banner's L3/L4 explanation truthful.
 */

/** Direction/prompt/timestamp stamped on the batch a Produce STUB seeds. Deliberately
 *  self-describing: a reader of the raw artifact sees that no generator ran. */
export const GALLERY_STUB_DIRECTION = '(produce stub — no generator has run for this step)';
const GALLERY_STUB_PROMPT =
  'Stub batch seeded by the step\'s produce(): deterministic swatch previews only. ' +
  'Re-roll the gallery in the lab to dispatch the real generator.';
/** Fixed so a produce stub is PURE (no `Date.now()`): the same entity always yields the
 *  same artifact, which is what the spec linter and the content-hash both rely on. */
const GALLERY_STUB_AT = '2026-01-01T00:00:00.000Z';

/**
 * The `data` fragment a gallery step's Produce stub writes: `{ [field]: 0, genHistory }`.
 *
 * It seeds exactly the batch the lab's own first Produce click would create
 * (`genericGalleryCandidates` — the deterministic swatch previews) and auto-selects its
 * first candidate, so the stub artifact has the SAME SHAPE as the artifact the lab persists.
 * It invents no asset: every seeded candidate is a swatch, so the seeded artifact grades
 * `deferred` with a reason, never a manufactured pass.
 *
 * Spread it into the produce output's `data`:
 * `produce: (e) => ({ data: { ...gallerySeed('selected', 4) }, ueAssets: [...] })`.
 *
 * `selectIndex` seeds a stub whose recorded selection is a candidate other than the first
 * (the two `character-pipeline` galleries record a historical gate winner at index 2). The
 * selection stays `autoSelected` either way — the machine picked it, and the provenance strip
 * must keep saying so.
 */
export function gallerySeed(field: string, candidates: number, selectIndex = 0): Record<string, unknown> {
  const batch = makeBatch({
    seq: 0,
    at: GALLERY_STUB_AT,
    direction: GALLERY_STUB_DIRECTION,
    prompt: GALLERY_STUB_PROMPT,
    candidates: genericGalleryCandidates(field, candidates, GALLERY_STUB_DIRECTION, 0),
  });
  const seeded = appendBatch(emptyHistory(), batch);
  const pick = batch.candidates[selectIndex];
  return historyData(pick ? { ...seeded, selectedId: pick.id } : seeded);
}

/** Keep a `detail` string readable — an injected asset can be a megabyte-long data URL. */
function short(ref: string): string {
  const s = ref.trim();
  if (s.startsWith('data:')) return `${s.slice(0, s.indexOf(';') > 0 ? s.indexOf(';') : 24)} (embedded)`;
  return s.length > 96 ? `${s.slice(0, 93)}…` : s;
}

/**
 * A display-safe reference to the REAL generated asset a candidate carries, or `null` when it
 * is only a deterministic swatch preview. Every way the fleet records a real asset counts:
 *
 *  - `imageUrl` — set by `imageGalleryCandidates` for art generated FOR this step;
 *  - `payload.glbUrl` — set by `meshGalleryCandidates` (a served `.glb`);
 *  - `payload.assetPath` / `assetUrl` / `imageUrl` — the on-disk file a generator wrote;
 *  - a `swatch` of the form `url(…)` — how `scripts/gap-loop/*` injects a gated Leonardo
 *    render (a base64 data URL). A *placeholder* swatch is always a computed
 *    `linear-gradient(…)`, never a `url(…)`, so the two can never be confused.
 */
export function candidateAsset(c: GenCandidate): string | null {
  const p = (c.payload ?? {}) as Record<string, unknown>;
  for (const v of [c.imageUrl, p.glbUrl, p.imageUrl, p.assetUrl, p.assetPath]) {
    if (typeof v === 'string' && v.trim() !== '') return short(v);
  }
  if (typeof c.swatch === 'string' && c.swatch.trim().startsWith('url(')) {
    return short(c.swatch.trim().slice(4).replace(/\)$/, ''));
  }
  return null;
}

const L1 = 'L1' as const;
const L4 = 'L4' as const;

/**
 * Grade a gallery step's SELECTED CANDIDATE (see the file header for the rules). Pure; reads
 * only the step's own artifact `data`, so it works identically on the lab path, the server
 * re-grade and the headless produce→accept loop.
 */
export function gradeGallerySelection(
  data: Record<string, unknown>,
  field: string,
  label: string,
): AcceptanceResult {
  const idx = data[field];
  if (typeof idx !== 'number' || !(idx >= 0)) {
    return {
      label,
      tier: L1,
      status: 'pending',
      detail: 'none selected',
      reason: `field "${field}" has no selection (expected a non-negative candidate index, got ${JSON.stringify(idx)})`,
    };
  }

  const history = readHistory(data);
  if (history.batches.length === 0) {
    return {
      label,
      tier: L4,
      status: 'deferred',
      detail: `candidate ${idx} · no generation history`,
      reason:
        `"${field}" records candidate ${idx}, but the artifact holds no generation history — ` +
        'nothing proves any candidate was ever generated for this step. Run the gallery\'s Produce ' +
        'so the batch (and its candidates) are recorded, then re-grade.',
    };
  }

  const cand = selectedCandidate(history);
  const kept = history.batches.reduce((n, b) => n + b.candidates.length, 0);
  if (!cand) {
    return {
      label,
      tier: L1,
      status: 'fail',
      detail: `selection ${JSON.stringify(history.selectedId)} unresolved`,
      reason:
        `the artifact selects candidate id ${JSON.stringify(history.selectedId)}, which is not among the ` +
        `${kept} candidate(s) in the ${history.batches.length} kept batch(es) — the graded selection points at nothing.`,
    };
  }

  const projected = (cand.payload ?? {})[field];
  if (typeof projected === 'number' && projected !== idx) {
    return {
      label,
      tier: L1,
      status: 'fail',
      detail: `"${field}" ${idx} ≠ candidate ${cand.id} → ${projected}`,
      reason:
        `the artifact grades "${field}" = ${idx}, but the selected candidate (${cand.id}) projects ${projected} — ` +
        'the graded value is not the selected candidate\'s. Re-select a candidate so the projection and the graded field agree.',
    };
  }

  const asset = candidateAsset(cand);
  const named = cand.caption ?? cand.id;
  if (asset) {
    return {
      label,
      tier: L1,
      status: 'pass',
      detail: `candidate ${idx} · ${named} → ${asset}`,
    };
  }

  return {
    label,
    tier: L4,
    status: 'deferred',
    detail: `candidate ${idx} · ${named} — swatch placeholder`,
    reason:
      `the selected candidate (${named}) is a deterministic swatch preview, not a generated asset — no image ` +
      'or mesh was produced for this step, so the selection cannot be visually verified. Run the generator ' +
      '(gap-loop / the provider script) so the step owns real art, then re-roll the gallery and select it.',
  };
}
