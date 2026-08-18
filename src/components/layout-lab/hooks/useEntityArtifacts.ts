'use client';

import { useMemo } from 'react';
import { resolveAccept } from '../labAcceptance';
import { buildLabCheckerContext } from '../labCheckerContext';
import { contentDiverges } from '../labContentDrift';
import { resolveStepAcceptance, verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { useCatalogJudgeVerdicts } from './useStepJudgeVerdicts';
import { logger } from '@/lib/logger';
import type { AcceptanceResult, CheckerContext } from '@/lib/catalog/acceptance/types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { LabStepArtifact } from '../labPipelineStore';
import type { LabEntity } from '../useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/**
 * Per-step display vocabulary, shared with PipelineRollup.
 * `unproduced` = no artifact exists for the step (never produced) — the honest
 * state that replaced the old lifecycle-fraction pseudo-progress. Distinct from
 * `pending` (an artifact EXISTS but its acceptance is still resolving).
 */
export type StepDisplayStatus = 'pass' | 'fail' | 'deferred' | 'pending' | 'unproduced';

/**
 * A step where local and server genuinely diverge — in either of the two ways they can.
 *
 * `status` drift is a CONCRETE local pass/fail contradicting a concrete server pass/fail
 * (never `unproduced`/`pending`, and never the sanctioned `deferred`→server resolution).
 *
 * `content` drift is the quieter one the lab used to be blind to: both sides report the
 * SAME verdict, but the produced data is not the same — another session, the MCP submit
 * path or a headless run rewrote the step and the checker still graded it identically. The
 * verdict alone can never reveal it, so it is compared by content fingerprint
 * (`labContentDrift.ts`).
 */
export interface StepDrift {
  /** Which kind of divergence this is (see above). */
  kind: 'status' | 'content';
  /** What the local recompute (add-only kept data) reads as. */
  local: PipelineArtifact['status'];
  /** What the server stored (its own re-grade / runner outcome). */
  server: PipelineArtifact['status'];
}

export interface EntityArtifacts {
  /** Server-faithful per-step artifacts (config-complete/tier derived via the same accept logic the server stored). */
  artifacts: PipelineArtifact[];
  /** Per-step artifact lookup for the timeline (so failed/deferred gates aren't invisible). */
  artifactByStep: Map<string, PipelineArtifact>;
  /** Display status mirroring PipelineRollup's vocabulary; a step with no artifact reads as `unproduced` (never a heuristic pass). */
  displayStatus: (step: string, i: number) => StepDisplayStatus;
  /** Whether a step was actually produced (has an artifact) — real state for every catalog, no lifecycle heuristic. */
  stepDone: (step: string, i: number) => boolean;
  /** Count of done steps. */
  done: number;
  /**
   * Steps whose add-only local verdict disagrees with a concrete server verdict — the
   * silent divergence the add-only hydration would otherwise hide. Excludes the
   * sanctioned `deferred`→server overlay (that is resolution, not drift). Empty in the
   * happy path; a UI badge + "adopt server truth" affordance keys off it.
   */
  driftByStep: Map<string, StepDrift>;
}

/**
 * The `UNGRADED:` stamp (Rule 4b) a step carries when nothing could grade it. Exported so
 * consumers and tests key off ONE literal rather than re-spelling the prefix.
 */
export const UNGRADED_PREFIX = 'UNGRADED:';

/** Normalize whatever a checker threw into the actionable part of the reason. */
function thrownReason(e: unknown): string {
  if (e instanceof Error) return e.message.trim() || e.name || 'Error';
  if (typeof e === 'string' && e.trim()) return e.trim();
  return String(e).trim() || 'unknown error';
}

/**
 * The verdict a step gets when its Acceptance checker THREW while being derived.
 *
 * ── Why `fail`, and why not the three alternatives ─────────────────────────────
 * Checkers are arbitrary functions over artifact `data` — untrusted input from produce
 * bodies, the MCP submit path and headless drains — so they demonstrably throw (the same
 * hazard `StepCrashBoundary` exists for on the render side). Whatever this returns must be
 * impossible to read as verified:
 *  - **not `null`** — `null` already means "no checker resolvable", and every caller reads
 *    that as "use my own status" (falling back to `pass`). Folding a throw into it would
 *    persist a fabricated pass for data no checker ever read.
 *  - **not `deferred`** — that is the one status `serverVerdictOverlay` adopts a concrete
 *    server verdict over, so a crashed grade would be silently replaced by a (possibly
 *    stale) server `pass`. Same fabricated-pass hole by a longer route.
 *  - **not `pending`** — the lab's `pending` means "produced, acceptance still resolving"
 *    (see `coachLadder`), i.e. transient in-flight work. A throw is terminal, not in-flight.
 * `fail` is the only status no downstream layer can quietly upgrade (the judge bridge only
 * ever down-grades), so it survives to the screen — and the `UNGRADED:` reason travels with
 * it everywhere the status goes (rail tooltip, matrix blocker, coach row), saying plainly
 * that this is NOT a verdict on the step's content.
 */
export function ungradedResult(step: string, err: unknown): AcceptanceResult {
  const msg = thrownReason(err);
  return {
    label: step,
    status: 'fail',
    tier: 'L0',
    detail: `Acceptance checker threw while deriving this step — ${msg}`,
    reason: `${UNGRADED_PREFIX} the Acceptance checker THREW while deriving this step — ${msg}. `
      + 'No grade could be computed, so this is not a verdict on the step\'s content (neither a pass nor a failed gate).',
  };
}

/** One step's grade, plus whether it is the {@link ungradedResult} degradation. */
export interface GuardedGrade {
  /** The checker's result, the `UNGRADED` degradation, or `null` when no checker resolved. */
  result: AcceptanceResult | null;
  /** True ONLY when a resolved checker threw — never for the `null` no-checker case. */
  ungraded: boolean;
}

/**
 * Resolve + run a step's Acceptance checker with the throw contained to THAT step.
 *
 * `labGrade` (the write-through's entry point) is deliberately throw-transparent so the
 * persisted status can never diverge from the displayed one — see its doc comment. That
 * leaves each CALL SITE to decide what a throw means for it, and for the derive side the
 * answer is: degrade this one step, keep deriving the rest. `deriveEntityArtifacts` runs
 * inside `useBaseline` BEFORE any component renders, so `StepCrashBoundary` cannot catch a
 * throw here — only `app/error.tsx` can, which replaces the entire app shell. This guard is
 * what keeps one bad artifact from taking down the canvas, the CatalogMatrix and the global
 * coach (all three derive through this function).
 */
export function gradeStepGuarded(
  catalogId: string,
  step: string,
  data: Record<string, unknown>,
  ctx: CheckerContext | undefined,
): GuardedGrade {
  try {
    const accept = resolveAccept(catalogId, step);
    // No checker for this (catalog, step): the caller's own status stands — unchanged behaviour.
    if (!accept) return { result: null, ungraded: false };
    return { result: accept(data, ctx), ungraded: false };
  } catch (err) {
    logger.error(`[lab] acceptance checker threw for ${catalogId}/${step}`, err);
    return { result: ungradedResult(step, err), ungraded: true };
  }
}

/**
 * Pure derivation of an entity's pipeline artifacts + display status from its
 * produced steps, the server runner's stored verdicts, and the judge verdicts.
 * Kept side-effect free (no React) so the merge rules are unit-testable in isolation.
 *
 * Every step is graded through the ONE shared truth
 * ({@link resolveStepAcceptance}: checker → server drain overlay → judge bridge), the same
 * function the step banner (`useStepAcceptance`) and the headless/`/status` path call. Until
 * that consolidation this derivation stopped after the server overlay, so a judge-failed
 * step showed a green rail dot beside its own red banner.
 */
export function deriveEntityArtifacts(
  catalogId: string | undefined,
  entity: LabEntity | null,
  steps: string[],
  entitySteps: Record<string, LabStepArtifact> | undefined,
  serverArts: Record<string, PipelineArtifact>,
  /** Live entity index for the shared CheckerContext's `has` (cross-catalog links).
   *  Optional so ctx-free callers keep working; absent → nothing resolves, exactly as before. */
  entitiesByCatalog: Record<string, Record<string, unknown>> = {},
  /** The catalog's judge verdicts (unscoped by step — scoped per step here). Absent → no
   *  judge overlay, i.e. exactly the pre-consolidation behaviour, never a fabricated verdict. */
  verdicts: JudgeVerdict[] = [],
): EntityArtifacts {
  // Real per-step production state for EVERY catalog: a step is "done" iff it was
  // actually produced (has an artifact in the local store, hydrated add-only from
  // the server). The old lifecycle-fraction heuristic — which fabricated pass/pending
  // for non-Items entities that had never produced anything — is gone; entities with
  // no artifact now read as honestly `unproduced` rather than fake progress.
  const stepDone = (step: string) => !!entitySteps?.[step]?.done;
  const done = steps.filter((s) => stepDone(s)).length;

  // Server-faithful rollup: derives config-complete/tier using the same accept logic the server stored.
  const driftByStep = new Map<string, StepDrift>();
  // ONE CheckerContext construction, shared with the step banner and the write-through
  // (labCheckerContext.ts): sibling artifacts (step → data) let derived checkers (e.g. the
  // Items Test Gate) read upstream acceptance, and `has` resolves cross-catalog links
  // against the live entity index instead of the old pessimistic `() => false`.
  const checkerCtx = catalogId ? buildLabCheckerContext(catalogId, entitySteps, entitiesByCatalog) : undefined;
  const artifacts: PipelineArtifact[] = catalogId
    ? steps.filter((s) => entitySteps?.[s]).map((s) => {
        const art = entitySteps![s];
        const { result: res, ungraded } = gradeStepGuarded(catalogId, s, art.data, checkerCtx);
        const srv = serverArts[s];
        const base = { catalogId, entityId: entity?.id ?? '', step: s, data: art.data, ueAssets: art.ueAssets };
        if (ungraded) {
          // The checker threw: this step has NO verdict, so it short-circuits the merge
          // entirely. Nothing may be overlaid onto a non-verdict — the server overlay and the
          // judge bridge both reason about a verdict that exists — and it is deliberately NOT
          // reported as drift below: drift means two verdicts disagree, and there is only one
          // here. The `UNGRADED:` reason is what the user reads.
          const g = res!;
          return { ...base, status: g.status, tier: g.tier, ...(g.reason ? { reason: g.reason } : {}) };
        }
        // Grade through the ONE shared truth: checker → server drain overlay → judge bridge.
        const local: AcceptanceResult = res ?? { label: s, status: 'pass', tier: 'L0', detail: '' };
        const merged = resolveStepAcceptance({
          catalogId, step: s, local, persisted: srv,
          verdicts: verdictsForStep(verdicts, entity?.id ?? '', s),
          // Bind each verdict to the content the step holds now (see judgeBridge).
          data: art.data, updatedAt: srv?.updatedAt ?? art.at,
        });
        const status = merged.status;
        const reason = merged.reason;
        // Drift: the status this surface actually SHOWS (post-overlay, post-judge-bridge)
        // contradicting a concrete server pass/fail. Comparing the PRE-bridge checker status
        // (the old behaviour) made the most important divergence invisible: a judge-condemned
        // step reads `fail` on screen while the server row still says `pass`, and DriftBanner /
        // nextActionableStep never heard about it. A local `deferred` resolved BY the server is
        // reconciliation, not drift — `serverVerdictOverlay` has already adopted the server's
        // verdict there, so `status === srv.status` and nothing is flagged.
        // A step whose write-through is on record as failed already tells this story
        // precisely (its own banner + rail badge + retry), so it is not double-reported here.
        if (srv && !art.syncError) {
          if ((status === 'pass' || status === 'fail') && (srv.status === 'pass' || srv.status === 'fail') && status !== srv.status) {
            driftByStep.set(s, { kind: 'status', local: status, server: srv.status });
          } else if (status === srv.status && contentDiverges(art, srv)) {
            // Same verdict, different produced data — invisible to a status-only comparison.
            driftByStep.set(s, { kind: 'content', local: status, server: srv.status });
          }
        }
        return { ...base, status, ...(merged.tier ? { tier: merged.tier } : {}), ...(reason ? { reason } : {}) };
      })
    : [];

  const artifactByStep = new Map(artifacts.map((a) => [a.step, a]));

  // Display status mirrors PipelineRollup's vocabulary. A produced step reports its
  // real artifact status (pass/fail/deferred, else `pending` while acceptance resolves);
  // a step with NO artifact is honestly `unproduced` — never a heuristic pass.
  const displayStatus = (step: string): StepDisplayStatus => {
    const a = artifactByStep.get(step);
    if (a) return a.status === 'pass' || a.status === 'fail' || a.status === 'deferred' ? a.status : 'pending';
    return 'unproduced';
  };

  return { artifacts, artifactByStep, displayStatus, stepDone, done, driftByStep };
}

/**
 * React wrapper around {@link deriveEntityArtifacts}. Lets the Baseline component
 * focus on layout while the artifact + status-overlay derivation lives in one
 * testable place. Reads the catalog's judge verdicts itself (one shared, cached fetch per
 * catalog) so the rail/matrix/coach cannot fall behind the banner's judge bridge.
 */
export function useEntityArtifacts(
  catalogId: string | undefined,
  entity: LabEntity | null,
  steps: string[],
  entitySteps: Record<string, LabStepArtifact> | undefined,
  serverArts: Record<string, PipelineArtifact>,
  entitiesByCatalog: Record<string, Record<string, unknown>> = {},
): EntityArtifacts {
  const verdicts = useCatalogJudgeVerdicts(catalogId);
  return useMemo(
    () => deriveEntityArtifacts(catalogId, entity, steps, entitySteps, serverArts, entitiesByCatalog, verdicts),
    [catalogId, entity, steps, entitySteps, serverArts, entitiesByCatalog, verdicts],
  );
}
