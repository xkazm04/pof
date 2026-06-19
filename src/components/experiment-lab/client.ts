/** Client-side: start an experiment job and poll it to completion. Pure of React
 * so the POST→poll loop is unit-tested with a mock fetch. */
import type { ExperimentResult, ExperimentSpec } from '@/lib/ue-experiment/runner';
import type { ApiResponse } from '@/types/api';

interface RunOpts {
  fetchImpl?: typeof fetch;
  pollMs?: number;
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
  const maxPolls = opts.maxPolls ?? 600;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(opts.pollMs ?? 2000);
    const s = await unwrap<{ status: 'running' | 'done' | 'error'; result?: ExperimentResult; error?: string }>(
      await f(`/api/experiment/status/${jobId}`),
    );
    if (s.status === 'done' && s.result) return { jobId, result: s.result };
    if (s.status === 'error') throw new Error(s.error ?? 'experiment failed');
  }
  throw new Error('experiment timed out');
}
