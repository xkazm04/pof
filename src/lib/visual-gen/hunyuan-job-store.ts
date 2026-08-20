/**
 * In-memory job store for Hunyuan3D generation runs — the OFFICIAL image-to-3D path.
 * Inference is slower than TripoSR (model load + ~31s flow-matching), so the API is
 * job-based: POST /generate starts a job + returns an id; GET /generate/status polls it.
 * Module-global (survives Next dev HMR). Ephemeral — the durable artifact is the .glb.
 * Mirrors the TripoSR job store; auto-runs the Tier-1 geometry gate on the produced mesh.
 */
import { runHunyuan, type HunyuanSpec, type HunyuanResult } from './hunyuan-runner';
import { critiqueMesh, summarizeGate, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { localCritiqueDeps } from './polycount-presets';

/**
 * A Hunyuan job's spec: the runner's spec plus the grading intent for the mesh.
 *
 * Hunyuan3D emits ~360K faces and accepts no budget input, so the class cannot steer
 * generation — it decides what the delivery is HELD TO. Against the class-blind 200k
 * default that mesh merely warned; against a 15k prop or 60k character ceiling the
 * overshoot is the headline, which is the whole point of the presets.
 */
export interface HunyuanJobSpec extends HunyuanSpec {
  /** Asset class the mesh is graded against; unclassified when absent (stated, not silent). */
  assetClass?: string;
  /** Intended real-world longest extent (m); defaults to the class nominal when known. */
  targetExtentM?: number;
}

export interface HunyuanJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: HunyuanJobSpec;
  result?: HunyuanResult;
  /** Tier-1 quality-gate scorecard, run automatically on the produced mesh. */
  critique?: CritiqueResult;
  /** Whether the DELIVERED mesh cleared the Tier-1 gate. Never inferred from `status`. */
  accepted?: boolean;
  /** True when NOTHING graded the mesh (critic unavailable) — delivered, not passed. */
  ungated?: boolean;
  /** Why the gate ended where it did — names the missing critic when there was none. */
  gateReason?: string;
  /** What the mesh was graded against (class budget, or class-blind and why). */
  gradedAs?: string;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofHunyuanJobs?: Map<string, HunyuanJob> };
const jobs = g.pofHunyuanJobs ?? new Map<string, HunyuanJob>();
if (!g.pofHunyuanJobs) g.pofHunyuanJobs = jobs;

type Runner = (spec: HunyuanSpec) => Promise<HunyuanResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/** Start a Hunyuan3D job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate, graded against the job's own
 * asset class (class-blind, and said so, when none was supplied). `runner`/`critic` are
 * injectable for tests; default to the real `runHunyuan` / `critiqueMesh`. */
export function startHunyuanJob(spec: HunyuanJobSpec, runner: Runner = runHunyuan, critic: Critic = critiqueMesh): string {
  const id = `hy3d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const gate = localCritiqueDeps(spec.assetClass, spec.targetExtentM);
  const job: HunyuanJob = { id, status: 'running', spec, gradedAs: gate.gradedAs, startedAt: Date.now() };
  jobs.set(id, job);
  runner(spec)
    .then(async (result) => {
      job.result = result;
      if (result.ok && result.meshPath) {
        try { job.critique = await critic(result.meshPath, gate.deps); } catch { /* critique is best-effort */ }
      }
      // A produced mesh always reports HOW it was gated — including "nothing gated it".
      if (result.ok) {
        const summary = summarizeGate(job.critique, 'raw');
        job.accepted = summary.accepted;
        job.ungated = summary.ungated;
        job.gateReason = summary.note ? `${summary.reason} — note: ${summary.note}` : summary.reason;
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
