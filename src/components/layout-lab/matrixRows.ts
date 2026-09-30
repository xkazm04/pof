import { summarizeEntity, type EntityRollup } from '@/lib/catalog/rollup';
import { deriveEntityArtifacts, type StepDisplayStatus } from './hooks/useEntityArtifacts';
import type { LabEntity } from './useLabCatalogData';
import type { LabStepArtifact } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepLabelsForProfile } from '@/lib/catalog/stepScope';

export interface MatrixBlocker { step: string; reason: string }
export interface MatrixRow {
  id: string;
  name: string;
  statusByStep: (s: string) => StepDisplayStatus;
  /** Whether the step is part of THIS entity's pipeline (profile-scoped steps, /diablo W05 D18). */
  applies: (s: string) => boolean;
  /** The step's index in this entity's own step list (what the rail opens), or -1. */
  stepIndex: (s: string) => number;
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
 *
 * Throw containment comes from that shared path too (`gradeStepGuarded`): a checker that
 * throws on one entity's step degrades THAT cell to the `UNGRADED:` non-verdict — surfacing
 * as a blocker with the reason — instead of aborting the whole `entities.map` and taking the
 * matrix (and, since this runs during derivation, the app shell) down with it.
 */
export function buildMatrixRows(
  catalogId: string,
  entities: LabEntity[],
  serverByEntity: Map<string, Map<string, PipelineArtifact>>,
  localByEntity: Record<string, Record<string, LabStepArtifact>>,
  steps: string[],
  /** The catalog's judge verdicts, so a matrix cell carries the same judge bridge the
   *  step banner applies. Absent → no judge overlay (never a fabricated verdict). */
  verdicts: JudgeVerdict[] = [],
): MatrixRow[] {
  const pipeline = getCatalogPipeline(catalogId);
  return entities.map((e) => {
    // This entity's own steps: a step scoped to other canon profiles is not part of its pipeline.
    const own = stepLabelsForProfile(pipeline, steps, e.canonProfile);
    const ownSet = new Set(own);
    const serverRow = serverByEntity.get(e.id);
    const serverArts: Record<string, PipelineArtifact> = {};
    const serverAsLocal: Record<string, LabStepArtifact> = {};
    if (serverRow) {
      for (const [step, art] of serverRow) { serverArts[step] = art; serverAsLocal[step] = asLocal(art); }
    }
    const effective = { ...serverAsLocal, ...(localByEntity[e.id] ?? {}) }; // add-only: local wins

    const { artifacts, displayStatus } = deriveEntityArtifacts(catalogId, e, own, effective, serverArts, {}, verdicts);
    // Precompute per-step status once (O(steps)) instead of re-deriving per cell (O(steps²)).
    const statusMap = new Map<string, StepDisplayStatus>(own.map((s, i) => [s, displayStatus(s, i)]));

    // The concrete checker reason is already carried on each derived artifact
    // (deriveEntityArtifacts records `res.reason`), so blockers read it directly —
    // no second `resolveAccept` pass over the same data.
    const blockers: MatrixBlocker[] = artifacts
      .filter((a) => a.status === 'fail')
      .map((a) => ({ step: a.step, reason: a.reason ?? 'failed acceptance' }));

    return {
      id: e.id,
      name: e.name,
      statusByStep: (s: string) => statusMap.get(s) ?? 'pending',
      applies: (s: string) => ownSet.has(s),
      stepIndex: (s: string) => own.indexOf(s),
      rollup: summarizeEntity(artifacts, own.length),
      blockers,
    };
  });
}
