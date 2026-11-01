/**
 * The Orrery's per-cell STATUS channel: for every (node, cohort) cell the lens can show, is the
 * figure `verified`, `stale` or `unverified` (§9)? Pure; built once per model, read per bake.
 *
 * It is read off the SAME merged evidence the lens value comes from, never a second opinion:
 *   - a view holding merged evidence (imported + sampled, `mergeEvidence`) passes it in, and each
 *     cell takes the status the merge gave its displayed value;
 *   - a plain document is merged on its own (imported only) against the graph's current hash, so a
 *     cell's status is its run's `runStatus`; a cohort no run declares is `unverified`.
 * When no current hash is known at all, a run pinned to SOME hash cannot be checked: it reads
 * `unverified`, never `verified` (doubt never passes) and never `stale` (that would be a claim).
 *
 * Containers whose figure is a DERIVED mean take the WORST status of the measured descendants that
 * fed the mean, under the exact carry rule `model.ts` uses for `reachMean` (docks do not carry).
 * Unmeasured has no status: no cell, no marker.
 */

import { mergeEvidence, type EvidenceSource, type EvidenceStatus, type MergedEvidence } from '@/lib/story/evidence';
import type { NodeIx, OrreryNode } from '@/lib/story/orrery/types';
import type { StoryGraph } from '@/lib/story/types';

/** Packed per (node, cohort): 0 = no cell, else `RANK + 1`. Higher is worse. */
const CODE: Record<EvidenceStatus, number> = { verified: 1, unverified: 2, stale: 3 };
const BY_CODE: (EvidenceStatus | null)[] = [null, 'verified', 'unverified', 'stale'];
const SRC: Record<EvidenceSource, number> = { imported: 1, sampled: 2 };
const SRC_BY_CODE: (EvidenceSource | null)[] = [null, 'imported', 'sampled'];

export interface OrreryStatus {
  /** The cohorts the channel indexes, in column order. */
  cohorts: string[];
  /** `own[i * C + c]`: the status of node i's OWN measured cell for cohort c. */
  own: Uint8Array;
  /** `src[i * C + c]`: where node i's own displayed cell came from. */
  src: Uint8Array;
  /** `derived[i * C + c]`: the worst status among the measured descendants that fed `reachMean`. */
  derived: Uint8Array;
}

/** What `buildOrreryModel` may be told about the evidence it reads. */
export interface OrreryBuildOptions {
  /** The merged evidence the view's lens reads; the document's `evidence` must be its winning values. */
  merged?: MergedEvidence | null;
  /** The graph's current `storyContentHash`, for a plain document. Falls back to `raw.contentHash`. */
  currentHash?: string | null;
}

/** The merged evidence a plain document stands for, read against its current hash. */
function plainMerge(raw: StoryGraph, currentHash: string | null | undefined): { merged: MergedEvidence; hashKnown: boolean } {
  const hash = currentHash ?? raw.contentHash ?? null;
  return { merged: mergeEvidence({ currentHash: hash ?? '', imported: raw.evidence }), hashKnown: hash !== null && hash !== '' };
}

/**
 * Build the channel over a model's node records. `R` must already carry `reach` (and docks their
 * `dock` flag); `order` is parents-before-children; `N` is the real node count (R has N + 1).
 */
export function buildOrreryStatus(
  raw: StoryGraph,
  R: readonly OrreryNode[],
  order: readonly NodeIx[],
  N: number,
  opts: OrreryBuildOptions = {},
): OrreryStatus {
  const { merged, hashKnown } = opts.merged ? { merged: opts.merged, hashKnown: true } : plainMerge(raw, opts.currentHash);
  const cohorts: string[] = [];
  for (const n of R) if (n.reach) for (const c of Object.keys(n.reach)) if (!cohorts.includes(c)) cohorts.push(c);
  const C = cohorts.length;
  const own = new Uint8Array(R.length * C);
  const src = new Uint8Array(R.length * C);
  const derived = new Uint8Array(R.length * C);
  if (C === 0) return { cohorts, own, src, derived };

  for (const n of R) {
    if (!n.reach) continue;
    const row = merged.reach[n.id];
    for (let c = 0; c < C; c++) {
      if (typeof n.reach[cohorts[c]] !== 'number') continue;
      const cell = row?.[cohorts[c]];
      // A displayed figure with no merged cell behind it is unattributed: unverified, never a pass.
      let status: EvidenceStatus = cell?.status ?? 'unverified';
      if (status === 'stale' && !hashKnown) status = 'unverified';
      own[n.i * C + c] = CODE[status];
      src[n.i * C + c] = cell ? SRC[cell.source] : 0;
    }
  }
  // Worst-of-descendants, carried exactly as `model.ts` carries the derived mean.
  for (let a = order.length - 1; a >= 0; a--) {
    const n = R[order[a]];
    if (n.par < 0 || n.par > N || n.dock) continue;
    const base = n.i * C;
    const pbase = n.par * C;
    for (let c = 0; c < C; c++) {
      const carried = Math.max(own[base + c], derived[base + c]);
      if (carried > derived[pbase + c]) derived[pbase + c] = carried;
    }
  }
  return { cohorts, own, src, derived };
}

/** The status of one node's cell for one cohort, own (`measured`) or derived. `null` = no cell. */
export function cellStatus(
  status: OrreryStatus | undefined,
  i: NodeIx,
  cohort: string,
  which: 'own' | 'derived',
): EvidenceStatus | null {
  if (!status) return null;
  const c = status.cohorts.indexOf(cohort);
  if (c < 0) return null;
  const C = status.cohorts.length;
  return BY_CODE[(which === 'own' ? status.own : status.derived)[i * C + c]] ?? null;
}

/** Where one node's own displayed cell came from, or `null` when it has none / it is unattributed. */
export function cellSource(status: OrreryStatus | undefined, i: NodeIx, cohort: string): EvidenceSource | null {
  if (!status) return null;
  const c = status.cohorts.indexOf(cohort);
  if (c < 0) return null;
  return SRC_BY_CODE[status.src[i * status.cohorts.length + c]] ?? null;
}

/** The worse of two statuses; `null` is "no cell" and loses to any status. */
export function worseStatus(a: EvidenceStatus | null, b: EvidenceStatus | null): EvidenceStatus | null {
  if (a === null) return b;
  if (b === null) return a;
  return CODE[b] > CODE[a] ? b : a;
}
