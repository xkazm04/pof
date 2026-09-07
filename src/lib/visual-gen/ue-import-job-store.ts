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
import { critiqueMesh, classifyComponents, type CritiqueResult } from './mesh-critique';
import {
  collisionPlan,
  importGlbToUE,
  type CollisionPlan,
  type CollisionUse,
  type UeImportResult,
} from './ue-import';

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
}

/**
 * Where a collision plan's shell count came from. The same convention as
 * `scoreBreakdown`'s `basis`: a plan that states its kind but not its evidence lets an
 * assumed shape read exactly like a measured one.
 */
export type CollisionPlanBasis = 'measured' | 'declared' | 'assumed' | 'not-needed';

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
  result?: UeImportResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofUeImportJobs?: Map<string, UeImportJob> };
const jobs = g.pofUeImportJobs ?? new Map<string, UeImportJob>();
if (!g.pofUeImportJobs) g.pofUeImportJobs = jobs;

export interface PlanDerivation {
  plan: CollisionPlan;
  basis: CollisionPlanBasis;
  shells?: number;
}

/**
 * Derive a collision plan from what was actually measured about the mesh. Pure.
 *
 * Shell counting uses `classifyComponents`, not the raw `components` number: an assembled
 * character is legitimately multi-shell, and a shattered one carries dozens of two-face
 * specks. Planning hull budgets off the raw count would reason about concavity that is
 * really shrapnel. When the histogram is absent the raw count is still a MEASUREMENT and is
 * used as one — it is only the critic failing to run that drops the basis to `declared` or
 * `assumed`.
 */
export function collisionPlanFor(
  critique: CritiqueResult | undefined,
  use: CollisionUse,
  declared?: number,
): PlanDerivation {
  // A decorative asset gets no collision, so nothing needs measuring and no doubt is
  // introduced by not having measured.
  if (use === 'decorative') return { plan: collisionPlan({ use }), basis: 'not-needed' };

  const m = critique?.ok === true ? critique.metrics : undefined;
  if (m) {
    const split = classifyComponents(m.componentFaces, m.componentFacesOmitted);
    const shells = split.measured ? split.parts : m.components;
    return { plan: collisionPlan({ use, components: shells }), basis: 'measured', shells };
  }

  if (declared !== undefined) {
    return { plan: collisionPlan({ use, components: declared }), basis: 'declared', shells: declared };
  }

  // Nothing measured it and nobody said. A plan is still made — refusing to import over a
  // missing critic would be worse — but the doubt rides on the plan's own reason line,
  // because `kind: 'simple'` alone cannot say "and I never looked at the mesh".
  const plan = collisionPlan({ use });
  return {
    plan: {
      ...plan,
      reason: `${plan.reason} — ASSUMED: the geometry critic did not run and no shell count was declared, so the mesh was never inspected`,
    },
    basis: 'assumed',
  };
}

type Critic = (glbPath: string) => Promise<CritiqueResult>;
type Importer = (
  glbPath: string,
  opts: { destPath?: string; assetName?: string; settleMs?: number; collision?: CollisionPlan },
) => Promise<UeImportResult>;

/**
 * Start an import. `critic`/`importer` are injectable for tests; they default to the real
 * Tier-1 gate and the real editor-driving import.
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

  void (async () => {
    let critique: CritiqueResult | undefined;
    try {
      critique = await critic(spec.glbPath);
    } catch {
      critique = undefined; // an absent critic costs evidence, never the import
    }
    job.critique = critique;

    const { plan, basis, shells } = collisionPlanFor(critique, spec.use, spec.components);
    job.plan = plan;
    job.planBasis = basis;
    job.shells = shells;

    try {
      const result = await importer(spec.glbPath, {
        destPath: spec.destPath,
        assetName: spec.assetName,
        settleMs: spec.settleMs,
        collision: plan,
      });
      job.result = result;
      // `importGlbToUE` already refuses to claim collision it did not observe. Carry that
      // refusal through as a job error instead of letting `status: 'done'` imply an asset
      // that is in the project AND blocking.
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
