import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createABTest,
  recordTrial,
  forceConclude,
  evaluateTestWithBasis,
  readFitness,
  type JudgeScores,
} from '@/lib/prompt-evolution/ab-testing';
import { readTestVerdict } from '@/lib/prompt-evolution/verdict';
import { explainTestVerdict } from '@/lib/prompt-evolution/plain-language';
import type { ABTest, ABTestView } from '@/types/prompt-evolution';

/**
 * One A/B verdict reading (scan-sweep --challenge, card prompt-evolution/A).
 *
 * "Which arm won, on what evidence" used to be answered in five places with three
 * rules: auto-conclude read judge verdicts, decide-now (`forceConclude`) re-derived
 * self-reported rates and handed ties to slot A, and the plain verdict re-derived
 * self-reported rates again. These cases pin that every surface reads ONE reading.
 */

function arms(
  a: { trials: number; wins: number; ms?: number },
  b: { trials: number; wins: number; ms?: number },
  minTrials = 3,
): ABTest {
  let t = createABTest('arpg-combat', 'combat-hit-detect', 'var-a', 'var-b', minTrials);
  for (let i = 0; i < a.trials; i++) t = recordTrial(t, 'A', i < a.wins, a.ms ?? 1000);
  for (let i = 0; i < b.trials; i++) t = recordTrial(t, 'B', i < b.wins, b.ms ?? 1000);
  return t;
}

function scores(aPass: number, aVerdicts: number, bPass: number, bVerdicts: number): JudgeScores {
  return {
    'var-a': { avgScore: aPass * 100, passRate: aPass, verdicts: aVerdicts, judgedArtifacts: aVerdicts },
    'var-b': { avgScore: bPass * 100, passRate: bPass, verdicts: bVerdicts, judgedArtifacts: bVerdicts },
  };
}

describe('forceConclude reads the same verdict as auto-conclude', () => {
  it('crowns the JUDGED winner on decide-now and says the basis was judge', () => {
    // Self-report: A 4/5, B 5/5. The judges: A 80% over 5, B 20% over 5.
    const test = arms({ trials: 5, wins: 4 }, { trials: 5, wins: 5 });
    const result = forceConclude(test, scores(0.8, 5, 0.2, 5));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.winnerId).toBe('var-a');
    expect((result.data as ABTestView).verdict.basis).toBe('judge');
  });

  it('breaks an exact success tie on duration, not on slot order', () => {
    // A 3/3 at 20s each, B 3/3 at 10s each → B is the declared tie-break winner.
    const test = arms({ trials: 3, wins: 3, ms: 20_000 }, { trials: 3, wins: 3, ms: 10_000 });
    const result = forceConclude(test);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.winnerId).toBe('var-b');
  });
});

describe('explainTestVerdict reads the reading it is given', () => {
  it('cites the judged rates for a judge-decided winner and never states the winner below the loser', () => {
    const test: ABTest = {
      ...arms({ trials: 5, wins: 4 }, { trials: 5, wins: 5 }),
      status: 'concluded',
      winnerId: 'var-a',
      confidence: 0.95,
      concludedAt: '2026-09-28T00:00:00.000Z',
    };
    const verdict = readTestVerdict(test, scores(0.8, 5, 0.2, 5));
    const plain = explainTestVerdict(test, 'Alpha', 'Beta', verdict);
    expect(plain.headline).toContain('Alpha');
    expect(plain.detail).toContain('80%');
    expect(plain.detail).toContain('20%');
    expect(plain.detail).toContain('5 verdicts');
    // Today: "It succeeded 4 of 5 times (80%), compared with 100% for Beta."
    expect(plain.detail).not.toContain('100%');
  });
});

describe('readTestVerdict — the decide-now floor', () => {
  it('names the per-arm shortfall and refuses to conclude below the floor', () => {
    const v = readTestVerdict(arms({ trials: 2, wins: 2 }, { trials: 3, wins: 1 }));
    expect(v.canConclude).toBe(false);
    expect(v.shortfall).toEqual({ A: 1, B: 0 });
  });

  it('allows conclusion once both arms clear the floor', () => {
    const v = readTestVerdict(arms({ trials: 3, wins: 2 }, { trials: 3, wins: 1 }));
    expect(v.canConclude).toBe(true);
    expect(v.shortfall).toEqual({ A: 0, B: 0 });
  });
});

// ── [guard] auto-conclude is byte-identical ─────────────────────────────────

/** Today's `evaluateTestWithBasis(test).test`, frozen verbatim as the reference. */
function legacyEvaluate(test: ABTest, judged?: JudgeScores): ABTest {
  const reading = readFitness(test, judged);
  if (test.status !== 'running') return test;
  if (test.variantATrials < test.minTrials || test.variantBTrials < test.minTrials) return test;
  if (reading.basis === 'judge' && (reading.trialsA < test.minTrials || reading.trialsB < test.minTrials)) {
    return test;
  }
  const { rateA, rateB, trialsA, trialsB, successesA, successesB } = reading;
  const pooledRate = (successesA + successesB) / (trialsA + trialsB);
  const pooledSE = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / trialsA + 1 / trialsB));
  const zScore = pooledSE > 0 ? Math.abs(rateA - rateB) / pooledSE : 0;
  const confidence = zScore >= 1.96 ? 0.95 : zScore >= 1.65 ? 0.9 : zScore >= 1.28 ? 0.8 : zScore * 0.5;
  const totalTrials = trialsA + trialsB;
  if (!(confidence >= 0.8 || totalTrials >= test.minTrials * 4)) return test;
  let winnerId: string;
  if (Math.abs(rateA - rateB) < 0.05) {
    const avgA = test.variantATotalDurationMs / test.variantATrials;
    const avgB = test.variantBTotalDurationMs / test.variantBTrials;
    winnerId = avgA <= avgB ? test.variantAId : test.variantBId;
  } else {
    winnerId = rateA > rateB ? test.variantAId : test.variantBId;
  }
  return { ...test, status: 'concluded', winnerId, confidence, concludedAt: new Date().toISOString() };
}

describe('[guard] evaluateTestWithBasis is unchanged for the existing fixtures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  const fixtures: Array<[string, ABTest, JudgeScores | undefined]> = [
    // checklist-judge-fitness.test.ts
    ['4/4 vs 4/1', arms({ trials: 4, wins: 4 }, { trials: 4, wins: 1 }), undefined],
    ['6/6 vs 6/2', arms({ trials: 6, wins: 6 }, { trials: 6, wins: 2 }), undefined],
    ['6/6 vs 6/2 judged', arms({ trials: 6, wins: 6 }, { trials: 6, wins: 2 }), scores(0.1, 10, 0.9, 10)],
    ['3/3 vs 3/3 judged at floor', arms({ trials: 3, wins: 3 }, { trials: 3, wins: 3 }), scores(0.5, 3, 0.5, 3)],
    // prompt-evolution-ab-loop.test.ts (minTrials 5)
    ['3 fail vs 3 pass', arms({ trials: 3, wins: 0, ms: 100 }, { trials: 3, wins: 3, ms: 100 }, 5), undefined],
    ['3/3 vs 3/3 @10ms', arms({ trials: 3, wins: 3, ms: 10 }, { trials: 3, wins: 3, ms: 10 }, 5), undefined],
    // volume gate + duration tie-break
    ['12/6 vs 12/6 slower A', arms({ trials: 12, wins: 6, ms: 900 }, { trials: 12, wins: 6, ms: 300 }), undefined],
    ['5/5 vs 5/0', arms({ trials: 5, wins: 5 }, { trials: 5, wins: 0 }), undefined],
  ];

  for (const [name, test, judged] of fixtures) {
    it(`matches the frozen reference: ${name}`, () => {
      expect(evaluateTestWithBasis(test, judged).test).toEqual(legacyEvaluate(test, judged));
    });
  }
});
