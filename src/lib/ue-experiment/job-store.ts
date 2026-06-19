/**
 * In-memory job store for experiment runs. A run launches a UE editor (minutes),
 * so the API is job-based: POST /run starts a job + returns an id; GET /status/:id
 * polls it. Module-global (survives Next dev HMR) — mirrors cli-service's
 * `activeExecutions`. Jobs are ephemeral; no persistence needed.
 */
import { runExperiment, type ExperimentSpec, type ExperimentResult, type RunnerDeps } from './runner';
import { saveExperimentRun } from './experiment-db';

export interface ExperimentJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: ExperimentSpec;
  result?: ExperimentResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofExperimentJobs?: Map<string, ExperimentJob> };
const jobs = g.pofExperimentJobs ?? new Map<string, ExperimentJob>();
if (!g.pofExperimentJobs) g.pofExperimentJobs = jobs;

type Runner = (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;
type Persist = (job: ExperimentJob) => void;

/** Persist a finished run to the durable history (best-effort). */
function defaultPersist(job: ExperimentJob): void {
  if (!job.result) return;
  try {
    saveExperimentRun({ id: job.id, createdAt: new Date(job.startedAt).toISOString(), spec: job.spec, result: job.result });
  } catch { /* history is best-effort; never fail a run over it */ }
}

/** Start an experiment job (fire-and-forget). Returns the job id immediately.
 * `runner`/`persist` are injectable for tests; default to the real ones. */
export function startExperimentJob(spec: ExperimentSpec, deps?: RunnerDeps, runner: Runner = runExperiment, persist: Persist = defaultPersist): string {
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: ExperimentJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);
  runner(spec, deps)
    .then((result) => { job.result = result; job.status = 'done'; persist(job); })
    .catch((e: unknown) => { job.error = e instanceof Error ? e.message : String(e); job.status = 'error'; });
  return id;
}

export function getExperimentJob(id: string): ExperimentJob | undefined {
  return jobs.get(id);
}
