import { describe, it, expect } from 'vitest';
import { planStart } from '@/lib/prompt-evolution/start-plan';
import type { ABTest, PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;

function variant(id: string, prompt: string, over: Partial<PromptVariant> = {}): PromptVariant {
  return {
    id, moduleId: MOD, checklistItemId: 'ac-1', label: id, prompt, origin: 'default', style: 'descriptive',
    parentId: null, active: false, createdAt: '2026-09-01T10:00:00.000Z', ...over,
  };
}

function test(id: string, status: ABTest['status'], item = 'ac-1'): ABTest {
  return {
    id, moduleId: MOD, checklistItemId: item, variantAId: 'x', variantBId: 'y',
    variantATrials: 0, variantBTrials: 0, variantASuccesses: 0, variantBSuccesses: 0,
    variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5, status,
    winnerId: null, confidence: 0, createdAt: '2026-09-01T10:00:00.000Z', concludedAt: null,
  } as ABTest;
}

const V1 = variant('v1', 'Implement a melee attack.', { active: true });
const V2 = variant('v2', 'Implement a melee attack with a combo.');
const OTHER = variant('o1', 'Different item prompt.', { checklistItemId: 'ac-2' });
const variants = [V1, V2, OTHER];

describe('planStart', () => {
  it('refuses the same variant on both arms', () => {
    const r = planStart({ variants, runningTests: [], aId: 'v1', bId: 'v1' });
    expect(r.ok === false && r.error.kind).toBe('same-variant');
  });

  it('refuses variants on different checklist items', () => {
    const r = planStart({ variants, runningTests: [], aId: 'v1', bId: 'o1' });
    expect(r.ok === false && r.error.kind).toBe('cross-item');
  });

  it('refuses identical prompt text', () => {
    const twin = variant('v3', V1.prompt);
    const r = planStart({ variants: [V1, twin], runningTests: [], aId: 'v1', bId: 'v3' });
    expect(r.ok === false && r.error.kind).toBe('identical-prompt');
  });

  it('refuses while a test is running on the item, carrying its id; concluded/cancelled do not block', () => {
    const blocked = planStart({ variants, runningTests: [test('ab-1', 'running')], aId: 'v1', bId: 'v2' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatchObject({ kind: 'test-running', testId: 'ab-1' });
    const free = planStart({
      variants, runningTests: [test('ab-2', 'concluded'), test('ab-3', 'cancelled'), test('ab-4', 'running', 'ac-2')],
      aId: 'v1', bId: 'v2',
    });
    expect(free.ok).toBe(true);
  });

  it('puts the active variant on arm A regardless of argument order', () => {
    const r = planStart({ variants, runningTests: [], aId: 'v2', bId: 'v1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ aId: 'v1', bId: 'v2', checklistItemId: 'ac-1' });
    const keep = planStart({ variants, runningTests: [], aId: 'v1', bId: 'v2' });
    if (keep.ok) expect(keep.data).toMatchObject({ aId: 'v1', bId: 'v2' });
  });
});
