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

import { startExecution, abortExecution, getExecution } from '@/lib/claude-terminal/cli-service';
import type { CLIExecutionEvent } from '@/lib/claude-terminal/cli-service';
import { resolveDispatchModelChoice } from '@/lib/model-policy';
import { UI_TIMEOUTS } from '@/lib/constants';
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
  inFlight: Set<string>;
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
 * The default executor: spawn one CLI pass, collect its `text` events, and resolve
 * with them when it ends. Registers each execution id in `inFlight` so a cancel can
 * kill the process, not just stop waiting for it.
 */
function cliExecutor(inFlight: Set<string>, pin: { model?: string; effort?: string }): PassExecutor {
  return (prompt, projectPath, signal, cell) => new Promise<string>((resolve, reject) => {
    if (signal.aborted) { reject(cancelledError()); return; }
    let text = '';
    let settled = false;
    let id: string | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      signal.removeEventListener('abort', onAbort);
      if (id) inFlight.delete(id);
      fn();
    };
    const onAbort = () => finish(() => reject(cancelledError()));
    const onEvent = (ev: CLIExecutionEvent) => {
      if (ev.type === 'text' && typeof ev.data.content === 'string') text += ev.data.content;
      else if (ev.type === 'result') {
        finish(() => (ev.data.isError ? reject(new Error('CLI reported an error result')) : resolve(text)));
      } else if (ev.type === 'error') {
        finish(() => reject(new Error(String(ev.data.message ?? 'execution error'))));
      }
    };
    signal.addEventListener('abort', onAbort);
    id = startExecution(projectPath, prompt, undefined, onEvent, {
      model: pin.model,
      effort: pin.effort,
      attribution: { moduleId: cell.moduleId, taskType: 'deep-eval', taskLabel: `Deep Eval: ${cell.pass}` },
    });
    if (settled) return; // the spawn failed synchronously and already reported it
    inFlight.add(id);
    // A clean exit with no result event emits nothing: settle from the status too.
    poll = setInterval(() => {
      const status = id ? getExecution(id)?.status : undefined;
      if (status === 'completed') finish(() => resolve(text));
      else if (status && status !== 'running') finish(() => reject(new Error(`execution ${status}`)));
    }, UI_TIMEOUTS.pollInterval);
  });
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
  const inFlight = new Set<string>();
  const executePass = opts.executePass ?? cliExecutor(
    inFlight,
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

  jobs.set(projectPath, { snap, controller, inFlight, done });
  return ok({ scanId, done });
}

/** The project's current (or last) job, or null. */
export function getDeepEvalJob(projectPath: string): DeepEvalJobSnapshot | null {
  return jobs.get(projectPath)?.snap ?? null;
}

/**
 * Cancel the project's running job: kill every in-flight CLI execution, abort the
 * run, and wait for it to settle so the snapshot carries its honest partial result
 * (unfinished modules are failed, never evaluated).
 */
export async function cancelDeepEvalJob(projectPath: string): Promise<DeepEvalJobSnapshot | null> {
  const job = jobs.get(projectPath);
  if (!job) return null;
  if (job.snap.status === 'running') {
    job.snap.status = 'cancelled';
    for (const id of job.inFlight) abortExecution(id);
    job.inFlight.clear();
    job.controller.abort();
    await job.done;
  }
  return job.snap;
}
