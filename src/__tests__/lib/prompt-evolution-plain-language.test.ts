import { describe, it, expect } from 'vitest';
import {
  explainTestVerdict,
  plainConfidence,
  plainClusterSummary,
  plainSuccessBand,
} from '@/lib/prompt-evolution/plain-language';
import type { ABTest, PromptCluster } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const mid = (s: string): SubModuleId => s as SubModuleId;

function makeTest(over: Partial<ABTest> = {}): ABTest {
  return {
    id: 'ab-1',
    moduleId: mid('arpg-combat'),
    checklistItemId: 'ac-1',
    variantAId: 'va',
    variantBId: 'vb',
    variantATrials: 0,
    variantBTrials: 0,
    variantASuccesses: 0,
    variantBSuccesses: 0,
    variantATotalDurationMs: 0,
    variantBTotalDurationMs: 0,
    minTrials: 5,
    status: 'running',
    winnerId: null,
    confidence: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    concludedAt: null,
    ...over,
  };
}

describe('plainConfidence', () => {
  it('maps confidence bands to plain sentences', () => {
    expect(plainConfidence(0.95)).toMatch(/95%/);
    expect(plainConfidence(0.97)).toMatch(/95%/); // top band clamps to 95
    expect(plainConfidence(0.9)).toMatch(/90%/);
    expect(plainConfidence(0.8)).toMatch(/80%/);
    expect(plainConfidence(0.4)).toMatch(/early lead/i);
    expect(plainConfidence(0)).toMatch(/not enough/i);
  });
});

describe('explainTestVerdict', () => {
  it('reports "no results" when there are zero trials', () => {
    const v = explainTestVerdict(makeTest());
    expect(v.winnerSlot).toBeNull();
    expect(v.concluded).toBe(false);
    expect(v.headline).toMatch(/no results/i);
  });

  it('says it is too early when running with a near-tie', () => {
    const v = explainTestVerdict(
      makeTest({
        variantATrials: 4, variantASuccesses: 2,
        variantBTrials: 4, variantBSuccesses: 2,
      }),
    );
    expect(v.winnerSlot).toBeNull();
    expect(v.headline).toMatch(/too early/i);
    expect(v.why).toMatch(/more times/i);
  });

  it('declares the concluded winner with concrete counts (8 of 10)', () => {
    const v = explainTestVerdict(
      makeTest({
        variantATrials: 10, variantASuccesses: 5,
        variantBTrials: 10, variantBSuccesses: 8,
        status: 'concluded', winnerId: 'vb', confidence: 0.95,
      }),
      'Wording A',
      'Wording B',
    );
    expect(v.winnerSlot).toBe('B');
    expect(v.concluded).toBe(true);
    expect(v.headline).toBe('Wording B wins');
    expect(v.detail).toContain('8 of 10');
    expect(v.detail).toContain('80%');
    expect(v.detail).toContain('50%');
    expect(v.why).toMatch(/more often/i);
    expect(v.confidenceNote).toMatch(/95%/);
  });

  it('explains a tie-broken-by-speed win on the duration data', () => {
    const v = explainTestVerdict(
      makeTest({
        // Equal success rate (6/10 each) → tie on results, A is faster.
        variantATrials: 10, variantASuccesses: 6, variantATotalDurationMs: 10_000,
        variantBTrials: 10, variantBSuccesses: 6, variantBTotalDurationMs: 50_000,
        status: 'concluded', winnerId: 'va', confidence: 0.8,
      }),
      'Quick',
      'Slow',
    );
    expect(v.winnerSlot).toBe('A');
    expect(v.why).toMatch(/faster/i);
  });

  it('falls back to default wording labels when none provided', () => {
    const v = explainTestVerdict(
      makeTest({
        variantATrials: 10, variantASuccesses: 9,
        variantBTrials: 10, variantBSuccesses: 3,
        status: 'concluded', winnerId: 'va', confidence: 0.95,
      }),
    );
    expect(v.headline).toBe('Wording A wins');
  });
});

describe('plainClusterSummary', () => {
  const cluster: PromptCluster = {
    label: 'collision, physics',
    sessionIds: [1, 2, 3],
    successRate: 0.667,
    avgLength: 120,
    keywords: ['collision', 'physics', 'capsule'],
    representative: 'Add collision to the capsule',
  };

  it('summarizes topic, rate and run count in one sentence', () => {
    const s = plainClusterSummary(cluster);
    expect(s).toContain('collision');
    expect(s).toContain('67%');
    expect(s).toContain('3 runs');
  });

  it('uses singular "run" for a single-session cluster', () => {
    expect(plainClusterSummary({ ...cluster, sessionIds: [1] })).toContain('1 run');
  });
});

describe('plainSuccessBand', () => {
  it('bands rates into plain phrases', () => {
    expect(plainSuccessBand(0.8)).toBe('works well');
    expect(plainSuccessBand(0.5)).toBe('mixed results');
    expect(plainSuccessBand(0.2)).toBe('often fails');
  });
});
