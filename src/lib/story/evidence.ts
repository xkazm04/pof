/**
 * Merging imported run results with the walker's sampled ones (§8 "imported evidence outranks
 * sampled evidence", §9 "a reach row whose graphHash differs ... is stale; it is never a pass").
 *
 * Rules, per (node, cohort) cell:
 *   - IMPORTED outranks SAMPLED for the same cell. The sampled value is kept as `shadowed`, so a
 *     reader can still show it; it never replaces the imported value.
 *   - A cell's status is its run's: `verified` when the run's `graphHash` equals the current
 *     graph's `storyContentHash`; `stale` when it names a different hash; `unverified` when it is
 *     `null` (not pinned to any graph version). A cohort no run declares is `unverified` with no run.
 *     Where several runs of one source declare a cohort, the WORST status wins — doubt never passes.
 *   - Only `verified` passes (`cellPasses`). Stale and unverified render as such, never as a pass.
 *   - Unmeasured stays absent: a node with no row in either source has no cell. Nothing is coerced
 *     to 0.
 * Pure.
 */

import type { StoryEvidence, StoryRun } from '@/lib/story/types';

export type EvidenceStatus = 'verified' | 'stale' | 'unverified';
export type EvidenceSource = 'imported' | 'sampled';

export interface MergedRun extends StoryRun {
  source: EvidenceSource;
  status: EvidenceStatus;
}

export interface MergedCellValue {
  value: number;
  source: EvidenceSource;
  runId: string | null;
  status: EvidenceStatus;
}

export interface MergedCell extends MergedCellValue {
  /** The sampled value an imported one outranked. */
  shadowed?: MergedCellValue;
}

export interface MergedEvidence {
  graphHash: string;
  runs: MergedRun[];
  reach: Record<string, Record<string, MergedCell>>;
  unit?: string;
}

export function runStatus(run: Pick<StoryRun, 'graphHash'>, currentHash: string): EvidenceStatus {
  if (run.graphHash === null || run.graphHash === undefined) return 'unverified';
  return run.graphHash === currentHash ? 'verified' : 'stale';
}

const WORST: Record<EvidenceStatus, number> = { verified: 0, unverified: 1, stale: 2 };

function cells(ev: StoryEvidence | undefined, source: EvidenceSource, runs: MergedRun[]) {
  const out = new Map<string, Map<string, MergedCellValue>>();
  if (!ev) return out;
  const owner = new Map<string, { runId: string; status: EvidenceStatus }>();
  for (const r of runs) {
    if (r.source !== source) continue;
    for (const c of r.cohorts) {
      const hit = owner.get(c);
      if (!hit) owner.set(c, { runId: r.runId, status: r.status });
      else if (WORST[r.status] > WORST[hit.status]) hit.status = r.status;
    }
  }
  for (const [node, row] of Object.entries(ev.reach ?? {})) {
    const m = new Map<string, MergedCellValue>();
    for (const [cohort, value] of Object.entries(row)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const o = owner.get(cohort);
      m.set(cohort, { value, source, runId: o?.runId ?? null, status: o?.status ?? 'unverified' });
    }
    if (m.size > 0) out.set(node, m);
  }
  return out;
}

export interface MergeInput {
  /** `storyContentHash` of the graph the evidence is being read against. */
  currentHash: string;
  imported?: StoryEvidence;
  sampled?: StoryEvidence;
}

export function mergeEvidence({ currentHash, imported, sampled }: MergeInput): MergedEvidence {
  const runs: MergedRun[] = [
    ...(imported?.runs ?? []).map((r) => ({ ...r, source: 'imported' as const, status: runStatus(r, currentHash) })),
    ...(sampled?.runs ?? []).map((r) => ({ ...r, source: 'sampled' as const, status: runStatus(r, currentHash) })),
  ];
  const imp = cells(imported, 'imported', runs);
  const smp = cells(sampled, 'sampled', runs);
  const reach: MergedEvidence['reach'] = {};
  for (const node of new Set([...imp.keys(), ...smp.keys()])) {
    const row: Record<string, MergedCell> = {};
    const i = imp.get(node);
    const s = smp.get(node);
    for (const cohort of new Set([...(i?.keys() ?? []), ...(s?.keys() ?? [])])) {
      const a = i?.get(cohort);
      const b = s?.get(cohort);
      row[cohort] = a ? (b ? { ...a, shadowed: b } : { ...a }) : { ...b! };
    }
    reach[node] = row;
  }
  return { graphHash: currentHash, runs, reach, unit: imported?.unit ?? sampled?.unit };
}

/** Only evidence pinned to THIS graph passes. */
export const cellPasses = (cell: Pick<MergedCellValue, 'status'>): boolean => cell.status === 'verified';

/** The plain `StoryEvidence` a reader such as the Orrery reads: every run, the winning value per cell. */
export function toStoryEvidence(merged: MergedEvidence): StoryEvidence {
  const reach: Record<string, Record<string, number>> = {};
  for (const [node, row] of Object.entries(merged.reach)) {
    reach[node] = Object.fromEntries(Object.entries(row).map(([c, cell]) => [c, cell.value]));
  }
  const runs: StoryRun[] = merged.runs.map((r) => {
    const run: StoryRun = { runId: r.runId, engine: r.engine, n: r.n, graphHash: r.graphHash, cohorts: r.cohorts };
    if (r.config !== undefined) run.config = r.config;
    if (r.seeds !== undefined) run.seeds = r.seeds;
    if (r.capturedAt !== undefined) run.capturedAt = r.capturedAt;
    if (r.provisional !== undefined) run.provisional = r.provisional;
    return run;
  });
  return { runs, reach, unit: merged.unit };
}
