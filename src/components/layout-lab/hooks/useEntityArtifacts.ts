'use client';

import { useMemo } from 'react';
import { resolveAccept } from '../labAcceptance';
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
 * produced steps and the server runner's stored verdicts. Kept side-effect free
 * (no React) so the subtlest rule — the local-`deferred` → server pass/fail
 * overlay precedence — is unit-testable in isolation.
 *
 * The overlay rule: a local recompute can only ever yield `deferred` for an
 * unrun L3/L4 Test Gate; when the server has a real pass/fail for that step the
 * server verdict wins (but a server `deferred`/`pending` never overrides).
 */
export function deriveEntityArtifacts(
  catalogId: string | undefined,
  entity: LabEntity | null,
  steps: string[],
  entitySteps: Record<string, LabStepArtifact> | undefined,
  serverArts: Record<string, PipelineArtifact>,
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
  // Sibling artifacts (step → data) let derived checkers (e.g. the Items Test
  // Gate) read upstream acceptance instead of trusting fabricated step data.
  const siblings: Record<string, Record<string, unknown>> = {};
  for (const [s, a] of Object.entries(entitySteps ?? {})) siblings[s] = a.data;
  const checkerCtx = catalogId ? { catalog: catalogId, siblings, has: () => false } : undefined;
  const artifacts: PipelineArtifact[] = catalogId
    ? steps.filter((s) => entitySteps?.[s]).map((s) => {
        const art = entitySteps![s];
        const accept = resolveAccept(catalogId, s);
        const res = accept ? accept(art.data, checkerCtx) : null;
        const localStatus = res?.status ?? 'pass';
        // Overlay the runner's verdict: when the local recompute is still `deferred`
        // (an unrun L3/L4 gate) but the server has a real pass/fail, the server wins.
        const srv = serverArts[s];
        const usedServerOverlay = localStatus === 'deferred' && !!srv && srv.status !== 'deferred' && srv.status !== 'pending';
        const status = usedServerOverlay ? srv!.status : localStatus;
        // Carry the concrete checker reason through so coaches/tooltips can show WHY a
        // step failed/deferred without a second `resolveAccept` pass. When the server
        // overlay won, its reason is the authoritative one; otherwise the local recompute's.
        const reason = usedServerOverlay ? srv!.reason : res?.reason;
        // Drift: a concrete local pass/fail that a concrete server pass/fail contradicts —
        // the add-only default keeps `localStatus` on screen, so flag it for adoption.
        // (The deferred case above is reconciliation, not drift, and is excluded here.)
        if (srv && (localStatus === 'pass' || localStatus === 'fail') && (srv.status === 'pass' || srv.status === 'fail') && localStatus !== srv.status) {
          driftByStep.set(s, { local: localStatus, server: srv.status });
        }
        return { catalogId, entityId: entity?.id ?? '', step: s, data: art.data, ueAssets: art.ueAssets, status, ...(res?.tier ? { tier: res.tier } : {}), ...(reason ? { reason } : {}) };
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
 * testable place.
 */
export function useEntityArtifacts(
  catalogId: string | undefined,
  entity: LabEntity | null,
  steps: string[],
  entitySteps: Record<string, LabStepArtifact> | undefined,
  serverArts: Record<string, PipelineArtifact>,
): EntityArtifacts {
  return useMemo(
    () => deriveEntityArtifacts(catalogId, entity, steps, entitySteps, serverArts),
    [catalogId, entity, steps, entitySteps, serverArts],
  );
}
