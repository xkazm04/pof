import type { ABTest, ABTestStatus } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';
import { type Result, ok, err } from '@/types/result';

// ── A/B test logic ──────────────────────────────────────────────────────────

/**
 * The floor a manual "conclude now" must clear before a winner may be crowned.
 *
 * Concluding at zero trials used to hand the crown to whichever variant sat in
 * slot A (`rateA >= rateB` with both rates 0), which is not a measurement — it
 * is a coin flip dressed as evidence. Both variants must have actually been
 * served this many times before the engine will name a winner.
 */
export const MIN_TRIALS_PER_VARIANT = 3;

/**
 * How many JUDGE VERDICTS each arm needs before the judged basis is used at all.
 * Below this the arms fall back to the self-reported completion flag, which is
 * weak evidence but is at least evidence about every run.
 */
export const MIN_JUDGED_VERDICTS_PER_VARIANT = 3;

/**
 * What the judge fleet independently found about one variant's output, as
 * projected from `computeVariantFitness`. `avgScore` / `passRate` are `null`
 * when nothing has been judged — never `0`, which would read as "the judges
 * failed it".
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
export type FitnessBasis = 'judge' | 'self-reported';

/**
 * The comparison an A/B decision is actually made on, and WHAT it rests on.
 *
 * `self-reported` is the historical basis: the checklist callback flips a
 * boolean the run wrote about itself, so the "success rate" measures whether
 * Claude said it finished — not whether the work was any good. That is a fitness
 * signal on the wrong surface (ai-registry `software-engineering/quality-gates`).
 * `judge` is the same arithmetic over independently scored verdicts.
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

/**
 * Decide which basis this test can honestly be read on, and project the rates.
 *
 * The judged basis is used ONLY when BOTH arms clear
 * {@link MIN_JUDGED_VERDICTS_PER_VARIANT}: judging one arm and not the other
 * would compare a scored variant against an unscored one and crown whichever
 * happened to be measured. With no scores at all — a checklist item nobody has
 * judged, or the pre-`checklist-runs` world — this returns the unchanged
 * self-reported reading, so behaviour is byte-identical to before.
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

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Create a new A/B test between two variants. */
export function createABTest(
  moduleId: string,
  checklistItemId: string,
  variantAId: string,
  variantBId: string,
  minTrials = 5,
): ABTest {
  return {
    id: `ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    moduleId: moduleId as SubModuleId,
    checklistItemId,
    variantAId,
    variantBId,
    variantATrials: 0,
    variantBTrials: 0,
    variantASuccesses: 0,
    variantBSuccesses: 0,
    variantATotalDurationMs: 0,
    variantBTotalDurationMs: 0,
    minTrials,
    status: 'running',
    winnerId: null,
    confidence: 0,
    createdAt: new Date().toISOString(),
    concludedAt: null,
  };
}

/**
 * Pick which variant to use for the next trial (epsilon-greedy).
 *
 * `judged` is optional and additive: with none — or with too few verdicts —
 * the exploit branch reads exactly the self-reported rates it always did.
 */
export function pickVariant(test: ABTest, epsilon = 0.2, judged?: JudgeScores): 'A' | 'B' {
  // Explore phase: alternate until both have at least 2 trials. This counts
  // SERVES, never verdicts — an arm that has not been served cannot be judged.
  if (test.variantATrials < 2) return 'A';
  if (test.variantBTrials < 2) return 'B';

  // Epsilon-greedy: explore with probability epsilon
  if (Math.random() < epsilon) {
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  // Exploit: pick the variant with the higher rate on the best basis available.
  const { rateA, rateB } = readFitness(test, judged);

  if (rateA === rateB) {
    // Tie-break by average duration (faster wins)
    const avgA = test.variantATrials > 0 ? test.variantATotalDurationMs / test.variantATrials : Infinity;
    const avgB = test.variantBTrials > 0 ? test.variantBTotalDurationMs / test.variantBTrials : Infinity;
    return avgA <= avgB ? 'A' : 'B';
  }

  return rateA > rateB ? 'A' : 'B';
}

/** Record a trial result for a variant. */
export function recordTrial(
  test: ABTest,
  variant: 'A' | 'B',
  success: boolean,
  durationMs: number,
): ABTest {
  const updated = { ...test };
  if (variant === 'A') {
    updated.variantATrials++;
    if (success) updated.variantASuccesses++;
    updated.variantATotalDurationMs += durationMs;
  } else {
    updated.variantBTrials++;
    if (success) updated.variantBSuccesses++;
    updated.variantBTotalDurationMs += durationMs;
  }
  return updated;
}

/**
 * Check if a test should be concluded and compute the result.
 *
 * Additive `judged` argument: when both arms carry enough judge verdicts the
 * SAME proportion z-test runs over judged pass rates instead of the runs'
 * self-reported completion flags. With no scores the arithmetic and the outcome
 * are byte-identical to before.
 */
export function evaluateTest(test: ABTest, judged?: JudgeScores): ABTest {
  return evaluateTestWithBasis(test, judged).test;
}

/**
 * {@link evaluateTest}, but it also SAYS what decided it — the caller can log or
 * render "concluded on judge verdicts" instead of leaving the operator to guess
 * whether a winner was crowned on quality or on a self-report.
 */
export function evaluateTestWithBasis(
  test: ABTest,
  judged?: JudgeScores,
): { test: ABTest; reading: FitnessReading } {
  const reading = readFitness(test, judged);
  if (test.status !== 'running') return { test, reading };
  // The serve-volume gate is always on SERVES: a variant that was not dispatched
  // enough times has not been tried, however many verdicts exist.
  if (test.variantATrials < test.minTrials || test.variantBTrials < test.minTrials) {
    return { test, reading };
  }
  // …and on the judged basis, the evidence volume must clear the same bar.
  if (reading.basis === 'judge' && (reading.trialsA < test.minTrials || reading.trialsB < test.minTrials)) {
    return { test, reading };
  }

  const { rateA, rateB, trialsA, trialsB, successesA, successesB } = reading;

  // Simple z-test for proportion difference
  const pooledRate = (successesA + successesB) / (trialsA + trialsB);
  const pooledSE = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / trialsA + 1 / trialsB)
  );

  const zScore = pooledSE > 0 ? Math.abs(rateA - rateB) / pooledSE : 0;

  // z=1.65 → 90% confidence, z=1.96 → 95% confidence
  const confidence = zScore >= 1.96 ? 0.95 : zScore >= 1.65 ? 0.9 : zScore >= 1.28 ? 0.8 : zScore * 0.5;

  // Conclude if we have enough confidence or enough total trials
  const totalTrials = trialsA + trialsB;
  const shouldConclude = confidence >= 0.8 || totalTrials >= test.minTrials * 4;

  if (!shouldConclude) return { test, reading };

  let winnerId: string;
  if (Math.abs(rateA - rateB) < 0.05) {
    // Tie — pick the faster variant. Duration is always a self-reported run
    // measurement; there is no judged equivalent.
    const avgA = test.variantATotalDurationMs / test.variantATrials;
    const avgB = test.variantBTotalDurationMs / test.variantBTrials;
    winnerId = avgA <= avgB ? test.variantAId : test.variantBId;
  } else {
    winnerId = rateA > rateB ? test.variantAId : test.variantBId;
  }

  return {
    test: {
      ...test,
      status: 'concluded',
      winnerId,
      confidence,
      concludedAt: new Date().toISOString(),
    },
    reading,
  };
}

/**
 * Conclude a test on demand (the user's "decide now" button), refusing while
 * either variant is still below {@link MIN_TRIALS_PER_VARIANT}.
 *
 * Unlike {@link evaluateTest} — which only concludes once the automatic
 * significance/volume gate opens — this is the manual override, so the floor is
 * the ONLY thing standing between an unmeasured variant and a crown. The error
 * side carries the shortfall so the caller can say exactly why nothing was
 * decided rather than silently doing nothing.
 */
export function forceConclude(test: ABTest): Result<ABTest, string> {
  if (test.status === 'concluded') return ok(test);

  const shortfall: string[] = [];
  if (test.variantATrials < MIN_TRIALS_PER_VARIANT) {
    shortfall.push(`A has ${test.variantATrials}`);
  }
  if (test.variantBTrials < MIN_TRIALS_PER_VARIANT) {
    shortfall.push(`B has ${test.variantBTrials}`);
  }
  if (shortfall.length > 0) {
    return err(
      `Not enough trials to pick a winner — each variant needs ${MIN_TRIALS_PER_VARIANT} ` +
        `(${shortfall.join(', ')}). Dispatch this checklist item a few more times.`,
    );
  }

  const rateA = test.variantASuccesses / test.variantATrials;
  const rateB = test.variantBSuccesses / test.variantBTrials;

  return ok({
    ...test,
    status: 'concluded' as ABTestStatus,
    winnerId: rateA >= rateB ? test.variantAId : test.variantBId,
    confidence: Math.min(0.7, (test.variantATrials + test.variantBTrials) / 20),
    concludedAt: new Date().toISOString(),
  });
}

/** Format a human-readable summary of the test. */
export function formatTestSummary(test: ABTest): string {
  const rateA = test.variantATrials > 0
    ? `${Math.round((test.variantASuccesses / test.variantATrials) * 100)}%`
    : 'N/A';
  const rateB = test.variantBTrials > 0
    ? `${Math.round((test.variantBSuccesses / test.variantBTrials) * 100)}%`
    : 'N/A';
  const avgDurA = test.variantATrials > 0
    ? `${Math.round(test.variantATotalDurationMs / test.variantATrials / 1000)}s`
    : 'N/A';
  const avgDurB = test.variantBTrials > 0
    ? `${Math.round(test.variantBTotalDurationMs / test.variantBTrials / 1000)}s`
    : 'N/A';

  return `A: ${rateA} success (${test.variantATrials} trials, avg ${avgDurA}) vs B: ${rateB} success (${test.variantBTrials} trials, avg ${avgDurB})`;
}
