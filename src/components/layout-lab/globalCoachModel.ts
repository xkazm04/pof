import { deriveEntityArtifacts, type StepDisplayStatus, type StepDrift } from './hooks/useEntityArtifacts';
import { COACH_PRIORITY_RANK, pickLadderIssue, type CoachPriority } from './coachLadder';
import type { LabEntity } from './useLabCatalogData';
import type { LabStepArtifact } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Pure model for the lab-level, cross-catalog "what should I do next?" coach.
 *
 * Per-entity coaching already lives in {@link NextStepCoach}; this is its
 * project-wide complement: it picks the single most-urgent actionable step for
 * every entity across ALL catalogs, then ranks those candidates so the user sees
 * the highest-value next moves without opening catalogs one at a time.
 *
 * The derivation REUSES {@link deriveEntityArtifacts} (the exact path the rail and
 * the matrix use) — no new status logic. The add-only server→local merge mirrors
 * `buildMatrixRows`, so a coach candidate can never disagree with the matrix cell.
 *
 * The urgency ladder itself is NOT defined here — it lives in `coachLadder.ts` and is
 * shared with the per-entity `NextStepCoach`, so both coaches always name the same step
 * for the same entity. Read that module for the order and its justification.
 */

export { COACH_HINT, COACH_PRIORITY_RANK, type CoachHint, type CoachPriority } from './coachLadder';

export interface CoachCandidate {
  catalogId: string;
  catalogLabel: string;
  entityId: string;
  entityName: string;
  step: string;
  stepIndex: number;
  priority: CoachPriority;
  /**
   * The concrete checker reason behind this candidate (fail/deferred: the derived
   * artifact's reason; drift: the local-vs-server verdict). Undefined when none is
   * available — the row falls back to the generic {@link COACH_HINT} text (we never
   * invent a reason).
   */
  reason?: string;
}

/**
 * The single most-urgent actionable step for one entity, or `null` when the entity
 * is config-complete (every step pass — the same "nothing actionable" bar the
 * per-entity coach uses, because it is now literally the same function).
 *
 * Thin alias over the shared {@link pickLadderIssue}; kept as a named export because
 * it is the vocabulary this model (and its tests) speak.
 */
export function pickEntityIssue(
  steps: string[],
  statusByStep: (step: string, i: number) => StepDisplayStatus,
  driftByStep: Map<string, StepDrift>,
): { step: string; index: number; priority: CoachPriority } | null {
  return pickLadderIssue(steps, statusByStep, driftByStep);
}

/** Per-catalog input to the aggregation — the same four sources `buildMatrixRows` reads. */
export interface CoachCatalogInput {
  catalogId: string;
  catalogLabel: string;
  steps: string[];
  entities: LabEntity[];
  /** Server artifacts grouped by entity id (whole-catalog cache read). */
  serverByEntity: Map<string, Map<string, PipelineArtifact>>;
  /** Local produced steps by entity id (add-only overlay; local wins). */
  localByEntity: Record<string, Record<string, LabStepArtifact>>;
}

/** Project a server artifact into the local shape so it can seed the shared derivation (mirrors matrixRows). */
function asLocal(a: PipelineArtifact): LabStepArtifact {
  return { done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? '' };
}

/**
 * Rank candidates by the ladder, breaking ties by insertion order (a stable sort:
 * catalogs/entities keep the order they were fed in), and take the top N.
 */
export function rankCoachCandidates(candidates: CoachCandidate[], topN: number): CoachCandidate[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => COACH_PRIORITY_RANK[a.c.priority] - COACH_PRIORITY_RANK[b.c.priority] || a.i - b.i)
    .slice(0, Math.max(0, topN))
    .map((x) => x.c);
}

/**
 * Group a flat cross-catalog verdict list by catalog id — the scoping every per-catalog
 * derivation needs. Exported so a caller that derives catalogs INDEPENDENTLY (the lab hook
 * memoizes each catalog on its own inputs) can group once and reuse the same list objects,
 * keeping each catalog's verdict slice referentially stable between renders.
 */
export function groupVerdictsByCatalog(verdicts: JudgeVerdict[]): Map<string, JudgeVerdict[]> {
  const byCatalog = new Map<string, JudgeVerdict[]>();
  for (const v of verdicts) {
    const list = byCatalog.get(v.catalogId) ?? [];
    list.push(v);
    byCatalog.set(v.catalogId, list);
  }
  return byCatalog;
}

/**
 * Every actionable candidate for ONE catalog, in entity order — the unit of work the
 * whole-fleet aggregation is made of.
 *
 * Split out of {@link buildGlobalCoach} so a caller can memoize per catalog: the homepage
 * fans out one artifact fetch per catalog and each resolution used to re-derive the ENTIRE
 * fleet (every entity of every catalog), turning first paint into dozens of whole-project
 * passes. Deriving catalogs independently makes that cost proportional to what actually
 * changed. The output is byte-identical to the inline loop it replaced.
 */
export function buildCatalogCandidates(cin: CoachCatalogInput, verdicts: JudgeVerdict[] = []): CoachCandidate[] {
  const candidates: CoachCandidate[] = [];
  for (const e of cin.entities) {
    const serverRow = cin.serverByEntity.get(e.id);
    const serverArts: Record<string, PipelineArtifact> = {};
    const serverAsLocal: Record<string, LabStepArtifact> = {};
    if (serverRow) {
      for (const [step, art] of serverRow) { serverArts[step] = art; serverAsLocal[step] = asLocal(art); }
    }
    const effective = { ...serverAsLocal, ...(cin.localByEntity[e.id] ?? {}) }; // add-only: local wins
    const { displayStatus, driftByStep, artifactByStep } = deriveEntityArtifacts(cin.catalogId, e, cin.steps, effective, serverArts, {}, verdicts);
    const issue = pickEntityIssue(cin.steps, displayStatus, driftByStep);
    if (!issue) continue;
    // The concrete reason: for drift, the local-vs-server disagreement; otherwise the
    // reason carried on the derived artifact (fail/deferred checker output). Undefined
    // for a pending step (nothing has run yet) → the row shows the generic hint.
    const drift = driftByStep.get(issue.step);
    const reason = issue.priority === 'drift'
      ? (drift
        ? (drift.kind === 'content'
          // Naming the (identical) verdicts here would read as a contradiction that isn't
          // one — the point of content drift is that the verdicts agree.
          ? `both read ${drift.server}, but the produced content differs from the server`
          : `local reads ${drift.local}, server says ${drift.server}`)
        : undefined)
      : artifactByStep.get(issue.step)?.reason;
    candidates.push({
      catalogId: cin.catalogId,
      catalogLabel: cin.catalogLabel,
      entityId: e.id,
      entityName: e.name,
      step: issue.step,
      stepIndex: issue.index,
      priority: issue.priority,
      ...(reason ? { reason } : {}),
    });
  }
  return candidates;
}

/**
 * Build every entity's most-urgent candidate across all catalogs via the shared
 * `deriveEntityArtifacts`, then rank + slice to the top N. Config-complete entities
 * contribute nothing.
 */
export function buildGlobalCoach(
  inputs: CoachCatalogInput[],
  topN: number,
  /** Judge verdicts across every catalog (scoped per catalog below), so a coach candidate
   *  carries the same judge bridge the banner and the matrix apply. */
  verdicts: JudgeVerdict[] = [],
): CoachCandidate[] {
  const verdictsByCatalog = groupVerdictsByCatalog(verdicts);
  const candidates: CoachCandidate[] = [];
  for (const cin of inputs) {
    candidates.push(...buildCatalogCandidates(cin, verdictsByCatalog.get(cin.catalogId) ?? []));
  }
  return rankCoachCandidates(candidates, topN);
}
