import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import { deriveEntityArtifacts, type StepDisplayStatus } from './hooks/useEntityArtifacts';
import { resolveAccept } from './labAcceptance';
import type { LabEntity } from './useLabCatalogData';
import type { LabStepArtifact } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

export interface MatrixBlocker { step: string; reason: string }
export interface MatrixRow {
  id: string;
  name: string;
  statusByStep: (s: string) => StepDisplayStatus;
  rollup: EntityRollup;
  blockers: MatrixBlocker[];
}

/** Project a server artifact into the local artifact shape so it can seed the shared derivation. */
function asLocal(a: PipelineArtifact): LabStepArtifact {
  return { done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? '' };
}

/**
 * Build the CatalogMatrix rows through the SAME `deriveEntityArtifacts` path the rail
 * uses — so the matrix and the rail can never disagree about a step's status. For each
 * entity the effective per-step input is the add-only merge of the local store OVER the
 * server artifacts (local wins, exactly as `hydrateEntity` does for the open entity), then
 * `deriveEntityArtifacts` applies the shared accept-recompute + `deferred`→server overlay.
 */
export function buildMatrixRows(
  catalogId: string,
  entities: LabEntity[],
  serverByEntity: Map<string, Map<string, PipelineArtifact>>,
  localByEntity: Record<string, Record<string, LabStepArtifact>>,
  steps: string[],
): MatrixRow[] {
  return entities.map((e) => {
    const serverRow = serverByEntity.get(e.id);
    const serverArts: Record<string, PipelineArtifact> = {};
    const serverAsLocal: Record<string, LabStepArtifact> = {};
    if (serverRow) {
      for (const [step, art] of serverRow) { serverArts[step] = art; serverAsLocal[step] = asLocal(art); }
    }
    const effective = { ...serverAsLocal, ...(localByEntity[e.id] ?? {}) }; // add-only: local wins

    const { artifacts, displayStatus } = deriveEntityArtifacts(catalogId, e, steps, effective, serverArts);
    // Precompute per-step status once (O(steps)) instead of re-deriving per cell (O(steps²)).
    const statusMap = new Map<string, StepDisplayStatus>(steps.map((s, i) => [s, displayStatus(s, i)]));

    const blockers: MatrixBlocker[] = artifacts.filter((a) => a.status === 'fail').map((a) => {
      const accept = resolveAccept(catalogId, a.step);
      const res = accept ? accept(a.data) : null; // reuse the accept() fn for a human reason
      return { step: a.step, reason: res?.reason ?? res?.detail ?? a.reason ?? 'failed acceptance' };
    });

    return {
      id: e.id,
      name: e.name,
      statusByStep: (s: string) => statusMap.get(s) ?? 'pending',
      rollup: summarizeEntity(artifacts, steps.length),
      blockers,
    };
  });
}
