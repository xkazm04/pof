/**
 * In-memory job store for Tripo3D CLOUD generation runs — the cloud counterpart to
 * the local triposr/hunyuan job stores. The API is job-based because a Tripo task
 * queues + renders remotely (tens of seconds): POST /generate starts a job + returns
 * an id; GET /generate/status polls it. Module-global (survives Next dev HMR).
 * Ephemeral — the durable artifact is the downloaded .glb. Auto-runs the Tier-1
 * geometry gate on the produced mesh, same as the local stores.
 */
import { runTripo, type TripoSpec, type TripoResult } from './tripo-runner';
import { critiqueMesh, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { critiqueThresholdsFor } from './polycount-presets';
import type { BudgetRequest } from './face-budget';

export interface TripoJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TripoSpec;
  result?: TripoResult;
  /** Tier-1 quality-gate scorecard, run automatically on the produced mesh. */
  critique?: CritiqueResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofTripoJobs?: Map<string, TripoJob> };
const jobs = g.pofTripoJobs ?? new Map<string, TripoJob>();
if (!g.pofTripoJobs) g.pofTripoJobs = jobs;

type Runner = (spec: TripoSpec) => Promise<TripoResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/**
 * Build the Tier-1 gate deps for a job: the class-aware thresholds AND the face budget
 * the generation was actually requested at. Pure.
 *
 * Both were previously lost. `critiqueThresholdsFor` had no production call site at all
 * — every mesh was graded against the class-blind 200k default — and the requested
 * `faceLimit` was passed to Tripo and then dropped, so nothing could tell a mesh that
 * honoured its budget from one that ignored it.
 */
export function critiqueDepsForSpec(spec: TripoSpec): CritiqueDeps {
  const thresholds = spec.assetClass ? critiqueThresholdsFor(spec.assetClass) : {};
  const budget: BudgetRequest | undefined =
    spec.faceLimit !== undefined
      ? { triangleBudget: spec.faceLimit, topology: spec.quad ? 'quads' : 'triangles' }
      : undefined;
  return { thresholds, budget };
}

/** Start a Tripo cloud job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate, graded against the job's own
 * asset class and requested face budget. `runner`/`critic` are injectable for tests;
 * default to the real `runTripo` / `critiqueMesh`. */
export function startTripoJob(spec: TripoSpec, runner: Runner = runTripo, critic: Critic = critiqueMesh): string {
  const id = `tripo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: TripoJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);
  runner(spec)
    .then(async (result) => {
      job.result = result;
      if (result.ok && result.meshPath) {
        try { job.critique = await critic(result.meshPath, critiqueDepsForSpec(spec)); } catch { /* critique is best-effort */ }
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

export function getTripoJob(id: string): TripoJob | undefined {
  return jobs.get(id);
}
