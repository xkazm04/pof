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
import { generateUntilAcceptable } from './best-of-n';
import type { BudgetRequest } from './face-budget';
import { nominalExtentFor, type SizeRequest } from './world-scale';

/**
 * Hard ceiling on the generations one job may spend, whatever a caller asks for. Every
 * attempt is a paid provider task, so this cap — not the caller — is the cost guard.
 */
export const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Output path for one attempt. The first keeps the requested path (so a single-shot job
 * is byte-identical to before); retries get a suffix, so a rejected mesh can never be
 * mistaken for the delivered one and the evidence of both survives on disk. Pure.
 */
export function attemptPath(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const ext = /(\.[^./\\]+)$/;
  return ext.test(base) ? base.replace(ext, `_a${attempt}$1`) : `${base}_a${attempt}`;
}

export interface TripoJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TripoSpec;
  result?: TripoResult;
  /** Tier-1 quality-gate scorecard, run automatically on the produced mesh. */
  critique?: CritiqueResult;
  /** Generations actually spent — each one is a paid provider task. */
  attempts?: number;
  /**
   * Whether the DELIVERED mesh cleared the Tier-1 gate. A job can finish `done` with
   * `accepted: false`: the mesh exists and is handed over, it just never passed. Kept
   * separate from `status` so a failing mesh cannot read as a clean result.
   */
  accepted?: boolean;
  /** Why the regeneration loop stopped — honest when nothing cleared the gate. */
  gateReason?: string;
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
  const targetExtentM = spec.targetExtentM ?? nominalExtentFor(spec.assetClass);
  const size: SizeRequest | undefined = targetExtentM !== undefined ? { targetExtentM } : undefined;
  return { thresholds, budget, size };
}

/**
 * Start a Tripo cloud job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate, graded against the job's own
 * asset class and requested face budget. `runner`/`critic` are injectable for tests;
 * default to the real `runTripo` / `critiqueMesh`.
 *
 * A gate-failing mesh is REGENERATED rather than kept, up to `spec.maxAttempts` (capped
 * at `MAX_GENERATION_ATTEMPTS`, default 1 so cost is unchanged unless a caller opts in).
 * The loop stops on the first mesh that clears the gate, so a healthy generation still
 * pays for exactly one task. When every attempt fails the mesh is still delivered — with
 * `accepted: false` and the reason — because hiding it would be worse than reporting it.
 */
export function startTripoJob(spec: TripoSpec, runner: Runner = runTripo, critic: Critic = critiqueMesh): string {
  const id = `tripo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: TripoJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);

  const maxAttempts = Math.min(Math.max(1, spec.maxAttempts ?? 1), MAX_GENERATION_ATTEMPTS);
  const critiqueDeps = critiqueDepsForSpec(spec);

  generateUntilAcceptable<TripoResult>(
    (attempt) => runner({ ...spec, outputPath: attemptPath(spec.outputPath, attempt) }),
    { critic: (meshPath) => critic(meshPath, critiqueDeps), maxAttempts },
  )
    .then((outcome) => {
      // Fall back to the last attempt so a failed generation still reports its own
      // error — `best` only ever holds attempts that produced a mesh.
      const delivered = outcome.best ?? outcome.attempts[outcome.attempts.length - 1];
      job.result = delivered?.result;
      job.critique = delivered?.critique;
      job.attempts = outcome.attempts.length;
      job.accepted = outcome.accepted;
      job.gateReason = outcome.reason;
      const produced = delivered?.result.ok === true;
      job.status = produced ? 'done' : 'error';
      if (!produced) job.error = delivered?.result.error;
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
