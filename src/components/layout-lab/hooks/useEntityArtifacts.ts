'use client';

import { useMemo } from 'react';
import { resolveAccept } from '../labAcceptance';
import { buildLabCheckerContext } from '../labCheckerContext';
import { resolveStepAcceptance, verdictsForStep } from '@/lib/catalog/acceptance/resolveStepAcceptance';
import { useCatalogJudgeVerdicts } from './useStepJudgeVerdicts';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
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

/** A step where the local-derived verdict and the server-stored verdict genuinely diverge.
 *  Drift is only ever flagged for a CONCRETE local pass/fail contradicting a concrete
 *  server pass/fail (never `unproduced`/`pending`/`deferred`), so `local` narrows to pass|fail. */
export interface StepDrift {
  /** What the local recompute (add-only kept data) reads as. */
  local: 'pass' | 'fail';
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
        const accept = resolveAccept(catalogId, s);
        const res = accept ? accept(art.data, checkerCtx) : null;
        // Grade through the ONE shared truth: checker → server drain overlay → judge bridge.
        const srv = serverArts[s];
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
        if (srv && (status === 'pass' || status === 'fail') && (srv.status === 'pass' || srv.status === 'fail') && status !== srv.status) {
          driftByStep.set(s, { local: status, server: srv.status });
        }
        return { catalogId, entityId: entity?.id ?? '', step: s, data: art.data, ueAssets: art.ueAssets, status, ...(merged.tier ? { tier: merged.tier } : {}), ...(reason ? { reason } : {}) };
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
