/**
 * In-memory job store for mesh-finish (retopo → UV → high→low bake) runs.
 *
 * `runMeshFinish` was built and live-proven on 2026-07-28 (1.49M → 40k faces with real
 * baked normal/AO) and then sat with **zero call sites** — no API route, no StepSpec —
 * for three research runs, blocking every consumer that wanted to route a mesh through
 * it. This is that missing seam.
 *
 * Job-based for the same reason the generator stores are: a headless Blender decimate +
 * unwrap + Cycles bake on a dense mesh runs for minutes, well past an HTTP timeout.
 * POST starts a job and returns an id; GET polls it. Module-global (survives Next dev
 * HMR), ephemeral — the durable artifacts are the written .glb and its bake maps.
 *
 * The finished low-poly is auto-graded by the Tier-1 gate, exactly as the generator
 * stores do. That composition is what makes `targetFaces` meaningful: it is the budget
 * the caller ASKED for, so the critique can hold the delivered mesh to it instead of
 * only to the class ceiling (see `face-budget.ts`).
 */
import { runMeshFinish, type MeshFinishSpec, type MeshFinishResult } from './mesh-finish';
import { critiqueMesh, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { critiqueThresholdsFor } from './polycount-presets';
import type { BudgetRequest } from './face-budget';

export interface MeshFinishJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: MeshFinishSpec;
  /** Asset class the finished mesh is graded as (character/prop/…), when declared. */
  assetClass?: string;
  result?: MeshFinishResult;
  /** Tier-1 geometry gate, auto-run on the finished low-poly. */
  critique?: CritiqueResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofMeshFinishJobs?: Map<string, MeshFinishJob> };
const jobs = g.pofMeshFinishJobs ?? new Map<string, MeshFinishJob>();
if (!g.pofMeshFinishJobs) g.pofMeshFinishJobs = jobs;

type Runner = (spec: MeshFinishSpec) => Promise<MeshFinishResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/**
 * Tier-1 gate deps for a finish run. Pure.
 *
 * `targetFaces` is the decimation budget the caller requested, so it doubles as the
 * budget the delivered mesh is held to. A run with no target skipped retopo entirely —
 * there is then no budget to honour, and none is invented.
 */
export function critiqueDepsForFinish(spec: MeshFinishSpec, assetClass?: string): CritiqueDeps {
  const thresholds = assetClass ? critiqueThresholdsFor(assetClass) : {};
  const budget: BudgetRequest | undefined =
    spec.targetFaces !== undefined
      ? { triangleBudget: spec.targetFaces, topology: 'triangles' }
      : undefined;
  return { thresholds, budget };
}

/**
 * Start a mesh-finish job (fire-and-forget). Returns the job id immediately.
 * `runner`/`critic` are injectable for tests; default to the real implementations.
 */
export function startMeshFinishJob(
  spec: MeshFinishSpec,
  assetClass?: string,
  runner: Runner = runMeshFinish,
  critic: Critic = critiqueMesh,
): string {
  const id = `meshfinish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: MeshFinishJob = { id, status: 'running', spec, assetClass, startedAt: Date.now() };
  jobs.set(id, job);
  runner(spec)
    .then(async (result) => {
      job.result = result;
      if (result.ok && result.meshPath) {
        try {
          job.critique = await critic(result.meshPath, critiqueDepsForFinish(spec, assetClass));
        } catch { /* critique is best-effort — never fails the finish itself */ }
      }
      job.status = result.ok ? 'done' : 'error';
      if (!result.ok) job.error = result.error;
    })
    .catch((e: unknown) => {
      job.error = e instanceof Error ? e.message : String(e);
      job.status = 'error';
    });
  return id;
}

export function getMeshFinishJob(id: string): MeshFinishJob | undefined {
  return jobs.get(id);
}
