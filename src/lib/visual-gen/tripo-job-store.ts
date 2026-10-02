/**
 * In-memory job store for Tripo3D CLOUD generation runs — the cloud counterpart to
 * the local triposr/hunyuan job stores. The API is job-based because a Tripo task
 * queues + renders remotely (tens of seconds): POST /generate starts a job + returns
 * an id; GET /generate/status polls it. Module-global (survives Next dev HMR).
 * Ephemeral — the durable artifact is the downloaded .glb. Auto-runs the Tier-1
 * geometry gate on the produced mesh, same as the local stores.
 */
import {
  runTripo, awaitTripoTask, isRecoverableTripoFailure,
  type TripoSpec, type TripoResult, type TripoDeps, type TripoPollOptions,
} from './tripo-runner';
import { critiqueMesh, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { gateRequestFor, type GateRequest } from './gate-request';
import { generateUntilAcceptable, type RetryOutcome } from './best-of-n';
import type { BudgetRequest } from './face-budget';

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

/** The spec fields the Tier-1 gate request is derived from. */
export type TripoGateSpec = Pick<TripoSpec, 'assetClass' | 'targetExtentM' | 'faceLimit' | 'quad'>;

/**
 * What a RECOVERY job is started with: where to write the mesh, how to grade it (the same
 * gate facts a fresh job of the class carries, so a recovered mesh is never graded more
 * leniently) and how long to watch. No generation inputs - recovery never generates.
 */
export type TripoRecoverySpec = TripoGateSpec & TripoPollOptions & { outputPath: string };

export interface TripoJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TripoSpec | TripoRecoverySpec;
  /**
   * The Tripo task id currently paid for - recorded the moment Tripo accepts the task (and,
   * on a recovery job, the task being recovered), so the handle survives a timeout, a lost
   * poll and a PoF server restart: it is provider-side, not in-process.
   */
  providerTaskId?: string;
  /**
   * True when the job ended in error while `providerTaskId` may still deliver (PoF stopped
   * watching; Tripo gave no terminal verdict). Recover it by id - never pay again.
   */
  recoverable?: boolean;
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
  /**
   * True when NOTHING graded the delivered mesh (the Tier-1 critic could not run at
   * all). `accepted: false` alone cannot express that: it reads as "a gate looked at
   * this mesh and rejected it", which is a different — and much harsher — claim.
   */
  ungated?: boolean;
  /** Why the regeneration loop stopped — honest when nothing cleared the gate. */
  gateReason?: string;
  /** What the mesh was graded against (class budget, or class-blind and why). */
  gradedAs?: string;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofTripoJobs?: Map<string, TripoJob> };
const jobs = g.pofTripoJobs ?? new Map<string, TripoJob>();
if (!g.pofTripoJobs) g.pofTripoJobs = jobs;

type Runner = (spec: TripoSpec, hooks?: Pick<TripoDeps, 'onTaskCreated'>) => Promise<TripoResult>;
type Recoverer = (taskId: string, spec: TripoRecoverySpec) => Promise<TripoResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/**
 * Thrown out of a roll whose paid task is still live: it ends the re-roll loop, because
 * the next roll would buy a SECOND task while the first may still deliver.
 */
class LiveTaskStop extends Error {
  constructor(readonly result: TripoResult) {
    super(result.error ?? 'Tripo task still live');
  }
}

const recoverTask: Recoverer = (taskId, spec) => awaitTripoTask(taskId, spec.outputPath, spec);

/**
 * The Tier-1 gate request for a job: the class rule from `gateRequestFor` plus the one
 * fact only this producer owns — the face budget the generation was actually requested
 * at (Tripo counts quads when `quad` is set, so the unit rides along). Pure.
 *
 * What this store grades is provider output straight off the API — pre-retopo, pre-unwrap,
 * pre-bake — so the stage is `raw`.
 */
export function tripoGateRequest(spec: TripoSpec | TripoRecoverySpec): GateRequest {
  const sentBudget: BudgetRequest | undefined =
    spec.faceLimit !== undefined
      ? { triangleBudget: spec.faceLimit, topology: spec.quad ? 'quads' : 'triangles' }
      : undefined;
  return gateRequestFor({ assetClass: spec.assetClass, stage: 'raw', targetExtentM: spec.targetExtentM, sentBudget });
}

/** The gate deps alone — kept as the stable seam other producers and tests pin. Pure. */
export function critiqueDepsForSpec(spec: TripoSpec | TripoRecoverySpec): CritiqueDeps {
  return tripoGateRequest(spec).deps;
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
 *
 * An attempt that ends with its paid task still LIVE (poll window spent, unreadable polls)
 * stops the loop: the job errors `recoverable` with that `providerTaskId`, and no further
 * task is bought while the first may still finish.
 */
export function startTripoJob(spec: TripoSpec, runner: Runner = runTripo, critic: Critic = critiqueMesh): string {
  const id = `tripo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: TripoJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);

  const maxAttempts = Math.min(Math.max(1, spec.maxAttempts ?? 1), MAX_GENERATION_ATTEMPTS);
  let spent = 0;
  settleJob(job, spec, critic, maxAttempts, () => spent, (attempt) => {
    spent++;
    return runner(
      { ...spec, outputPath: attemptPath(spec.outputPath, attempt) },
      { onTaskCreated: (taskId) => { job.providerTaskId = taskId; } },
    );
  });
  return id;
}

/**
 * Recover an EXISTING Tripo task by id (fire-and-forget): poll it, download its model and
 * run the SAME Tier-1 gate a fresh job of the class gets. Single-shot and never
 * regenerating — it creates no task, so it spends no generation (`attempts: 0`). A task
 * that is still not finished leaves the job `recoverable` again.
 */
export function startTripoRecoveryJob(
  taskId: string,
  spec: TripoRecoverySpec,
  recoverer: Recoverer = recoverTask,
  critic: Critic = critiqueMesh,
): string {
  const id = `tripo-recover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: TripoJob = { id, status: 'running', spec, providerTaskId: taskId, startedAt: Date.now() };
  jobs.set(id, job);
  settleJob(job, spec, critic, 1, () => 0, () => recoverer(taskId, spec));
  return id;
}

/** Run the gate loop over `roll` and write its outcome onto `job`. */
function settleJob(
  job: TripoJob,
  spec: TripoSpec | TripoRecoverySpec,
  critic: Critic,
  maxAttempts: number,
  spent: () => number,
  roll: (attempt: number) => Promise<TripoResult>,
): void {
  const gate = tripoGateRequest(spec);
  const critiqueDeps = gate.deps;
  job.gradedAs = gate.gradedAs;

  generateUntilAcceptable<TripoResult>(
    async (attempt) => {
      const result = await roll(attempt);
      if (isRecoverableTripoFailure(result)) throw new LiveTaskStop(result);
      return result;
    },
    { critic: (meshPath) => critic(meshPath, critiqueDeps), maxAttempts },
  )
    .then((outcome) => writeOutcome(job, outcome, spent()))
    .catch((e: unknown) => {
      if (e instanceof LiveTaskStop) {
        job.result = e.result;
        job.providerTaskId = e.result.taskId;
        job.recoverable = true;
        job.attempts = spent();
        job.accepted = false;
        job.gateReason = `stopped — Tripo task ${e.result.taskId} was still live when polling ended, so no new paid task was started; recover it by task id`;
      }
      job.error = e instanceof Error ? e.message : String(e);
      job.status = 'error';
    });
}

function writeOutcome(job: TripoJob, outcome: RetryOutcome<TripoResult>, spent: number): void {
  // Fall back to the last attempt so a failed generation still reports its own
  // error — `best` only ever holds attempts that produced a mesh.
  const delivered = outcome.best ?? outcome.attempts[outcome.attempts.length - 1];
  job.result = delivered?.result;
  job.critique = delivered?.critique;
  if (delivered?.result.taskId) job.providerTaskId = delivered.result.taskId;
  job.attempts = spent;
  job.accepted = outcome.accepted;
  job.ungated = outcome.ungated === true;
  // The calibration caveat rides on the reason itself, so the one field the status
  // route already projects carries it to wherever the verdict is shown.
  job.gateReason = outcome.note ? `${outcome.reason} — note: ${outcome.note}` : outcome.reason;
  const produced = delivered?.result.ok === true;
  job.status = produced ? 'done' : 'error';
  if (!produced) job.error = delivered?.result.error;
}

export function getTripoJob(id: string): TripoJob | undefined {
  return jobs.get(id);
}
