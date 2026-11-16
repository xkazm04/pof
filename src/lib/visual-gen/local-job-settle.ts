/**
 * The one settle lifecycle shared by the local (TripoSR / Hunyuan3D / TRELLIS.2) job stores:
 * run the generator, grade a produced mesh with the Tier-1 critic, summarise how it was
 * gated, and write the outcome onto the job. A gate rule change lands here once.
 */
import { summarizeGate, type CritiqueDeps, type CritiqueResult } from './mesh-critique';

/** The fields of a local job this lifecycle owns. */
export interface LocalJobState<R extends LocalRunResult> {
  status: 'running' | 'done' | 'error';
  result?: R;
  critique?: CritiqueResult;
  accepted?: boolean;
  ungated?: boolean;
  gateReason?: string;
  error?: string;
}

/** What every local runner reports. */
export interface LocalRunResult {
  ok: boolean;
  meshPath?: string;
  error?: string;
}

export type LocalCritic = (glbPath: string, deps?: CritiqueDeps) => Promise<CritiqueResult>;

/** Run `run`, gate its mesh with `critic`, and settle `job`. Fire-and-forget; never throws. */
export function settleLocalJob<R extends LocalRunResult>(
  job: LocalJobState<R>,
  run: () => Promise<R>,
  critic: LocalCritic,
  gateDeps: CritiqueDeps | undefined,
  onSettled?: () => void,
): void {
  run()
    .then(async (result) => {
      job.result = result;
      if (result.ok && result.meshPath) {
        // Best-effort, but a throw is still reported: with no card the gate summary would
        // claim "no mesh was produced" about a mesh that was.
        try { job.critique = await critic(result.meshPath, gateDeps); } catch (e) {
          job.critique = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
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
    })
    .finally(() => onSettled?.());
}
