/**
 * Deep eval as a server job: one job per project, held on globalThis, driven by
 * `/api/evaluator/deep-eval` (POST start / GET progress / DELETE cancel).
 *
 * A full scan is ~65 CLI passes of 30-120 s, 4 at a time. It used to live in a
 * browser tab (lost on reload) and never reached the CLI at all (the engine POSTed
 * `cwd` where the query route requires `projectPath`: 400 on every pass). Here the
 * engine runs server-side with a cli-service executor, every pass is persisted to
 * the pass ledger as it ends, and the tab only polls, so a reload reattaches.
 *
 * Each pass spawns with the same model pin and spend attribution the claude-terminal
 * query route gives its spawns: model-policy class `judge-content` (an evaluation is
 * a judgement, like `module-scan`/`feature-review`) and `taskType: 'deep-eval'`.
 * Server-only; client code imports only the snapshot TYPE.
 */

import { startExecution } from '@/lib/claude-terminal/cli-service';
import { settleExecution } from '@/lib/claude-terminal/run-settle';
import { resolveDispatchModelChoice } from '@/lib/model-policy';
import { logger } from '@/lib/logger';
import { ok, err } from '@/types/result';
import type { Result } from '@/types/result';
import type { ProjectContext } from '@/lib/prompt-context';
import { runDeepEval } from './deep-eval-engine';
import type { DeepEvalResult, EvalProgress, EvalStatus, PassExecutor } from './deep-eval-engine';
import { getEvaluableModuleIds } from './module-eval-prompts';
import { readPassLedger, recordPassOutcome } from './deep-eval-pass-ledger';

/** What GET/POST/DELETE return for a project's job. */
export interface DeepEvalJobSnapshot {
  scanId: string;
  projectPath: string;
  status: EvalStatus;
  moduleIds: string[];
  progress: EvalProgress;
  /** Set once the run settles (completed, or the honest partial of a cancel/error). */
  result: DeepEvalResult | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

interface DeepEvalJob {
  snap: DeepEvalJobSnapshot;
  controller: AbortController;
  done: Promise<DeepEvalResult>;
}

export interface StartDeepEvalJobOptions {
  projectPath: string;
  projectContext?: ProjectContext;
  moduleIds?: string[];
  /** Reuse an earlier scan's id: passes its ledger holds as `done` are not re-run. */
  scanId?: string;
  /** Explicit model/effort override (validated; unknown values are ignored). */
  model?: string;
  effort?: string;
  /** Test seam; defaults to the cli-service executor. */
  executePass?: PassExecutor;
}

const g = globalThis as typeof globalThis & { __pofDeepEvalJobs?: Map<string, DeepEvalJob> };
const jobs: Map<string, DeepEvalJob> = (g.__pofDeepEvalJobs ??= new Map());

function cancelledError(): DOMException {
  return new DOMException('Evaluation cancelled', 'AbortError');
}

/**
 * The default executor: spawn one CLI pass and settle it through the one settlement
 * seam (`settleExecution`, run-settle.ts) with the job's signal. A clean end resolves
 * the pass's text; any failure rejects with its typed reason (the engine records it as
 * `cli-error: <reason>: ...`). A cancel kills the pass's process through the same
 * signal, so the job keeps no in-flight id list of its own.
 */
function cliExecutor(pin: { model?: string; effort?: string }): PassExecutor {
  return async (prompt, projectPath, signal, cell) => {
    if (signal.aborted) throw cancelledError();
    const id = startExecution(projectPath, prompt, undefined, undefined, {
      model: pin.model,
      effort: pin.effort,
      attribution: { moduleId: cell.moduleId, taskType: 'deep-eval', taskLabel: `Deep Eval: ${cell.pass}` },
    });
    const settled = await settleExecution(id, { expect: 'end', signal });
    if (settled.ok) return settled.data.text;
    if (settled.error.reason === 'cancelled' && signal.aborted) throw cancelledError();
    throw new Error(`${settled.error.reason}: ${settled.error.message}`);
  };
}

/** Start a deep-eval job for a project; refused while one is already running there. */
export function startDeepEvalJob(
  opts: StartDeepEvalJobOptions,
): Result<{ scanId: string; done: Promise<DeepEvalResult> }, 'already-running'> {
  const { projectPath } = opts;
  if (jobs.get(projectPath)?.snap.status === 'running') return err('already-running');

  const scanId = opts.scanId ?? `deep-${Date.now()}`;
  const moduleIds = opts.moduleIds ?? getEvaluableModuleIds();
  const resumeFrom = opts.scanId ? readPassLedger(scanId) : [];
  const controller = new AbortController();
  const executePass = opts.executePass ?? cliExecutor(
    resolveDispatchModelChoice({ model: opts.model, effort: opts.effort, taskClass: 'judge-content' }),
  );

  const snap: DeepEvalJobSnapshot = {
    scanId, projectPath, status: 'running', moduleIds, result: null, error: null,
    startedAt: Date.now(), finishedAt: null,
    progress: {
      status: 'running', currentModule: null, currentPass: null, completedSteps: 0,
      totalSteps: 0, passStatuses: {}, findings: [], error: null,
    },
  };

  const done = runDeepEval({
    moduleIds,
    projectPath,
    projectContext: opts.projectContext ?? { projectName: '', projectPath, ueVersion: '' },
    executePass,
    scanId,
    signal: controller.signal,
    resumeFrom,
    onPassEnd: (outcome) => {
      try {
        recordPassOutcome(scanId, projectPath, outcome);
      } catch (e) {
        logger.error('deep-eval: failed to persist a pass outcome', e);
      }
    },
    onProgress: (p) => { snap.progress = p; },
  }).then((result) => {
    snap.result = result;
    if (snap.status === 'running') snap.status = snap.progress.status === 'running' ? 'completed' : snap.progress.status;
    snap.error = snap.progress.error;
    snap.finishedAt = Date.now();
    return result;
  });

  jobs.set(projectPath, { snap, controller, done });
  return ok({ scanId, done });
}

/** The project's current (or last) job, or null. */
export function getDeepEvalJob(projectPath: string): DeepEvalJobSnapshot | null {
  return jobs.get(projectPath)?.snap ?? null;
}

/**
 * Cancel the project's running job: abort the run (each in-flight pass's settlement
 * kills its CLI execution on the signal), and wait for it to settle so the snapshot
 * carries its honest partial result (unfinished modules are failed, never evaluated).
 */
export async function cancelDeepEvalJob(projectPath: string): Promise<DeepEvalJobSnapshot | null> {
  const job = jobs.get(projectPath);
  if (!job) return null;
  if (job.snap.status === 'running') {
    job.snap.status = 'cancelled';
    job.controller.abort();
    await job.done;
  }
  return job.snap;
}
