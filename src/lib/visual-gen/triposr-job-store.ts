/**
 * In-memory job store for TripoSR generation runs. Inference takes ~15s (model load
 * + NeRF + mesh extraction), so the API is job-based: POST /generate starts a job +
 * returns an id; GET /generate/status polls it. Module-global (survives Next dev HMR),
 * mirrors the Experiment Lab's job store. Ephemeral — the durable artifact is the .glb.
 */
import { runTriposr, type TriposrSpec, type TriposrResult } from './triposr-runner';
import { critiqueMesh, summarizeGate, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { localCritiqueDeps } from './polycount-presets';

/**
 * A TripoSR job's spec: the runner's spec plus the grading intent for the mesh.
 *
 * TripoSR cannot be ASKED for a face budget (no `face_limit` input), so the class does
 * not change generation here — it changes what the delivered mesh is HELD TO. Carried
 * on the job spec rather than pushed into `TriposrSpec` so the runner's contract (what
 * the python script accepts) stays exactly what the script accepts.
 */
export interface TriposrJobSpec extends TriposrSpec {
  /** Asset class the mesh is graded against; unclassified when absent (stated, not silent). */
  assetClass?: string;
  /** Intended real-world longest extent (m); defaults to the class nominal when known. */
  targetExtentM?: number;
}

export interface TriposrJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TriposrJobSpec;
  result?: TriposrResult;
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

const g = globalThis as unknown as { pofTriposrJobs?: Map<string, TriposrJob> };
const jobs = g.pofTriposrJobs ?? new Map<string, TriposrJob>();
if (!g.pofTriposrJobs) g.pofTriposrJobs = jobs;

type Runner = (spec: TriposrSpec) => Promise<TriposrResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/** Start a TripoSR job (fire-and-forget). Returns the job id immediately. On a
 * successful mesh it auto-runs the Tier-1 quality gate, graded against the job's own
 * asset class (class-blind, and said so, when none was supplied). `runner`/`critic` are
 * injectable for tests; default to the real `runTriposr` / `critiqueMesh`. */
export function startTriposrJob(spec: TriposrJobSpec, runner: Runner = runTriposr, critic: Critic = critiqueMesh): string {
  const id = `tsr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const gate = localCritiqueDeps(spec.assetClass, spec.targetExtentM);
  const job: TriposrJob = { id, status: 'running', spec, gradedAs: gate.gradedAs, startedAt: Date.now() };
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

export function getTriposrJob(id: string): TriposrJob | undefined {
  return jobs.get(id);
}
