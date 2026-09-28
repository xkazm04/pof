import type { ABTest, ABTestStatus, ABTestView } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';
import { type Result, ok, err } from '@/types/result';
import {
  MIN_TRIALS_PER_VARIANT,
  readFitness,
  zScoreOf,
  confidenceFromZ,
  decideWinner,
  toTestView,
  type JudgeScores,
  type FitnessReading,
} from './verdict';

// ── A/B test logic ──────────────────────────────────────────────────────────
// The reading (rates, basis, band, tie rule, floors) lives in ./verdict — the one
// place a verdict is computed. Re-exported here so existing importers keep working.
export {
  MIN_TRIALS_PER_VARIANT,
  MIN_JUDGED_VERDICTS_PER_VARIANT,
  readFitness,
  type VariantJudgeScore,
  type JudgeScores,
  type FitnessBasis,
  type FitnessReading,
} from './verdict';

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

  // Simple z-test for proportion difference (z=1.65 → 90%, z=1.96 → 95%).
  const confidence = confidenceFromZ(zScoreOf(reading));

  // Conclude if we have enough confidence or enough total trials
  const totalTrials = reading.trialsA + reading.trialsB;
  const shouldConclude = confidence >= 0.8 || totalTrials >= test.minTrials * 4;

  if (!shouldConclude) return { test, reading };

  return {
    test: {
      ...test,
      status: 'concluded',
      winnerId: decideWinner(test, reading),
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
 *
 * Past the floor it crowns on the SAME reading and the same tie rule as
 * auto-conclude ({@link decideWinner} over {@link readFitness}), so pressing
 * decide-now on judged evidence cannot overturn what the judges found. The
 * result carries that reading (`verdict`) so the caller can say its basis.
 */
export function forceConclude(test: ABTest, judged?: JudgeScores): Result<ABTestView, string> {
  if (test.status === 'concluded') return ok(toTestView(test, judged));

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

  const reading: FitnessReading = readFitness(test, judged);
  const concluded: ABTest = {
    ...test,
    status: 'concluded' as ABTestStatus,
    winnerId: decideWinner(test, reading),
    // A manual call is never better than an early lead — capped below the 0.8 band.
    confidence: Math.min(0.7, (test.variantATrials + test.variantBTrials) / 20),
    concludedAt: new Date().toISOString(),
  };
  return ok(toTestView(concluded, judged));
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
