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
export function combinedScore(result: { clipMax?: number }, critique?: CritiqueResult): number {
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

// ── gate-driven retry (the STOCHASTIC counterpart to the param sweep above) ────

/**
 * Attempts a re-roll loop will spend before giving up. Deliberately small: a cloud
 * generator charges per task, so every extra attempt is real money. The loop stops on
 * the first acceptable roll, so a healthy generator normally pays for exactly one.
 */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** The minimum a generator result must expose for the retry loop to judge it. */
export interface MeshRoll {
  ok: boolean;
  meshPath?: string;
  clipMax?: number;
}

export interface RollAttempt<R> {
  attempt: number;
  result: R;
  critique?: CritiqueResult;
  score: number;
}

export interface RetryOutcome<R> {
  attempts: RollAttempt<R>[];
  /** Highest-scoring roll that produced a mesh — present even when none was accepted. */
  best?: RollAttempt<R>;
  /** True only when a roll actually cleared the gate. Never inferred from `best`. */
  accepted: boolean;
  reason: string;
}

/**
 * Re-roll a STOCHASTIC generator until its mesh clears the Tier-1 geometry gate.
 *
 * `generateBestOf` above sweeps parameters because TripoSR is feed-forward — re-rolling
 * the same image returns the same mesh, so variation has to be forced through params,
 * and the sweep proved near-tied in practice. A stochastic cloud generator has the
 * opposite shape: the same input genuinely re-rolls, so the honest lever is to regenerate
 * a broken mesh instead of shipping it. This is the loop that does that.
 *
 * Provider-agnostic on purpose: it takes a `roll` closure rather than a runner, so it
 * works with any generator without this module importing one.
 *
 * Honesty rules: a roll that produced no mesh is never critiqued and never accepted, and
 * exhausting the budget returns `accepted: false` with the best-so-far still surfaced —
 * a best-of-a-bad-set is reported as exactly that, not as a pass.
 */
export async function generateUntilAcceptable<R extends MeshRoll>(
  roll: (attempt: number) => Promise<R>,
  deps: {
    critic?: Critic;
    maxAttempts?: number;
    isAcceptable?: (critique: CritiqueResult | undefined) => boolean;
  } = {},
): Promise<RetryOutcome<R>> {
  const critic = deps.critic ?? critiqueMesh;
  const maxAttempts = Math.max(1, deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const isAcceptable = deps.isAcceptable ?? ((c) => c?.ok === true && c.verdict !== undefined && c.verdict !== 'fail');

  const attempts: RollAttempt<R>[] = [];
  for (let n = 1; n <= maxAttempts; n++) {
    const result = await roll(n);
    let critique: CritiqueResult | undefined;
    if (result.ok && result.meshPath) {
      try { critique = await critic(result.meshPath); } catch { /* critique is best-effort */ }
    }
    const entry: RollAttempt<R> = { attempt: n, result, critique, score: combinedScore(result, critique) };
    attempts.push(entry);

    if (result.ok && isAcceptable(critique)) {
      return { attempts, best: entry, accepted: true, reason: `accepted on attempt ${n} of at most ${maxAttempts}` };
    }
  }

  const best = attempts.filter((a) => a.result.ok).sort((a, b) => b.score - a.score)[0];
  return {
    attempts,
    best,
    accepted: false,
    reason: best
      ? `no roll cleared the gate in ${maxAttempts} attempts — best was attempt ${best.attempt} (score ${best.score})`
      : `no roll produced a mesh in ${maxAttempts} attempts`,
  };
}
