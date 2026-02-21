import type { ABTest, ABTestStatus } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

// ── A/B test logic ──────────────────────────────────────────────────────────

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

/** Pick which variant to use for the next trial (epsilon-greedy). */
export function pickVariant(test: ABTest, epsilon = 0.2): 'A' | 'B' {
  const totalTrials = test.variantATrials + test.variantBTrials;

  // Explore phase: alternate until both have at least 2 trials
  if (test.variantATrials < 2) return 'A';
  if (test.variantBTrials < 2) return 'B';

  // Epsilon-greedy: explore with probability epsilon
  if (Math.random() < epsilon) {
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  // Exploit: pick the variant with higher success rate
  const rateA = test.variantATrials > 0 ? test.variantASuccesses / test.variantATrials : 0;
  const rateB = test.variantBTrials > 0 ? test.variantBSuccesses / test.variantBTrials : 0;

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

/** Check if a test should be concluded and compute the result. */
export function evaluateTest(test: ABTest): ABTest {
  if (test.status !== 'running') return test;
  if (test.variantATrials < test.minTrials || test.variantBTrials < test.minTrials) {
    return test;
  }

  const rateA = test.variantASuccesses / test.variantATrials;
  const rateB = test.variantBSuccesses / test.variantBTrials;

  // Simple z-test for proportion difference
  const pooledRate = (test.variantASuccesses + test.variantBSuccesses) /
    (test.variantATrials + test.variantBTrials);
  const pooledSE = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / test.variantATrials + 1 / test.variantBTrials)
  );

  const zScore = pooledSE > 0 ? Math.abs(rateA - rateB) / pooledSE : 0;

  // z=1.65 → 90% confidence, z=1.96 → 95% confidence
  const confidence = zScore >= 1.96 ? 0.95 : zScore >= 1.65 ? 0.9 : zScore >= 1.28 ? 0.8 : zScore * 0.5;

  // Conclude if we have enough confidence or enough total trials
  const totalTrials = test.variantATrials + test.variantBTrials;
  const shouldConclude = confidence >= 0.8 || totalTrials >= test.minTrials * 4;

  if (!shouldConclude) return test;

  let winnerId: string;
  if (Math.abs(rateA - rateB) < 0.05) {
    // Tie — pick the faster variant
    const avgA = test.variantATotalDurationMs / test.variantATrials;
    const avgB = test.variantBTotalDurationMs / test.variantBTrials;
    winnerId = avgA <= avgB ? test.variantAId : test.variantBId;
  } else {
    winnerId = rateA > rateB ? test.variantAId : test.variantBId;
  }

  return {
    ...test,
    status: 'concluded',
    winnerId,
    confidence,
    concludedAt: new Date().toISOString(),
  };
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
