'use client';

import { useMemo } from 'react';
import { resolveAccept } from '../labAcceptance';
import { labStepsDone } from '../labPipelines';
import type { LabStepArtifact } from '../labPipelineStore';
import type { LabEntity } from '../useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

/** Per-step display vocabulary, shared with PipelineRollup. */
export type StepDisplayStatus = 'pass' | 'fail' | 'deferred' | 'pending';

export interface EntityArtifacts {
  /** Server-faithful per-step artifacts (config-complete/tier derived via the same accept logic the server stored). */
  artifacts: PipelineArtifact[];
  /** Per-step artifact lookup for the timeline (so failed/deferred gates aren't invisible). */
  artifactByStep: Map<string, PipelineArtifact>;
  /** Display status mirroring PipelineRollup's vocabulary; legacy `stepDone` maps to `pass` when no artifact exists. */
  displayStatus: (step: string, i: number) => StepDisplayStatus;
  /** Whether a step reads as done (Items: real produce state; others: the lifecycle heuristic). */
  stepDone: (step: string, i: number) => boolean;
  /** Count of done steps. */
  done: number;
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
  const isItems = catalogId === 'items';

  // Real per-step production state (Items is fully data-backed; others use the lifecycle pseudo-progress).
  const stepDone = (step: string, i: number) =>
    isItems ? !!entitySteps?.[step]?.done : i < (entity ? labStepsDone(entity.lifecycle, steps.length) : 0);
  const done = steps.filter((s, i) => stepDone(s, i)).length;

  // Server-faithful rollup: derives config-complete/tier using the same accept logic the server stored.
  const artifacts: PipelineArtifact[] = catalogId
    ? steps.filter((s) => entitySteps?.[s]).map((s) => {
        const art = entitySteps![s];
        const accept = resolveAccept(catalogId, s);
        const res = accept ? accept(art.data) : null;
        const localStatus = res?.status ?? 'pass';
        // Overlay the runner's verdict: when the local recompute is still `deferred`
        // (an unrun L3/L4 gate) but the server has a real pass/fail, the server wins.
        const srv = serverArts[s];
        const status = localStatus === 'deferred' && srv && srv.status !== 'deferred' && srv.status !== 'pending' ? srv.status : localStatus;
        return { catalogId, entityId: entity?.id ?? '', step: s, data: art.data, ueAssets: art.ueAssets, status, ...(res?.tier ? { tier: res.tier } : {}) };
      })
    : [];

  const artifactByStep = new Map(artifacts.map((a) => [a.step, a]));

  // Display status mirrors PipelineRollup's vocabulary: pass/fail/deferred/pending.
  // For non-Items catalogs without artifacts, the legacy `stepDone` heuristic maps to `pass`.
  const displayStatus = (step: string, i: number): StepDisplayStatus => {
    const a = artifactByStep.get(step);
    if (a) return a.status === 'pass' || a.status === 'fail' || a.status === 'deferred' ? a.status : 'pending';
    return stepDone(step, i) ? 'pass' : 'pending';
  };

  return { artifacts, artifactByStep, displayStatus, stepDone, done };
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
