import { deriveEntityArtifacts, type StepDisplayStatus, type StepDrift } from './hooks/useEntityArtifacts';
import type { LabEntity } from './useLabCatalogData';
import type { LabStepArtifact } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

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
 * Ladder (highest urgency first): fail > drift > pending > deferred > unproduced. A
 * failed gate blocks downstream work; drift means the local and server verdicts
 * disagree and need reconciling; pending is produced-but-still-grading; deferred waits
 * on a live Unreal run; `unproduced` (never produced — the honest replacement for the
 * old lifecycle-fraction pseudo-progress) sits LAST so real in-flight work always
 * outranks "start something new", and it is labelled honestly so it never reads as
 * progress that didn't happen.
 */

export type CoachPriority = 'fail' | 'drift' | 'pending' | 'deferred' | 'unproduced';

/** Lower rank = more urgent. Single source for both the sort and any UI ordering. */
export const COACH_PRIORITY_RANK: Record<CoachPriority, number> = {
  fail: 0,
  drift: 1,
  pending: 2,
  deferred: 3,
  unproduced: 4,
};

export interface CoachHint {
  /** Color+glyph status token (glyph is the primary, colorblind-safe signal). */
  glyph: string;
  /** Imperative verb for the row ("Fix" / "Review" / "Produce" / "Run live test"). */
  actionWord: string;
  /** One plain-language sentence explaining why this step surfaced. */
  hint: string;
}

export const COACH_HINT: Record<CoachPriority, CoachHint> = {
  fail: { glyph: '✕', actionWord: 'Fix', hint: 'a gate failed here — open it to see what to change' },
  drift: { glyph: '≠', actionWord: 'Review', hint: 'the local and server verdicts disagree — reconcile them' },
  pending: { glyph: '○', actionWord: 'Produce', hint: 'this step is produced — its acceptance is still resolving' },
  deferred: { glyph: '⏸', actionWord: 'Run live test', hint: 'waiting on a live Unreal run — drain its gate' },
  unproduced: { glyph: '·', actionWord: 'Start', hint: 'not produced yet — nothing has run here' },
};

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
 * is config-complete (every step pass, or an L3/L4-only deferred with no earlier gap
 * — same "nothing actionable" bar the per-entity coach uses). Ladder order:
 * fail > drift > pending > deferred > unproduced.
 */
export function pickEntityIssue(
  steps: string[],
  statusByStep: (step: string, i: number) => StepDisplayStatus,
  driftByStep: Map<string, StepDrift>,
): { step: string; index: number; priority: CoachPriority } | null {
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'fail') return { step: steps[i], index: i, priority: 'fail' };
  }
  for (let i = 0; i < steps.length; i++) {
    if (driftByStep.has(steps[i])) return { step: steps[i], index: i, priority: 'drift' };
  }
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'pending') return { step: steps[i], index: i, priority: 'pending' };
  }
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'deferred') return { step: steps[i], index: i, priority: 'deferred' };
  }
  // Lowest priority: a never-produced step. Surfaced (labelled honestly) only when the
  // entity has nothing more urgent — real work always outranks "start something new".
  for (let i = 0; i < steps.length; i++) {
    if (statusByStep(steps[i], i) === 'unproduced') return { step: steps[i], index: i, priority: 'unproduced' };
  }
  return null;
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
 * Build every entity's most-urgent candidate across all catalogs via the shared
 * `deriveEntityArtifacts`, then rank + slice to the top N. Config-complete entities
 * contribute nothing.
 */
export function buildGlobalCoach(inputs: CoachCatalogInput[], topN: number): CoachCandidate[] {
  const candidates: CoachCandidate[] = [];
  for (const cin of inputs) {
    for (const e of cin.entities) {
      const serverRow = cin.serverByEntity.get(e.id);
      const serverArts: Record<string, PipelineArtifact> = {};
      const serverAsLocal: Record<string, LabStepArtifact> = {};
      if (serverRow) {
        for (const [step, art] of serverRow) { serverArts[step] = art; serverAsLocal[step] = asLocal(art); }
      }
      const effective = { ...serverAsLocal, ...(cin.localByEntity[e.id] ?? {}) }; // add-only: local wins
      const { displayStatus, driftByStep, artifactByStep } = deriveEntityArtifacts(cin.catalogId, e, cin.steps, effective, serverArts);
      const issue = pickEntityIssue(cin.steps, displayStatus, driftByStep);
      if (!issue) continue;
      // The concrete reason: for drift, the local-vs-server disagreement; otherwise the
      // reason carried on the derived artifact (fail/deferred checker output). Undefined
      // for a pending step (nothing has run yet) → the row shows the generic hint.
      const drift = driftByStep.get(issue.step);
      const reason = issue.priority === 'drift'
        ? (drift ? `local reads ${drift.local}, server says ${drift.server}` : undefined)
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
  }
  return rankCoachCandidates(candidates, topN);
}
