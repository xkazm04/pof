import { describe, it, expect } from 'vitest';
import { planChallenge } from '@/lib/prompt-evolution/challenge';
import type {
  ABTest, PromptVariant, VariantLineageNode, VariantStats, VariantVersionHistory, MutationType,
} from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

/**
 * Challenging the current prompt from History: the incumbent is the adopted
 * version (never "whichever card was clicked first"), a second running test on
 * the item is refused before it is sent, and an arm the judges never scored reads
 * as unjudged (null), never as a 0 score.
 */

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

function variant(id: string, prompt: string, over: Partial<PromptVariant> = {}): PromptVariant {
  return {
    id, moduleId: MOD, checklistItemId: ITEM, label: `${id} label`, prompt,
    origin: 'default', style: 'descriptive', parentId: null, active: false,
    createdAt: '2026-09-01T10:00:00.000Z', ...over,
  };
}

function stats(variantId: string, trials = 0, successes = 0): VariantStats {
  return { variantId, trials, successes, successRate: trials ? successes / trials : 0, wins: 0, testCount: trials ? 1 : 0 };
}

const V1 = variant('v1', 'Implement a melee attack.', { active: true, origin: 'seeded' });
const V2 = variant('v2', 'Implement a melee attack with a combo window.', {
  origin: 'mutation', parentId: 'v1', mutationType: 'add-context' as MutationType, createdAt: '2026-09-02T10:00:00.000Z',
});
const V3 = variant('v3', 'Implement a melee attack with a combo window.\nVerify it compiles and the combo test passes.', {
  origin: 'mutation', parentId: 'v2', mutationType: 'add-verification' as MutationType, createdAt: '2026-09-03T10:00:00.000Z',
});

function history(): VariantVersionHistory {
  const s1 = stats('v1', 4, 3);
  const s2 = stats('v2');
  const s3 = stats('v3');
  const n3: VariantLineageNode = { variant: V3, stats: s3, isActive: false, depth: 2, children: [] };
  const n2: VariantLineageNode = { variant: V2, stats: s2, isActive: false, depth: 1, children: [n3] };
  const n1: VariantLineageNode = { variant: V1, stats: s1, isActive: true, depth: 0, children: [n2] };
  return {
    moduleId: MOD,
    checklistItemId: ITEM,
    versions: [
      { variant: V1, stats: s1, isActive: true },
      { variant: V2, stats: s2, isActive: false },
      { variant: V3, stats: s3, isActive: false },
    ],
    roots: [n1],
    activeVariantId: 'v1',
  };
}

function runningTest(over: Partial<ABTest> = {}): ABTest {
  return {
    id: 'ab-1', moduleId: MOD, checklistItemId: ITEM, variantAId: 'v1', variantBId: 'v2',
    variantATrials: 1, variantBTrials: 1, variantASuccesses: 1, variantBSuccesses: 0,
    variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5,
    status: 'running', winnerId: null, confidence: 0,
    createdAt: '2026-09-04T10:00:00.000Z', concludedAt: null, ...over,
  };
}

describe('planChallenge', () => {
  it('plans the active version (A) against the picked version (B), naming the mutation and the diff', () => {
    const plan = planChallenge({ history: history(), candidateId: 'v3', runningTests: [], fitness: [] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.data).toMatchObject({ incumbentId: 'v1', challengerId: 'v3', mutationType: 'add-verification' });
    expect(plan.data.diff.added).toBeGreaterThan(0);
  });

  it('refuses to challenge the current version with itself', () => {
    const plan = planChallenge({ history: history(), candidateId: 'v1', runningTests: [], fitness: [] });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toMatchObject({ kind: 'already-current' });
  });

  it('refuses while a test is already running on the same module + item, and names it', () => {
    const plan = planChallenge({
      history: history(), candidateId: 'v3', runningTests: [runningTest()], fitness: [],
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.error).toMatchObject({ kind: 'test-running', testId: 'ab-1' });
  });

  it('reads judge evidence per arm, and an unjudged arm is null — never 0', () => {
    const plan = planChallenge({
      history: history(), candidateId: 'v3', runningTests: [],
      fitness: [{ variantId: 'v1', producedArtifacts: 5, judgedArtifacts: 4, verdicts: 4, avgScore: 72, passRate: 0.75 }],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.data.evidence.incumbent.avgScore).toBe(72);
    expect(plan.data.evidence.challenger.avgScore).toBeNull();
    expect(plan.data.evidence.challenger.verdicts).toBe(0);
  });
});
