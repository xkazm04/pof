/**
 * In-memory job store for TripoSR generation runs. Inference takes ~15s (model load
 * + NeRF + mesh extraction), so the API is job-based: POST /generate starts a job +
 * returns an id; GET /generate/status polls it. Module-global (survives Next dev HMR),
 * mirrors the Experiment Lab's job store. Ephemeral — the durable artifact is the .glb.
 */
import { runTriposr, type TriposrSpec, type TriposrResult } from './triposr-runner';
import { critiqueMesh, type CritiqueResult } from './mesh-critique';

export interface TriposrJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TriposrSpec;
  result?: TriposrResult;
  /** Tier-1 quality-gate scorecard, run automatically on the produced mesh. */
  critique?: CritiqueResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofTriposrJobs?: Map<string, TriposrJob> };
const jobs = g.pofTriposrJobs ?? new Map<string, TriposrJob>();
if (!g.pofTriposrJobs) g.pofTriposrJobs = jobs;

type Runner = (spec: TriposrSpec) => Promise<TriposrResult>;
type Critic = (glbPath: string) => Promise<CritiqueResult>;

/** Start a TripoSR job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate. `runner`/`critic` are
 * injectable for tests; default to the real `runTriposr` / `critiqueMesh`. */
export function startTriposrJob(spec: TriposrSpec, runner: Runner = runTriposr, critic: Critic = critiqueMesh): string {
  const id = `tsr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: TriposrJob = { id, status: 'running', spec, startedAt: Date.now() };
  jobs.set(id, job);
  runner(spec)
    .then(async (result) => {
      job.result = result;
      if (result.ok && result.meshPath) {
        try { job.critique = await critic(result.meshPath); } catch { /* critique is best-effort */ }
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

export function getTriposrJob(id: string): TriposrJob | undefined {
  return jobs.get(id);
}
