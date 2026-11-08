import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ABTest } from '@/types/prompt-evolution';

const state = vi.hoisted(() => ({ tests: [] as unknown[], variants: [] as unknown[] }));

vi.mock('@/lib/prompt-evolution/evolution-db', async (orig) => {
  const actual = await orig<typeof import('@/lib/prompt-evolution/evolution-db')>();
  return {
    ...actual,
    getAllABTests: () => state.tests,
    getAllVariants: () => state.variants,
  };
});
vi.mock('@/lib/prompt-evolution/judge-fitness', () => ({ getPromptVariantFitness: () => [] }));

import { getEvolutionStats } from '@/lib/prompt-evolution/engine';

function concluded(
  id: string,
  moduleId: string,
  a: { n: number; wins: number },
  b: { n: number; wins: number },
  winnerId: string | null,
): ABTest {
  return {
    id,
    moduleId,
    checklistItemId: 'ci',
    variantAId: `${id}-a`,
    variantBId: `${id}-b`,
    variantATrials: a.n,
    variantASuccesses: a.wins,
    variantBTrials: b.n,
    variantBSuccesses: b.wins,
    variantATotalDurationMs: 0,
    variantBTotalDurationMs: 0,
    minTrials: 5,
    status: 'concluded',
    winnerId,
    confidence: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    concludedAt: '2026-01-02T00:00:00.000Z',
  } as unknown as ABTest;
}

describe('getEvolutionStats avgImprovementRate', () => {
  beforeEach(() => {
    state.tests = [];
    // getEvolutionStats walks modules in first-seen order of variants.
    state.variants = [{ id: 'v1', moduleId: 'arpg-combat' }];
  });

  it('is the per-test winner-minus-loser mean, not a cross-test max subtraction', () => {
    // Test 1: winner 80% vs loser 60% (+20). Test 2: winner 50% vs loser 40% (+10).
    // Old arithmetic: best 0.8 - max-of-lowers 0.6 = +20 for the module.
    state.tests = [
      concluded('t1', 'arpg-combat', { n: 10, wins: 8 }, { n: 10, wins: 6 }, 't1-a'),
      concluded('t2', 'arpg-combat', { n: 10, wins: 4 }, { n: 10, wins: 5 }, 't2-b'),
    ];
    const s = getEvolutionStats();
    expect(s.avgImprovementRate).toBeCloseTo(0.15, 5);
    expect(s.moduleBreakdown[0].improvement).toBeCloseTo(0.15, 5);
  });

  it('ignores a test below the trial floor (3 vs 0 of 3 per arm is not +100%)', () => {
    state.tests = [concluded('t1', 'arpg-combat', { n: 2, wins: 2 }, { n: 2, wins: 0 }, 't1-a')];
    const s = getEvolutionStats();
    expect(s.avgImprovementRate).toBe(0);
    expect(s.moduleBreakdown.every((m) => m.improvement === 0)).toBe(true);
  });

  it('ignores a concluded test with no winner', () => {
    state.tests = [concluded('t1', 'arpg-combat', { n: 20, wins: 10 }, { n: 20, wins: 11 }, null)];
    expect(getEvolutionStats().avgImprovementRate).toBe(0);
  });
});
