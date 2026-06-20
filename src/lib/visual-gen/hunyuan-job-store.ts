/**
 * In-memory job store for Hunyuan3D generation runs — the OFFICIAL image-to-3D path.
 * Inference is slower than TripoSR (model load + ~31s flow-matching), so the API is
 * job-based: POST /generate starts a job + returns an id; GET /generate/status polls it.
 * Module-global (survives Next dev HMR). Ephemeral — the durable artifact is the .glb.
 * Mirrors the TripoSR job store; auto-runs the Tier-1 geometry gate on the produced mesh.
 */
import { runHunyuan, type HunyuanSpec, type HunyuanResult } from './hunyuan-runner';
import { critiqueMesh, type CritiqueResult } from './mesh-critique';

export interface HunyuanJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: HunyuanSpec;
  result?: HunyuanResult;
  /** Tier-1 quality-gate scorecard, run automatically on the produced mesh. */
  critique?: CritiqueResult;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofHunyuanJobs?: Map<string, HunyuanJob> };
const jobs = g.pofHunyuanJobs ?? new Map<string, HunyuanJob>();
if (!g.pofHunyuanJobs) g.pofHunyuanJobs = jobs;

type Runner = (spec: HunyuanSpec) => Promise<HunyuanResult>;
type Critic = (glbPath: string) => Promise<CritiqueResult>;

/** Start a Hunyuan3D job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate. `runner`/`critic` are
 * injectable for tests; default to the real `runHunyuan` / `critiqueMesh`. */
export function startHunyuanJob(spec: HunyuanSpec, runner: Runner = runHunyuan, critic: Critic = critiqueMesh): string {
  const id = `hy3d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: HunyuanJob = { id, status: 'running', spec, startedAt: Date.now() };
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

export function getHunyuanJob(id: string): HunyuanJob | undefined {
  return jobs.get(id);
}
