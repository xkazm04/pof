import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { PromptVariant, VariantVersionHistory, PromptVariantFitness } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

/**
 * Challenge from History: the incumbent (the active version) is ALWAYS arm A and
 * the picked version arm B — the order no longer depends on which card was
 * clicked. The per-variant judge fitness route finally has a client reader.
 */

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

function variant(id: string, prompt: string, over: Partial<PromptVariant> = {}): PromptVariant {
  return {
    id, moduleId: MOD, checklistItemId: ITEM, label: id, prompt, origin: 'default',
    style: 'descriptive', parentId: null, active: false, createdAt: '2026-09-01T10:00:00.000Z', ...over,
  };
}

const V1 = variant('v1', 'Implement a melee attack.', { active: true });
const V3 = variant('v3', 'Implement a melee attack.\nVerify it compiles.', {
  origin: 'mutation', parentId: 'v1', mutationType: 'add-verification',
});
const zero = (id: string) => ({ variantId: id, trials: 0, successes: 0, successRate: 0, wins: 0, testCount: 0 });

const HISTORY: VariantVersionHistory = {
  moduleId: MOD,
  checklistItemId: ITEM,
  versions: [
    { variant: V1, stats: zero('v1'), isActive: true },
    { variant: V3, stats: zero('v3'), isActive: false },
  ],
  roots: [{
    variant: V1, stats: zero('v1'), isActive: true, depth: 0,
    children: [{ variant: V3, stats: zero('v3'), isActive: false, depth: 1, children: [] }],
  }],
  activeVariantId: 'v1',
};

const FITNESS: PromptVariantFitness[] = [
  { variantId: 'v1', producedArtifacts: 5, judgedArtifacts: 4, verdicts: 4, avgScore: 72, passRate: 0.75 },
];

type Body = { action: string; [k: string]: unknown };

function stubServer() {
  const calls: Body[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    calls.push(body);
    const data = (() => {
      switch (body.action) {
        case 'get-version-history': return HISTORY;
        case 'get-variant-fitness': return FITNESS;
        case 'start-ab-test': return {
          id: 'ab-new', moduleId: MOD, checklistItemId: ITEM, variantAId: body.variantId, variantBId: body.testId,
          variantATrials: 0, variantBTrials: 0, variantASuccesses: 0, variantBSuccesses: 0,
          variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5, status: 'running',
          winnerId: null, confidence: 0, createdAt: '2026-09-05T10:00:00.000Z', concludedAt: null,
        };
        default: return null;
      }
    })();
    return { status: 200, json: async () => ({ success: true, data }) };
  }));
  return calls;
}

describe('promptEvolutionStore challenge', () => {
  beforeEach(() => usePromptEvolutionStore.setState({ error: null, abTests: [], versionHistory: null }));
  afterEach(() => vi.unstubAllGlobals());

  it('startChallenge puts the incumbent in arm A and the picked version in arm B, then appends the test', async () => {
    const calls = stubServer();
    await usePromptEvolutionStore.getState().loadVersionHistory(MOD, ITEM);
    const outcome = await usePromptEvolutionStore.getState().startChallenge('v3');

    const start = calls.find((c) => c.action === 'start-ab-test');
    expect(start).toMatchObject({ moduleId: MOD, checklistItemId: ITEM, variantId: 'v1', testId: 'v3' });
    expect(outcome.ok).toBe(true);
    expect(usePromptEvolutionStore.getState().abTests.map((t) => t.id)).toContain('ab-new');
  });

  it('loadVariantFitness reads get-variant-fitness into variantFitness', async () => {
    const calls = stubServer();
    await usePromptEvolutionStore.getState().loadVariantFitness();
    expect(calls.map((c) => c.action)).toContain('get-variant-fitness');
    expect(usePromptEvolutionStore.getState().variantFitness).toEqual(FITNESS);
  });
});
