/**
 * The Orrery's live walk, display side: "graph + walker report" in, "what the lens and the Audit
 * tab read" out. Pure: no DOM, no fetch, no clock.
 *
 * Three jobs, each one small and each one a place an honesty rule could otherwise leak:
 *
 *   1. {@link mergeWalkEvidence} — the report's SAMPLED evidence merged under the graph's own
 *      IMPORTED evidence with `mergeEvidence` (§8: imported outranks sampled; the rule lives there,
 *      not here).
 *   2. {@link buildMergedModel} — the Orrery model built over the merged evidence. The model reads
 *      its cohort list off the FIRST run only (`model.ts` step 3), so a document whose imported run
 *      names `completionist…` would hide the walker's `uniform` cohort entirely. Until the model
 *      reads every run (counter-proposed in the WP4 report), this feeds it a leading VIEW run whose
 *      only job is to carry the union of cohort names, then strips it again: the returned model's
 *      `raw.evidence` and `prov.runs` are the real runs, never the view run.
 *      `prov.unverified` is recomputed from the merged cells: if ANY displayed cell is `stale` or
 *      `unverified`, the whole lens is badged unverified — doubt never passes (§9).
 *   3. {@link withLeads} — walker findings are LEADS, so they enter the Audit tab as ONE separate,
 *      labelled group and never touch `auditTotal`, which stays the structural count.
 */

import { mergeEvidence, toStoryEvidence, type EvidenceSource, type EvidenceStatus, type MergedEvidence } from '@/lib/story/evidence';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import type { AuditGroup, OrreryModel } from '@/lib/story/orrery/types';
import type { StoryFinding, StoryGraph, StoryRun, WalkerReport } from '@/lib/story/types';

/** The view run's id. Internal to {@link buildMergedModel}; it never leaves this module. */
const VIEW_RUN_ID = '__orrery-merged-view';
/** The Audit group the leads land in. */
export const LEADS_GROUP_ID = 'walker-leads';
export const LEADS_GROUP_TITLE = 'Leads - reproduce before trusting';
/** How many path steps a lead row shows at each end before it elides the middle. */
const PATH_EDGE = 3;

const RANK: Record<EvidenceStatus, number> = { verified: 0, unverified: 1, stale: 2 };

/** Merge a walk's sampled evidence under the graph's imported evidence, read against `currentHash`. */
export function mergeWalkEvidence(graph: StoryGraph, currentHash: string, report: Pick<WalkerReport, 'evidence'>): MergedEvidence {
  return mergeEvidence({ currentHash, imported: graph.evidence, sampled: report.evidence });
}

/** The worst status over every DISPLAYED cell (shadowed values are not displayed). */
export function worstCellStatus(merged: MergedEvidence): EvidenceStatus | null {
  let worst: EvidenceStatus | null = null;
  for (const row of Object.values(merged.reach)) {
    for (const cell of Object.values(row)) {
      if (worst === null || RANK[cell.status] > RANK[worst]) worst = cell.status;
    }
  }
  return worst;
}

export interface CohortStatus {
  cohort: string;
  /** Worst status of any displayed cell in this cohort. */
  status: EvidenceStatus;
  /** Which sources supply the displayed cells. */
  sources: EvidenceSource[];
  /** Displayed cells (= measured nodes) in this cohort. */
  cells: number;
}

/** Per cohort: the worst displayed status and where its cells come from. Ordered as first seen. */
export function cohortStatuses(merged: MergedEvidence): CohortStatus[] {
  const by = new Map<string, CohortStatus>();
  for (const row of Object.values(merged.reach)) {
    for (const [cohort, cell] of Object.entries(row)) {
      let s = by.get(cohort);
      if (!s) {
        s = { cohort, status: cell.status, sources: [], cells: 0 };
        by.set(cohort, s);
      }
      if (RANK[cell.status] > RANK[s.status]) s.status = cell.status;
      if (!s.sources.includes(cell.source)) s.sources.push(cell.source);
      s.cells++;
    }
  }
  return [...by.values()];
}

/**
 * Build the Orrery model over merged evidence. See the module note for why a view run is used and
 * why it is stripped again. Pure.
 */
export function buildMergedModel(graph: StoryGraph, key: string, merged: MergedEvidence): OrreryModel {
  const real = toStoryEvidence(merged);
  const union: string[] = [];
  const add = (c: string) => {
    if (!union.includes(c)) union.push(c);
  };
  for (const r of real.runs) r.cohorts.forEach(add);
  // A row cohort no run declares is still a measured column (its cells read `unverified`).
  for (const row of Object.values(real.reach)) Object.keys(row).forEach(add);

  const worst = worstCellStatus(merged);
  const verified = worst === 'verified' && merged.graphHash.length > 0;
  const view: StoryRun = {
    runId: VIEW_RUN_ID,
    engine: 'orrery-merged-view',
    n: real.runs[0]?.n ?? 0,
    graphHash: verified ? merged.graphHash : null,
    cohorts: union,
  };
  if (real.runs.some((r) => r.provisional === true)) view.provisional = true;

  const built = buildOrreryModel({ ...graph, evidence: { ...real, runs: [view, ...real.runs] } }, key);
  return {
    ...built,
    raw: { ...graph, evidence: real },
    prov: { ...built.prov, unverified: !verified, runs: real.runs },
  };
}

/** `a › b › c … x › y › z (n steps)` — the head and tail of a lead's path. */
export function compactPath(path: readonly string[]): string {
  if (path.length === 0) return '(no path)';
  if (path.length <= PATH_EDGE * 2 + 1) return `${path.join(' › ')} (${path.length} steps)`;
  return `${path.slice(0, PATH_EDGE).join(' › ')} › … › ${path.slice(-PATH_EDGE).join(' › ')} (${path.length} steps)`;
}

/** One Audit row per walker lead. A finding without a `lead` is not a walker lead and is skipped. */
export function leadAuditGroup(model: OrreryModel, findings: readonly StoryFinding[]): AuditGroup {
  const items: AuditGroup['items'] = [];
  let engine = '';
  let samples = 0;
  let seed: number | null = null;
  for (const f of findings) {
    if (!f.lead) continue;
    engine = f.lead.engine;
    samples = f.lead.samples;
    seed = f.lead.seed;
    const at = f.nodes[0];
    const i = at !== undefined ? (model.idx.get(at) ?? -1) : -1;
    items.push({
      i,
      text: `${f.code} · ${f.detail} · seed ${f.lead.seed} · path ${compactPath(f.lead.path)}`,
    });
  }
  const basis = engine ? ` Sampled by ${engine} (${samples.toLocaleString()} walks per cohort, seed ${seed}).` : '';
  return {
    id: LEADS_GROUP_ID,
    title: LEADS_GROUP_TITLE,
    why:
      'State-altitude leads from the sampled walk, NOT defects: a walk reliably reports as stuck what is merely long or resource-gated. Reproduce each from its seed and path before trusting it. Not counted in the Audit total.' +
      basis,
    severity: 'info',
    items,
  };
}

/** The model with the leads group appended. `auditTotal` is left as the structural count. */
export function withLeads(model: OrreryModel, findings: readonly StoryFinding[]): OrreryModel {
  return { ...model, audit: [...model.audit, leadAuditGroup(model, findings)] };
}

/** The label sampled data always carries, so it is never mistaken for playtest data. */
export function sampledLabel(report: Pick<WalkerReport, 'engine' | 'samples' | 'seed' | 'cohorts'>): string {
  const cohorts = Math.max(1, report.cohorts.length);
  const per = cohorts > 1 ? ` per cohort × ${cohorts}` : '';
  return `sampled (${report.engine}, ${report.samples.toLocaleString()} walks${per}, seed ${report.seed})`;
}
