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
import { critiqueMesh, ungatedReason, CRITIQUE_CALIBRATION_CAVEAT, type CritiqueResult } from './mesh-critique';

export interface Variant {
  label: string;
  foregroundRatio?: number;
  mcResolution?: number;
}

export interface GenCandidate {
  variant: string;
  result: TriposrResult;
  critique?: CritiqueResult;
  /** 0–100, over the components that were actually measured (see `scoreLabel`). */
  combinedScore: number;
  /** What that number is made of — geometry+fidelity, geometry-only, or ungraded. */
  scoreLabel: string;
}

export interface BestOfResult {
  best?: GenCandidate;
  candidates: GenCandidate[];
}

/** Which components a combined score was actually computed from. */
export type ScoreBasis = 'geometry+fidelity' | 'geometry-only' | 'ungraded';

export interface ScoreBreakdown {
  score: number;
  basis: ScoreBasis;
  /** One line naming what the number is made of — never a bare number. */
  label: string;
}

/**
 * Score a roll from the components that were actually MEASURED. Pure.
 *
 * The old blend was a fixed `0.5*geometry + 0.5*clipMax`. Only TripoSR reports a CLIP
 * similarity; `TripoResult` has no `clipMax` at all, so every cloud roll was scored as
 * though its fidelity had been measured at zero — a structurally perfect Tripo mesh
 * read "score 50", and the cap was invisible in the number. Averaging in a component
 * nobody measured is a lie about precision, so a missing component is now DROPPED and
 * the basis is stated instead.
 */
export function scoreBreakdown(result: { clipMax?: number }, critique?: CritiqueResult): ScoreBreakdown {
  const graded = critique?.ok === true && typeof critique.score === 'number';
  const geometry = graded ? (critique?.score ?? 0) : 0;
  const clip = result.clipMax;

  if (!graded) {
    return {
      score: 0,
      basis: 'ungraded',
      label: critique?.unavailable
        ? 'score 0 (ungraded — the geometry critic could not run, so nothing was measured)'
        : 'score 0 (ungraded — no geometry critique completed for this roll)',
    };
  }
  if (typeof clip !== 'number' || !Number.isFinite(clip)) {
    return {
      score: Math.round(geometry),
      basis: 'geometry-only',
      label: `score ${Math.round(geometry)} (geometry-only — this provider reports no CLIP fidelity, so none is averaged in)`,
    };
  }
  const fidelity = Math.round(clip * 100);
  const score = Math.round(0.5 * geometry + 0.5 * fidelity);
  return {
    score,
    basis: 'geometry+fidelity',
    label: `score ${score} (geometry ${Math.round(geometry)} + CLIP fidelity ${fidelity}, evenly weighted)`,
  };
}

/** The combined score alone. See {@link scoreBreakdown} for what it is made of. Pure. */
export function combinedScore(result: { clipMax?: number }, critique?: CritiqueResult): number {
  return scoreBreakdown(result, critique).score;
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
    const breakdown = scoreBreakdown(result, critique);
    candidates.push({ variant: v.label, result, critique, combinedScore: breakdown.score, scoreLabel: breakdown.label });
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

/**
 * The SHAPE of a failure — its PRIMARY reason with every number blanked out.
 *
 * Two rolls of the same broken provider never fail identically. Measured against the live
 * Tripo API across three runs: the counts move every roll ("33 floater fragments … 56
 * disconnected parts", then "12 … 38"), and the tail of the list fluctuates too — an
 * incidental "1 degenerate faces" appears on some rolls and not others. Comparing the raw
 * strings never matches; comparing the whole normalised list still missed a repeat because
 * of that tail noise. `scoreMesh` emits fails before warns, so the FIRST reason is the
 * verdict-driving defect — normalising just that one identifies "same primary defect
 * again" without being derailed by incidental extras. Pure.
 */
export function failureShape(critique: CritiqueResult | undefined): string | undefined {
  const primary = critique?.reasons?.[0];
  return primary === undefined ? undefined : primary.replace(/\d+(?:\.\d+)?/g, '#');
}

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
  /** What the score was computed from — a bare number cannot say "half of me is missing". */
  scoreBasis: ScoreBasis;
  /** The score stated in words, e.g. "score 100 (geometry-only — …)". */
  scoreLabel: string;
}

export interface RetryOutcome<R> {
  attempts: RollAttempt<R>[];
  /** Highest-scoring roll that produced a mesh — present even when none was accepted. */
  best?: RollAttempt<R>;
  /** True only when a roll actually cleared the gate. Never inferred from `best`. */
  accepted: boolean;
  /**
   * True when the mesh was delivered with NOTHING having graded it (the critic could not
   * run). Distinct from `accepted: false`, which means a gate ran and rejected it.
   */
  ungated?: boolean;
  reason: string;
  /** The calibration caveat, present only when a real failing verdict is being reported. */
  note?: string;
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
  let previousFailure: string | undefined;
  for (let n = 1; n <= maxAttempts; n++) {
    const result = await roll(n);
    let critique: CritiqueResult | undefined;
    if (result.ok && result.meshPath) {
      try { critique = await critic(result.meshPath); } catch { /* critique is best-effort */ }
    }
    const breakdown = scoreBreakdown(result, critique);
    const entry: RollAttempt<R> = {
      attempt: n, result, critique,
      score: breakdown.score, scoreBasis: breakdown.basis, scoreLabel: breakdown.label,
    };
    attempts.push(entry);

    if (result.ok && isAcceptable(critique)) {
      return { attempts, best: entry, accepted: true, reason: `accepted on attempt ${n} of at most ${maxAttempts} — ${breakdown.label}` };
    }

    // The critic could not RUN. Re-rolling cannot change that: an absent gate rejects
    // every mesh identically, so each further attempt is a paid provider task bought
    // against an outcome it can never influence. Stop at one roll and say what is
    // missing, instead of blaming the mesh for a tool that was never there.
    if (critique?.unavailable) {
      return {
        attempts,
        best: result.ok ? entry : undefined,
        accepted: false,
        ungated: true,
        reason: ungatedReason(critique),
      };
    }

    // Re-rolling only buys anything when the failure is a dice roll. Measured against the
    // live Tripo API: raw generator output fails the same way every time (500k faces, the
    // same disconnected-part budget), so a blind loop paid the full cap for an outcome it
    // could never change. Once a failure reproduces, stop and say so — the next attempt
    // costs real money and would return the same verdict.
    const failure = failureShape(critique);
    if (failure !== undefined && failure === previousFailure) {
      const best = attempts.filter((a) => a.result.ok).sort((a, b) => b.score - a.score)[0];
      return {
        attempts,
        best,
        accepted: false,
        reason: `stopped after ${n} attempts — the same failure reproduced, so it is systematic rather than a bad roll: ${critique?.reasons?.[0] ?? 'unknown'}`,
        note: CRITIQUE_CALIBRATION_CAVEAT,
      };
    }
    previousFailure = failure;
  }

  const best = attempts.filter((a) => a.result.ok).sort((a, b) => b.score - a.score)[0];
  return {
    attempts,
    best,
    accepted: false,
    reason: best
      ? `no roll cleared the gate in ${maxAttempts} attempts — best was attempt ${best.attempt} (${best.scoreLabel})`
      : `no roll produced a mesh in ${maxAttempts} attempts`,
    ...(best ? { note: CRITIQUE_CALIBRATION_CAVEAT } : {}),
  };
}
