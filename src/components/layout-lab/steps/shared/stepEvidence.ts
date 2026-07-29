/**
 * The REAL assets a step is currently showing, collected so a corrective produce can cite
 * them instead of describing them.
 *
 * When a generated icon is wrong, or a mesh came back fused, the operator can see exactly
 * what is wrong — and then types a fix direction into a prompt that has no idea what is on
 * screen. Every reference has to be re-described in words, which is both lossy and the one
 * part of the loop a machine could do perfectly: the assets already have served URLs
 * (`/api/visual-gen/asset/…`), and a CLI session with tool access can fetch them.
 *
 * The honesty rule that shapes this module: **a swatch is not evidence.** Gallery
 * candidates always carry a `swatch` (a deterministic CSS gradient derived from a seed) so
 * a tile is never blank, and `imageGalleryCandidates` falls back to it when the generated-
 * asset manifest is empty. Citing a swatch would hand a prompt a colour PoF invented and
 * present it as the thing that was produced. Only a real served URL is ever collected — a
 * step with nothing real yields an empty list and the prompt gains no section at all.
 *
 * It also collects only the SELECTED candidate, not the batch: the point is what the
 * operator is looking at, and the other candidates are alternatives they rejected.
 */

import { readHistory, selectedCandidate } from './genHistory';

export interface StepEvidence {
  kind: 'image' | 'mesh';
  /** The served URL of a real artifact. Never a swatch, never a data-derived placeholder. */
  url: string;
  /** Where it came from, for the operator-facing chip. */
  label: string;
}

/** A usable served reference is a non-empty string; anything else is dropped silently. */
function urlOf(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Collect every real asset this step's artifact currently presents.
 *
 * Sources, in the order a reader would encounter them on screen:
 *  1. the selected gallery candidate's `imageUrl` (a served thumbnail),
 *  2. the selected candidate's `payload.glbUrl` (a served mesh),
 *  3. the artifact's top-level `data.glbUrl` (a non-gallery step's mesh).
 *
 * (2) and (3) are usually the same URL — `historyData` projects the selected payload onto
 * top-level data — so results are de-duplicated by URL.
 */
export function collectStepEvidence(data: Record<string, unknown> | undefined): StepEvidence[] {
  if (!data) return [];
  const out: StepEvidence[] = [];
  const seen = new Set<string>();
  const push = (kind: StepEvidence['kind'], url: string | null, label: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ kind, url, label });
  };

  const sel = selectedCandidate(readHistory(data));
  if (sel) {
    push('image', urlOf(sel.imageUrl), 'selected candidate');
    push('mesh', urlOf(sel.payload?.glbUrl), 'selected candidate mesh');
  }
  push('mesh', urlOf(data.glbUrl), 'step mesh');

  return out;
}

/**
 * Render the evidence as a prompt section, or '' when there is none.
 *
 * Empty is the important case: a produce prompt must not gain a "Current output" heading
 * followed by nothing, which would read to the session as "there is no output" when the
 * truth is "nothing real was produced to point at".
 */
export function evidenceBlock(evidence: readonly StepEvidence[]): string {
  if (!evidence.length) return '';
  const lines = evidence.map((e) => `- ${e.kind} (${e.label}): ${e.url}`);
  return [
    '## Current output (what is on screen right now)',
    'These are the real artifacts this step currently holds. Fetch and inspect them before',
    'producing — the direction below is feedback ON these, not a description of them.',
    ...lines,
  ].join('\n');
}
