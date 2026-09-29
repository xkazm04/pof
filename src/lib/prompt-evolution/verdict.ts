import type {
  ABTest,
  ABTestVerdict,
  ABTestView,
  VerdictBand,
  VerdictBasis,
} from '@/types/prompt-evolution';

/**
 * THE A/B verdict seam — the only place an arm's rate, a tie, a confidence band,
 * a decide-now shortfall and the evidence basis are computed.
 *
 * Auto-conclude (`evaluateTestWithBasis`), decide-now (`forceConclude`), the
 * dispatch exploit (`pickVariant`), the plain-language verdict and the test card
 * all read {@link readFitness} / {@link readTestVerdict} and crown through
 * {@link decideWinner}, so manual and automatic conclusion cannot disagree on the
 * same evidence and every surface can say what the verdict rests on
 * (ai-registry `game-production/prompt-fitness-and-evolution`).
 */

/**
 * The floor a manual "conclude now" must clear before a winner may be crowned.
 * Both variants must have actually been SERVED this many times.
 */
export const MIN_TRIALS_PER_VARIANT = 3;

/**
 * How many JUDGE VERDICTS each arm needs before the judged basis is used at all.
 * Below this the arms fall back to the self-reported completion flag.
 */
export const MIN_JUDGED_VERDICTS_PER_VARIANT = 3;

/** Rates closer than this are a tie on results — duration breaks it. */
export const TIE_MARGIN = 0.05;

/**
 * What the judge fleet independently found about one variant's output. `avgScore`
 * / `passRate` are `null` when nothing has been judged — never `0`.
 */
export interface VariantJudgeScore {
  avgScore: number | null;
  passRate: number | null;
  verdicts: number;
  judgedArtifacts: number;
}

/** Judge scores keyed by variant id. */
export type JudgeScores = Record<string, VariantJudgeScore>;

/** Which evidence decided a comparison. */
export type FitnessBasis = VerdictBasis;

/**
 * The comparison an A/B decision is made on, and WHAT it rests on. `self-reported`
 * counts the run's own completion flag; `judge` is the same arithmetic over
 * independently scored verdicts.
 */
export interface FitnessReading {
  basis: FitnessBasis;
  /** Success rate of arm A / B on this basis, 0–1. */
  rateA: number;
  rateB: number;
  /** Trials the rate is computed over (runs for self-reported, verdicts for judge). */
  trialsA: number;
  trialsB: number;
  /** Successes, i.e. `rate * trials` rounded — the z-test's numerator. */
  successesA: number;
  successesB: number;
  /** One line naming the basis and the evidence behind it. */
  note: string;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Decide which basis this test can honestly be read on, and project the rates.
 * The judged basis is used ONLY when BOTH arms clear
 * {@link MIN_JUDGED_VERDICTS_PER_VARIANT}; otherwise this is the unchanged
 * self-reported reading.
 */
export function readFitness(test: ABTest, judged?: JudgeScores): FitnessReading {
  const a = judged?.[test.variantAId];
  const b = judged?.[test.variantBId];
  const usable =
    !!a && !!b &&
    a.passRate !== null && b.passRate !== null &&
    a.verdicts >= MIN_JUDGED_VERDICTS_PER_VARIANT &&
    b.verdicts >= MIN_JUDGED_VERDICTS_PER_VARIANT;

  if (usable) {
    const rateA = a.passRate as number;
    const rateB = b.passRate as number;
    return {
      basis: 'judge',
      rateA,
      rateB,
      trialsA: a.verdicts,
      trialsB: b.verdicts,
      successesA: Math.round(rateA * a.verdicts),
      successesB: Math.round(rateB * b.verdicts),
      note:
        `judge verdicts — A: ${pct(rateA)} pass over ${a.verdicts} verdict(s)` +
        `${a.avgScore === null ? '' : ` (avg ${a.avgScore.toFixed(1)})`} vs ` +
        `B: ${pct(rateB)} pass over ${b.verdicts} verdict(s)` +
        `${b.avgScore === null ? '' : ` (avg ${b.avgScore.toFixed(1)})`}`,
    };
  }

  const rateA = test.variantATrials > 0 ? test.variantASuccesses / test.variantATrials : 0;
  const rateB = test.variantBTrials > 0 ? test.variantBSuccesses / test.variantBTrials : 0;
  return {
    basis: 'self-reported',
    rateA,
    rateB,
    trialsA: test.variantATrials,
    trialsB: test.variantBTrials,
    successesA: test.variantASuccesses,
    successesB: test.variantBSuccesses,
    note:
      `self-reported completions — A: ${test.variantASuccesses}/${test.variantATrials} vs ` +
      `B: ${test.variantBSuccesses}/${test.variantBTrials}` +
      (judged
        ? ` (no judged basis: each arm needs ${MIN_JUDGED_VERDICTS_PER_VARIANT} verdict(s), ` +
          `A has ${a?.verdicts ?? 0}, B has ${b?.verdicts ?? 0})`
        : ''),
  };
}

/** Two-proportion z-score of the reading; `0` when there is no spread to test. */
export function zScoreOf(reading: FitnessReading): number {
  const { rateA, rateB, trialsA, trialsB, successesA, successesB } = reading;
  const pooledRate = (successesA + successesB) / (trialsA + trialsB);
  const pooledSE = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / trialsA + 1 / trialsB));
  return pooledSE > 0 ? Math.abs(rateA - rateB) / pooledSE : 0;
}

/** z → the stored confidence (z=1.96 → 0.95, 1.65 → 0.9, 1.28 → 0.8, below: z/2). */
export function confidenceFromZ(z: number): number {
  return z >= 1.96 ? 0.95 : z >= 1.65 ? 0.9 : z >= 1.28 ? 0.8 : z * 0.5;
}

/** z → the named confidence band the UI and the docs report. */
export function bandFromZ(z: number): VerdictBand {
  return z >= 1.96 ? 'strong' : z >= 1.65 ? 'moderate' : z >= 1.28 ? 'weak' : 'none';
}

/**
 * The ONE crowning rule: a gap of at least {@link TIE_MARGIN} wins on results;
 * a closer pair is a tie broken by the lower average duration (A on an exact
 * duration tie). Only called once both arms have trials.
 */
export function decideWinner(test: ABTest, reading: FitnessReading): string {
  const { rateA, rateB } = reading;
  if (Math.abs(rateA - rateB) < TIE_MARGIN) {
    // Duration is always a self-reported run measurement; there is no judged equivalent.
    const avgA = test.variantATotalDurationMs / test.variantATrials;
    const avgB = test.variantBTotalDurationMs / test.variantBTrials;
    return avgA <= avgB ? test.variantAId : test.variantBId;
  }
  return rateA > rateB ? test.variantAId : test.variantBId;
}

/** Everything a surface needs to state a verdict: rates, band, basis, floor. */
export function readTestVerdict(test: ABTest, judged?: JudgeScores): ABTestVerdict {
  const reading = readFitness(test, judged);
  const z = reading.trialsA > 0 && reading.trialsB > 0 ? zScoreOf(reading) : 0;
  const tie = Math.abs(reading.rateA - reading.rateB) < TIE_MARGIN;
  const hasEvidence = reading.trialsA > 0 || reading.trialsB > 0;
  const shortfall = {
    A: Math.max(0, MIN_TRIALS_PER_VARIANT - test.variantATrials),
    B: Math.max(0, MIN_TRIALS_PER_VARIANT - test.variantBTrials),
  };
  return {
    basis: reading.basis,
    rateA: reading.rateA,
    rateB: reading.rateB,
    trialsA: reading.trialsA,
    trialsB: reading.trialsB,
    band: bandFromZ(z),
    leader: !hasEvidence || tie ? null : reading.rateA > reading.rateB ? 'A' : 'B',
    tie,
    shortfall,
    canConclude: test.status === 'running' && shortfall.A === 0 && shortfall.B === 0,
    note: reading.note,
  };
}

/** Annotate a test with its reading — the shape every server read returns. */
export function toTestView(test: ABTest, judged?: JudgeScores): ABTestView {
  return { ...test, verdict: readTestVerdict(test, judged) };
}

/** The server's reading when the test carries one, else the self-reported reading. */
export function verdictOf(test: ABTest | ABTestView): ABTestVerdict {
  return 'verdict' in test && test.verdict ? test.verdict : readTestVerdict(test);
}
