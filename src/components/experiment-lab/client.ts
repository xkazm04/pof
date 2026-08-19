/** Client-side: start an experiment job and poll it to completion. Pure of React
 * so the POST→poll loop is unit-tested with a mock fetch. */
import type { ExperimentResult, ExperimentSpec } from '@/lib/ue-experiment/runner';
import type { ExperimentRunSummary, ExperimentRunDetail } from '@/lib/ue-experiment/experiment-db';
import { experimentPollBudget, experimentTimeoutMessage } from '@/lib/ue-experiment/poll-budget';
import type { ApiResponse } from '@/types/api';

interface RunOpts {
  fetchImpl?: typeof fetch;
  /** Override the poll interval (default `UI_TIMEOUTS.experimentPoll`). */
  pollMs?: number;
  /** Override the poll bound (default: derived from the server's own settle ceiling). */
  maxPolls?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export async function runExperimentJob(spec: ExperimentSpec, opts: RunOpts = {}): Promise<{ jobId: string; result: ExperimentResult }> {
  const f = opts.fetchImpl ?? fetch;
  const { jobId } = await unwrap<{ jobId: string }>(
    await f('/api/experiment/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spec) }),
  );
  // Poll THEN sleep. The old order slept a full interval first, so a run the server had
  // already refused at spawn (no POF_UE_UPROJECT, editor binary missing) still showed
  // "Launching UE 5.8…" for 30 s before reporting a failure that was known immediately.
  const budget = experimentPollBudget(spec, { pollMs: opts.pollMs, maxPolls: opts.maxPolls });
  for (let i = 0; i < budget.maxPolls; i++) {
    const s = await unwrap<{ status: 'running' | 'done' | 'error'; result?: ExperimentResult; error?: string }>(
      await f(`/api/experiment/status/${jobId}`),
    );
    if (s.status === 'done' && s.result) return { jobId, result: s.result };
    if (s.status === 'error') throw new Error(s.error ?? 'experiment failed');
    if (i < budget.maxPolls - 1) await sleep(budget.pollMs);
  }
  // Never a bare "timed out": say which ceiling was hit and what it was derived from.
  throw new Error(experimentTimeoutMessage(jobId, budget));
}

/** List persisted runs (newest first) for the history panel. */
export async function fetchHistory(opts: { fetchImpl?: typeof fetch; limit?: number } = {}): Promise<ExperimentRunSummary[]> {
  const f = opts.fetchImpl ?? fetch;
  const { runs } = await unwrap<{ runs: ExperimentRunSummary[] }>(await f(`/api/experiment/history?limit=${opts.limit ?? 50}`));
  return runs;
}

/** Fetch one persisted run's full detail (for A-B compare). */
export async function fetchRun(id: string, fetchImpl: typeof fetch = fetch): Promise<ExperimentRunDetail> {
  return unwrap<ExperimentRunDetail>(await fetchImpl(`/api/experiment/runs/${id}`));
}

/** Delete one persisted run and its capture (experiment retention is explicit, not automatic). */
export async function deleteRun(id: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await unwrap<{ id: string; deleted: boolean }>(await fetchImpl(`/api/experiment/runs/${id}`, { method: 'DELETE' }));
}
