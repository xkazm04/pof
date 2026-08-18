import { deriveEntityArtifacts, type StepDisplayStatus, type StepDrift } from './hooks/useEntityArtifacts';
import { COACH_PRIORITY_RANK, pickLadderIssue, type CoachPriority } from './coachLadder';
import { resolveAccept } from './labAcceptance';
import { buildLabCheckerContext } from './labCheckerContext';
import { labContentHash } from './labContentDrift';
import { resolveStepAcceptance, verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StepSummary } from './stepSummary';
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
    const candidate = assembleCandidate(
      cin.catalogId, cin.catalogLabel, e, cin.steps,
      displayStatus, driftByStep, (step) => artifactByStep.get(step)?.reason,
    );
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

/**
 * Turn ONE entity's derived per-step state into its coach candidate (or `null` when nothing
 * is actionable). Shared by both builders below, so the ladder pick and the reason wording
 * are single-sourced: a summary-derived candidate and an artifact-derived one for the same
 * entity are assembled by literally the same code.
 */
function assembleCandidate(
  catalogId: string,
  catalogLabel: string,
  entity: { id: string; name: string },
  steps: string[],
  displayStatus: (step: string, i: number) => StepDisplayStatus,
  driftByStep: Map<string, StepDrift>,
  reasonForStep: (step: string) => string | undefined,
): CoachCandidate | null {
  const issue = pickEntityIssue(steps, displayStatus, driftByStep);
  if (!issue) return null;
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
    : reasonForStep(issue.step);
  return {
    catalogId,
    catalogLabel,
    entityId: entity.id,
    entityName: entity.name,
    step: issue.step,
    stepIndex: issue.index,
    priority: issue.priority,
    ...(reason ? { reason } : {}),
  };
}

/** Per-step state the coach needs, derived WITHOUT the produced blobs. */
export interface EntitySummaryDerivation {
  displayStatus: (step: string, i: number) => StepDisplayStatus;
  driftByStep: Map<string, StepDrift>;
  reasonForStep: (step: string) => string | undefined;
}

/**
 * The blob-free twin of `deriveEntityArtifacts` — one entity's per-step display status,
 * drift and reasons derived from LOCAL artifacts plus the server's verdict PROJECTION
 * ({@link StepSummary}) instead of its produced `data`.
 *
 * ── What is identical, and what is not (stated, not assumed) ───────────────────
 * Every step the local store holds is graded exactly as before: the same `resolveAccept`
 * over the same local `data`, through the same `resolveStepAcceptance` (checker → server
 * overlay → judge bridge), with the judge binding built from the same `stepContentHash`.
 * Content drift is the same comparison too — `labContentHash` on the local side against the
 * server's `driftHash`, both produced by that one function.
 *
 * A step that exists ONLY on the server is the one difference: with no blob to re-grade,
 * its verdict is the one the SERVER persisted. That is not a second source of truth — the
 * artifacts POST route re-grades every write with the step's own Checker, so the persisted
 * status IS the checker verdict for every registered pipeline (measured against the real
 * `~/.pof/pof.db`: 786 of 817 rows identical; all 31 differences are in the one bespoke
 * catalog, `items`, whose steps the server cannot grade and whose stored status therefore
 * dates from whenever it was last produced). `useGlobalCoach` prefers the full-artifact
 * derivation whenever a catalog's blobs are already in the cache, so the catalog on screen
 * is never coached from a thinner input than the one the Matrix is rendering.
 */
export function deriveEntityFromSummary(
  catalogId: string,
  entityId: string,
  steps: string[],
  localSteps: Record<string, LabStepArtifact> | undefined,
  summaryByStep: Map<string, StepSummary> | undefined,
  verdicts: JudgeVerdict[] = [],
): EntitySummaryDerivation {
  // Siblings come from the local artifacts only — the server's blobs are exactly what this
  // path does not fetch. For any entity that has been OPENED this is lossless: hydration
  // adopts every server row into the local store, so local ⊇ server. An entity nobody has
  // opened has no local steps at all, so no sibling-reading checker runs here in the first
  // place. `has` matches the artifact path's own cross-catalog resolution for this surface
  // (`buildCatalogCandidates` passes `{}` too).
  const ctx = buildLabCheckerContext(catalogId, localSteps, {});
  const driftByStep = new Map<string, StepDrift>();
  const statusByStep = new Map<string, StepDisplayStatus>();
  const reasonByStep = new Map<string, string>();

  for (const step of steps) {
    const local = localSteps?.[step];
    const srv = summaryByStep?.get(step);
    if (!local && !srv) continue; // never produced anywhere → `unproduced` (the default below)

    let merged: AcceptanceResult;
    if (local) {
      const accept = resolveAccept(catalogId, step);
      const res = accept ? accept(local.data, ctx) : null;
      const localResult: AcceptanceResult = res ?? { label: step, status: 'pass', tier: 'L0', detail: '' };
      merged = resolveStepAcceptance({
        catalogId, step, local: localResult, persisted: srv,
        verdicts: verdictsForStep(verdicts, entityId, step),
        data: local.data, updatedAt: srv?.updatedAt ?? local.at,
      });
      if (srv && !local.syncError) {
        const s = merged.status;
        if ((s === 'pass' || s === 'fail') && (srv.status === 'pass' || srv.status === 'fail') && s !== srv.status) {
          driftByStep.set(step, { kind: 'status', local: s, server: srv.status });
        } else if (s === srv.status && labContentHash(local.data, local.ueAssets) !== srv.driftHash) {
          // Same verdict, different produced content — the fingerprint survives the blob-free
          // payload because the server computed it with the SAME `labContentHash`.
          driftByStep.set(step, { kind: 'content', local: s, server: srv.status });
        }
      }
    } else {
      // Server-only: the persisted verdict IS the checker's (the POST route grades every
      // write). It still flows through `resolveStepAcceptance`, so the judge bridge applies
      // — bound to the content on record via the summary's own `contentHash`, never left
      // unbound (which would silently downgrade every verdict's provenance to `unknown`).
      const persisted: AcceptanceResult = {
        label: step, status: srv!.status, tier: srv!.tier ?? 'L0', detail: srv!.reason ?? '',
        ...(srv!.reason ? { reason: srv!.reason } : {}),
      };
      merged = resolveStepAcceptance({
        catalogId, step, local: persisted, persisted: srv,
        verdicts: verdictsForStep(verdicts, entityId, step),
        content: { hash: srv!.contentHash, ...(srv!.updatedAt ? { updatedAt: srv!.updatedAt } : {}) },
      });
    }

    statusByStep.set(step, merged.status === 'pass' || merged.status === 'fail' || merged.status === 'deferred' ? merged.status : 'pending');
    if (merged.reason) reasonByStep.set(step, merged.reason);
  }

  return {
    displayStatus: (step: string) => statusByStep.get(step) ?? 'unproduced',
    driftByStep,
    reasonForStep: (step: string) => reasonByStep.get(step),
  };
}

/** Per-catalog input to the blob-free aggregation (mirrors {@link CoachCatalogInput}). */
export interface CoachSummaryInput {
  catalogId: string;
  catalogLabel: string;
  steps: string[];
  entities: LabEntity[];
  /** The catalog's verdict projection, grouped by entity id. */
  summaryByEntity: Map<string, Map<string, StepSummary>>;
  /** Local produced steps by entity id (add-only overlay; local wins). */
  localByEntity: Record<string, Record<string, LabStepArtifact>>;
}

/** Group a catalog's flat summary rows into `entityId → step → row`. */
export function groupSummaryByEntity(rows: StepSummary[]): Map<string, Map<string, StepSummary>> {
  const byEntity = new Map<string, Map<string, StepSummary>>();
  for (const r of rows) {
    const row = byEntity.get(r.entityId) ?? new Map<string, StepSummary>();
    row.set(r.step, r);
    byEntity.set(r.entityId, row);
  }
  return byEntity;
}

/**
 * Every actionable candidate for ONE catalog, derived from the blob-free summary — the
 * whole-project first-paint path. Same ladder, same reason wording, same output shape as
 * {@link buildCatalogCandidates} (both end in {@link assembleCandidate}); only the INPUT is
 * thinner. See {@link deriveEntityFromSummary} for exactly where the two can differ.
 */
export function buildCatalogCandidatesFromSummary(cin: CoachSummaryInput, verdicts: JudgeVerdict[] = []): CoachCandidate[] {
  const candidates: CoachCandidate[] = [];
  for (const e of cin.entities) {
    const derived = deriveEntityFromSummary(
      cin.catalogId, e.id, cin.steps, cin.localByEntity[e.id], cin.summaryByEntity.get(e.id), verdicts,
    );
    const candidate = assembleCandidate(
      cin.catalogId, cin.catalogLabel, e, cin.steps,
      derived.displayStatus, derived.driftByStep, derived.reasonForStep,
    );
    if (candidate) candidates.push(candidate);
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
