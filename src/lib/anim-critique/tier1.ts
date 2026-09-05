/**
 * The seam that finally composes the two motion tiers.
 *
 * `@/lib/motion-gate` (Tier-1: cheap, exact, numeric loop closure) and this directory
 * (Tier-2: the paid VLM aesthetic critique) were built to stack, and never did — motion-gate
 * was imported by nothing but its own test, so a clip that provably does not loop (141.8 mm
 * of RMS pose gap on a raw ARDY walk) still bought a filmstrip render plus a vision call,
 * and could come back `pass` from six dimensions none of which is a loop check.
 *
 * The two tiers answer DIFFERENT questions and are reported side by side, each with its own
 * basis — ai-registry `game-production/motion-quality-gating`, "three questions, and they do
 * not average". Integrity (does this clip close?) is measured in millimetres by a pure
 * function; craft (does it read as a real motion?) is a model's opinion on 0-100. Neither is
 * folded into the other, and a Tier-1 failure does not lower a craft score — it means craft
 * was never measured, which is what `Tier2Report.status = 'not-run'` says.
 *
 * The status set is deliberately wider than `LoopVerdict`: `not-run` (no Tier-1 input was
 * supplied) and `error` (the extractor itself failed) are distinct from `n/a` (a one-shot
 * clip, which is not gradable on loop closure). All three are un-measured states and none of
 * them may render as a pass — "never manufacture a number to complete a report".
 */
import {
  critiqueLoop,
  type LoopIntent,
  type LoopScorecard,
  type LoopVerdict,
} from '@/lib/motion-gate';

/** What this tier answers, stated on every report so the two are never read as one score. */
export const TIER1_BASIS = 'integrity — numeric loop closure, root-relative millimetres (pure, no model)' as const;
export const TIER2_BASIS = 'craft — VLM aesthetic critique over six dimensions (0-100, worst-of)' as const;

/** `LoopVerdict` plus the two states that mean "this gate produced no measurement". */
export type Tier1Status = LoopVerdict | 'not-run' | 'error';

export interface Tier1Report {
  status: Tier1Status;
  basis: typeof TIER1_BASIS;
  /** One line naming what decided the status — or why nothing did. */
  reason: string;
  /** Present only when the gate actually measured something. */
  card?: LoopScorecard;
  /** The extractor's own diagnosis, verbatim, when `status === 'error'`. */
  error?: string;
}

export interface Tier2Report {
  status: 'ran' | 'not-run';
  basis: typeof TIER2_BASIS;
  reason?: string;
}

/**
 * How a caller supplies Tier-1.
 *
 * `markers` — the extractor's stdout — is the primary seam, chosen to MIRROR
 * `visual-gen/mesh-critique.parseCritiqueMetrics`: the loop extractor
 * (`scripts/visual-gen/ardy/pof_loop_closure.py`) runs outside this process and its only
 * transport is the marker text it prints. Accepting a pre-scored verdict as the only door
 * would force every caller to re-implement the parser AND would let a caller hand-write a
 * `pass` the extractor never emitted. `card` exists for callers that already ran the pure
 * core in-process (and for tests injecting a result), never as a way to skip measurement.
 */
export interface Tier1Input {
  markers?: string;
  intent?: LoopIntent;
  card?: LoopScorecard;
}

export const TIER1_NOT_RUN: Tier1Report = {
  status: 'not-run',
  basis: TIER1_BASIS,
  reason: 'No Tier-1 loop-closure input supplied — the numeric gate did NOT run. This is not a pass.',
};

export const TIER2_RAN: Tier2Report = { status: 'ran', basis: TIER2_BASIS };

export function tier2NotRun(reason: string): Tier2Report {
  return { status: 'not-run', basis: TIER2_BASIS, reason };
}

/** Turn whatever the caller supplied into a report. Pure. Never invents a verdict. */
export function resolveTier1(input?: Tier1Input): Tier1Report {
  if (!input) return TIER1_NOT_RUN;
  if (input.card) {
    return { status: input.card.verdict, basis: TIER1_BASIS, reason: input.card.reason, card: input.card };
  }
  if (typeof input.markers !== 'string' || input.markers.trim() === '') return TIER1_NOT_RUN;

  const run = critiqueLoop(input.markers, input.intent ?? 'loop');
  if (!run.ok || !run.card) {
    const error = run.error ?? 'loop extraction failed without a reason';
    return {
      status: 'error',
      basis: TIER1_BASIS,
      reason: `Tier-1 gate could not run: ${error}`,
      error,
    };
  }
  return { status: run.card.verdict, basis: TIER1_BASIS, reason: run.card.reason, card: run.card };
}

/**
 * Only a MEASURED failure gates the expensive tier. `warn` is worth a human's eye but not
 * worth throwing the clip away unseen; `n/a`, `error` and `not-run` produced no measurement
 * at all, and an un-run gate must not act like a failed one any more than like a passed one.
 */
export function tier1Blocks(report: Tier1Report): boolean {
  return report.status === 'fail';
}
