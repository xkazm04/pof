/**
 * Best-of-N generation — the free "self-correction" mechanism for a DETERMINISTIC
 * generator. TripoSR is feed-forward (re-rolling the same image = the same mesh), so
 * true iterative refinement ("fix the legs") isn't possible for free. The honest free
 * lever is a param sweep: generate K variants (foreground framing / mc-resolution),
 * critique each (geometry health + CLIP fidelity), and keep the highest-scoring. Pairs
 * with the experiment-lab A-B-compare idea. The bigger refinement lever (regenerate the
 * 2D input) lives upstream and isn't wired yet.
 */
import { runTriposr, type TriposrSpec, type TriposrResult } from './triposr-runner';
import { critiqueMesh, type CritiqueResult } from './mesh-critique';

export interface Variant {
  label: string;
  foregroundRatio?: number;
  mcResolution?: number;
}

export interface GenCandidate {
  variant: string;
  result: TriposrResult;
  critique?: CritiqueResult;
  /** 0–100: blends geometry health + CLIP fidelity. */
  combinedScore: number;
}

export interface BestOfResult {
  best?: GenCandidate;
  candidates: GenCandidate[];
}

/** Blend the deterministic geometry score (0–100) with CLIP fidelity (0–1 → 0–100). Pure. */
export function combinedScore(result: TriposrResult, critique?: CritiqueResult): number {
  const geometry = critique?.score ?? 0;
  const fidelity = Math.round((result.clipMax ?? 0) * 100);
  return Math.round(0.5 * geometry + 0.5 * fidelity);
}

type Runner = (spec: TriposrSpec) => Promise<TriposrResult>;
type Critic = (glbPath: string) => Promise<CritiqueResult>;

function sanitize(label: string): string {
  return label.replace(/[^a-z0-9]/gi, '');
}

/** Generate each variant, critique it, and pick the highest combined score. `runner`/
 * `critic` are injectable for tests; default to the real ones. */
export async function generateBestOf(
  base: TriposrSpec,
  variants: Variant[],
  deps: { runner?: Runner; critic?: Critic; outputFor?: (label: string) => string } = {},
): Promise<BestOfResult> {
  const runner = deps.runner ?? runTriposr;
  const critic = deps.critic ?? critiqueMesh;
  const outputFor = deps.outputFor ?? ((label) => base.outputPath.replace(/(\.[^.]+)$/, `_${sanitize(label)}$1`));

  const candidates: GenCandidate[] = [];
  for (const v of variants) {
    const spec: TriposrSpec = {
      ...base,
      outputPath: outputFor(v.label),
      fidelity: true,
      ...(v.foregroundRatio !== undefined ? { foregroundRatio: v.foregroundRatio } : {}),
      ...(v.mcResolution !== undefined ? { mcResolution: v.mcResolution } : {}),
    };
    const result = await runner(spec);
    let critique: CritiqueResult | undefined;
    if (result.ok && result.meshPath) {
      try { critique = await critic(result.meshPath); } catch { /* critique is best-effort */ }
    }
    candidates.push({ variant: v.label, result, critique, combinedScore: combinedScore(result, critique) });
  }

  const best = candidates.filter((c) => c.result.ok).sort((a, b) => b.combinedScore - a.combinedScore)[0];
  return { best, candidates };
}
