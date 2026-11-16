/**
 * In-memory job store for TRELLIS.2 generation runs — the textured local path (its code
 * and weights are MIT, its licence chain is not: see `trellis-runner.ts`). Inference is the slowest of the local providers (4B params + a PBR bake, and the
 * first run downloads ~16GB), so the API is job-based like the others: POST /generate
 * starts a job + returns an id; GET /generate/status polls it. Module-global (survives
 * Next dev HMR). Ephemeral — the durable artifact is the .glb.
 *
 * Mirrors the Hunyuan job store, with ONE deliberate divergence — see `trellisGateDeps`.
 */
import { runTrellis, type TrellisSpec, type TrellisResult } from './trellis-runner';
import { critiqueMesh, type CritiqueDeps, type CritiqueResult } from './mesh-critique';
import { settleLocalJob } from './local-job-settle';
import { polycountFor, resolveAssetClass } from './polycount-presets';
import { gateRequestFor, type GateRequest } from './gate-request';

/**
 * A TRELLIS.2 job's spec: the runner's spec plus the grading intent for the mesh.
 *
 * Unlike Hunyuan3D (~360K faces, no budget input) the class here can STEER generation:
 * the class face limit becomes the generator's own `decimation_target`. So the class
 * decides both what is asked for and what the delivery is held to.
 */
export interface TrellisJobSpec extends TrellisSpec {
  /** Asset class the mesh is graded against; unclassified when absent (stated, not silent). */
  assetClass?: string;
  /** Intended real-world longest extent (m); defaults to the class nominal when known. */
  targetExtentM?: number;
}

export interface TrellisJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: TrellisJobSpec;
  result?: TrellisResult;
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
  /** The face budget actually SENT to the generator, when one was. */
  requestedFaceLimit?: number;
  error?: string;
  startedAt: number;
}

/**
 * Gate deps for a TRELLIS.2 delivery.
 *
 * `localCritiqueDeps` deliberately supplies NO `budget` for local providers, on the
 * documented grounds that TripoSR/Hunyuan accept no budget input — so grading against
 * one "would report 'the provider ignored your budget' about a budget nobody ever sent".
 * That reasoning is sound and unchanged; it simply does not describe THIS provider.
 * TRELLIS.2 takes `decimation_target`, so when we send one the budget grade is a real
 * comparison, and withholding it would lose the only signal that says whether the
 * generator honoured the request. The budget is therefore attached IF AND ONLY IF a
 * limit was actually handed to the runner.
 */
export function trellisGateDeps(
  assetClass: string | undefined,
  targetExtentM: number | undefined,
  sentFaceLimit: number | undefined,
): GateRequest {
  return gateRequestFor({
    assetClass,
    stage: 'raw',
    targetExtentM,
    sentBudget: sentFaceLimit !== undefined ? { triangleBudget: sentFaceLimit, topology: 'triangles' } : undefined,
  });
}

/** The face limit to hand the generator for a class, unless the caller pinned one. Pure. */
export function trellisFaceLimit(spec: TrellisJobSpec): number | undefined {
  if (spec.decimationTarget !== undefined) return spec.decimationTarget;
  const resolved = resolveAssetClass(spec.assetClass);
  return resolved.assetClass ? polycountFor(resolved.assetClass)?.faceLimit : undefined;
}

const g = globalThis as unknown as { pofTrellisJobs?: Map<string, TrellisJob> };
const jobs = g.pofTrellisJobs ?? new Map<string, TrellisJob>();
if (!g.pofTrellisJobs) g.pofTrellisJobs = jobs;

/** Finished jobs kept for status polls; the oldest settled job is dropped past this. */
const MAX_RETAINED_JOBS = 200;

/** Drop the oldest SETTLED jobs until the store is back inside the cap. Running jobs are never evicted. */
function evictSettledJobs(): void {
  for (const [id, j] of jobs) {
    if (jobs.size <= MAX_RETAINED_JOBS) break;
    if (j.status !== 'running') jobs.delete(id);
  }
}

type Runner = (spec: TrellisSpec) => Promise<TrellisResult>;
type Critic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/** Start a TRELLIS.2 job (fire-and-forget). Returns the job id immediately. The class
 * face limit is sent to the generator as its native decimation target, and the delivery
 * is then graded against that same limit. `runner`/`critic` are injectable for tests;
 * default to the real `runTrellis` / `critiqueMesh`. */
export function startTrellisJob(
  spec: TrellisJobSpec,
  runner: Runner = runTrellis,
  critic: Critic = critiqueMesh,
  /** Runs once the job has settled (done or error) — the caller's hook to drop its temp input. */
  onSettled?: () => void,
): string {
  const id = `t2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const faceLimit = trellisFaceLimit(spec);
  const gate = trellisGateDeps(spec.assetClass, spec.targetExtentM, faceLimit);
  const job: TrellisJob = {
    id, status: 'running', spec, gradedAs: gate.gradedAs, requestedFaceLimit: faceLimit, startedAt: Date.now(),
  };
  jobs.set(id, job);
  evictSettledJobs();
  settleLocalJob(job, () => runner({ ...spec, decimationTarget: faceLimit }), critic, gate.deps, onSettled);
  return id;
}

export function getTrellisJob(id: string): TrellisJob | undefined {
  return jobs.get(id);
}
