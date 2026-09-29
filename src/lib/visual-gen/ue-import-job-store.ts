/**
 * In-memory job store for UE imports of generated meshes — the seam that gives
 * `importGlbToUE` a caller.
 *
 * `ue-import.ts` was built and tested and then sat with ZERO production consumers: a
 * consumer census on 2026-09-07 returned only its own test file, so nothing in the app
 * imported a generated mesh into UE at all. The pipeline wrote `.glb` under `generated/`,
 * graded it, and stopped; every UE import to date was a session driving the editor by hand
 * or through a probe script. This is the same gap `mesh-finish-job-store.ts` was written to
 * close for `runMeshFinish`, and it is closed the same way.
 *
 * Job-based for the reason every UE-touching store is: `importGlbToUE` launches the editor
 * (the glTF/Interchange importer is unreliable under `-run=pythonscript`), which takes
 * minutes — well past an HTTP timeout. POST starts a job and returns an id; GET polls it.
 * Module-global so it survives Next dev HMR; ephemeral, because the durable artifact is the
 * `.uasset` in the project.
 *
 * What this store adds beyond "call the function": the collision plan is DERIVED from the
 * mesh's own measured shell count rather than asserted by the caller, and the basis of that
 * derivation is recorded. A caller cannot know how many real shells a generated mesh has —
 * only the Tier-1 critic does — so asking the caller would have made every plan a guess
 * wearing a parameter.
 */
import { critiqueMesh, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { gateRequestFor } from './gate-request';
import type { MeshStage } from './critique-stage';
import { importGlbToUE, type UeImportResult } from './ue-import';
import {
  importScaleOf,
  planUeImport,
  type CollisionPlan,
  type CollisionPlanBasis,
  type CollisionUse,
  type ImportScale,
  type OrientationReport,
  type ScalePlan,
} from './ue-import-plan';

// The planner moved into the pure `ue-import-plan.ts` (node-free, so the client Import
// Automation view can render it). Re-exported so the plan-preview route and every existing
// importer keep importing these names from here.
export { collisionPlanFor, type CollisionPlanBasis, type PlanDerivation } from './ue-import-plan';

export interface UeImportJobSpec {
  /** The `.glb` to import — typically a `mesh-finish` output, not raw generator output. */
  glbPath: string;
  /** What the asset is FOR. Drives collision; there is no safe default, so it is required. */
  use: CollisionUse;
  destPath?: string;
  assetName?: string;
  /**
   * Shell count asserted by the caller. Used ONLY when the critic could not measure it —
   * a measurement always wins over an assertion.
   */
  components?: number;
  settleMs?: number;
  /**
   * What the mesh IS, for the gate request (`gateRequestFor`): resolves the class ceilings,
   * the nominal size (a character = the 1.8 m Mannequin) and whether it should stand.
   */
  assetClass?: string;
  /** Intended longest extent (m); overrides the class nominal. Absent + no nominal → no scale. */
  targetExtentM?: number;
}

export interface UeImportJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: UeImportJobSpec;
  /** Tier-1 gate result on the mesh being imported — the source of the shell count. */
  critique?: CritiqueResult;
  plan?: CollisionPlan;
  planBasis?: CollisionPlanBasis;
  /** Shells the plan was made from, whatever its basis. Absent when none was available. */
  shells?: number;
  /** The plan's scale: the gate-derived factor, or why none is derivable. Never a typed 1.0. */
  scale?: ScalePlan;
  /** Orientation as the same critique graded it — reported, never applied. */
  orientation?: OrientationReport;
  /** One line naming what the mesh was graded against (from `gateRequestFor`). */
  gradedAs?: string;
  result?: UeImportResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofUeImportJobs?: Map<string, UeImportJob> };
const jobs = g.pofUeImportJobs ?? new Map<string, UeImportJob>();
if (!g.pofUeImportJobs) g.pofUeImportJobs = jobs;

type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;
type Importer = (
  glbPath: string,
  opts: { destPath?: string; assetName?: string; settleMs?: number; collision?: CollisionPlan; scale?: ImportScale },
) => Promise<UeImportResult>;

/**
 * The stage of the mesh being imported, from where it sits under `generated/`: a mesh-finish
 * output is `finished`, anything else is generator output (`raw`). Pure.
 */
export function importStageFor(glbPath: string): MeshStage {
  return /(^|[\/])mesh-finish[\/]/i.test(glbPath) ? 'finished' : 'raw';
}

/**
 * Start an import. `critic`/`importer` are injectable for tests; they default to the real
 * Tier-1 gate and the real editor-driving import.
 *
 * The critic runs through `gateRequestFor` — the same gate request every generator's job
 * store builds — so the size target (class nominal or declared) and the upright expectation
 * reach it. Without them the scale grade is `unmeasured` at exactly the moment its correction
 * is meant to be applied.
 *
 * The critic is best-effort ON PURPOSE: a missing trimesh env must not block getting an
 * asset into the project. It costs the plan its evidence, which the job reports, rather
 * than costing the import.
 */
export function startUeImportJob(
  spec: UeImportJobSpec,
  deps: { critic?: Critic; importer?: Importer } = {},
): string {
  const critic = deps.critic ?? critiqueMesh;
  const importer = deps.importer ?? importGlbToUE;
  const id = `ueimp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job: UeImportJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);

  const gate = gateRequestFor({
    assetClass: spec.assetClass,
    stage: importStageFor(spec.glbPath),
    targetExtentM: spec.targetExtentM,
  });
  job.gradedAs = gate.gradedAs;

  void (async () => {
    let critique: CritiqueResult | undefined;
    try {
      critique = await critic(spec.glbPath, gate.deps);
    } catch {
      critique = undefined; // an absent critic costs evidence, never the import
    }
    job.critique = critique;

    const plan = planUeImport({
      critique,
      use: spec.use,
      declaredShells: spec.components,
      assetClass: spec.assetClass,
      targetExtentM: spec.targetExtentM,
    });
    job.plan = plan.collision;
    job.planBasis = plan.collisionBasis;
    job.shells = plan.shells;
    job.scale = plan.scale;
    job.orientation = plan.orientation;
    const scale = importScaleOf(plan.scale);

    try {
      const result = await importer(spec.glbPath, {
        destPath: spec.destPath,
        assetName: spec.assetName,
        settleMs: spec.settleMs,
        collision: plan.collision,
        ...(scale ? { scale } : {}),
      });
      job.result = result;
      // `importGlbToUE` already refuses to claim collision — or a size — it did not observe.
      // Carry that refusal through as a job error instead of letting `status: 'done'` imply
      // an asset that is in the project, blocking, and the size it was meant to be.
      job.status = result.ok ? 'done' : 'error';
      if (!result.ok) job.error = result.error ?? 'import failed';
    } catch (e) {
      job.status = 'error';
      job.error = e instanceof Error ? e.message : 'import failed';
    }
  })();

  return id;
}

export function getUeImportJob(id: string): UeImportJob | undefined {
  return jobs.get(id);
}
