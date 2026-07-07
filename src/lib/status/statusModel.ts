/**
 * Status dashboard model — pure aggregation of pipeline_artifacts truth into the
 * swimlane health map (one pipeline per row, one cell per step). A cell's readiness
 * is derived across every entity of the catalog, never hand-toggled:
 *   proven    — at least one entity PASSES the step (wired + verified at its tier)
 *   deferred  — honest L3/L4 wait (runtime/visual gate not yet run)
 *   attention — a produced artifact FAILS (wired but broken)
 *   pending   — produced but not yet passing (in progress)
 *   unwired   — NO artifact exists (mocked / skipped / never run) ← the bottleneck color
 */
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

export type CellReadiness = 'proven' | 'deferred' | 'attention' | 'pending' | 'unwired';

export interface StepCell {
  label: string;
  readiness: CellReadiness;
  tier?: string;
  counts: { pass: number; deferred: number; fail: number; pending: number };
  reason?: string;
}

export interface Swimlane {
  catalogId: string;
  label: string;
  cells: StepCell[];
  provenPct: number;
  wiredPct: number;
}

/** Derive one cell from every artifact recorded for that step label. Pure. */
export function deriveCell(label: string, artifacts: PipelineArtifact[]): StepCell {
  const counts = { pass: 0, deferred: 0, fail: 0, pending: 0 };
  let tier: string | undefined;
  let reason: string | undefined;
  for (const a of artifacts) {
    if (a.status === 'pass') counts.pass += 1;
    else if (a.status === 'deferred') counts.deferred += 1;
    else if (a.status === 'fail') counts.fail += 1;
    else counts.pending += 1;
    if (a.tier && (!tier || a.tier > tier)) tier = a.tier;
    if (a.reason && !reason) reason = a.reason;
  }
  const readiness: CellReadiness =
    counts.pass > 0 ? 'proven'
    : counts.deferred > 0 ? 'deferred'
    : counts.fail > 0 ? 'attention'
    : counts.pending > 0 ? 'pending'
    : 'unwired';
  return { label, readiness, tier, counts, reason };
}

/** Build a swimlane for one pipeline from its step labels + all recorded artifacts. Pure. */
export function buildSwimlane(
  catalogId: string,
  label: string,
  stepLabels: string[],
  artifacts: PipelineArtifact[],
): Swimlane {
  const byStep = new Map<string, PipelineArtifact[]>();
  for (const a of artifacts) {
    const list = byStep.get(a.step) ?? [];
    list.push(a);
    byStep.set(a.step, list);
  }
  const cells = stepLabels.map((s) => deriveCell(s, byStep.get(s) ?? []));
  const proven = cells.filter((c) => c.readiness === 'proven').length;
  const wired = cells.filter((c) => c.readiness !== 'unwired').length;
  const n = Math.max(cells.length, 1);
  return {
    catalogId,
    label,
    cells,
    provenPct: Math.round((proven / n) * 100),
    wiredPct: Math.round((wired / n) * 100),
  };
}

/** Sort lanes so the biggest bottlenecks (least proven) surface last-but-visible:
 *  most-proven first gives an instant "healthy top, gap bottom" read. Pure. */
export function sortLanes(lanes: Swimlane[]): Swimlane[] {
  return [...lanes].sort((a, b) => b.provenPct - a.provenPct || a.label.localeCompare(b.label));
}
