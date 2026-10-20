import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  planAdoption, filterAdoptSuggestions, runAdoption,
} from '@/components/modules/evaluator/PromptEvolutionView/adoption';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { ABTest, EvolutionSuggestion, PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const mod = 'arpg-combat' as SubModuleId;

function variant(id: string, active = false, prompt = `prompt ${id}`): PromptVariant {
  return {
    id, moduleId: mod, checklistItemId: 'ac-1', label: `Label ${id}`, prompt,
    origin: 'default', style: 'imperative', parentId: null, active, createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function test(over: Partial<ABTest> = {}): ABTest {
  return {
    id: 't1', moduleId: mod, checklistItemId: 'ac-1', variantAId: 'va', variantBId: 'vb',
    variantATrials: 10, variantBTrials: 10, variantASuccesses: 5, variantBSuccesses: 8,
    variantATotalDurationMs: 1000, variantBTotalDurationMs: 1000, minTrials: 5,
    status: 'concluded', winnerId: 'vb', confidence: 0.95,
    createdAt: '2026-01-01T00:00:00.000Z', concludedAt: '2026-01-02T00:00:00.000Z', ...over,
  };
}

const variants = [variant('va', true), variant('vb')];

describe('planAdoption', () => {
  it('ok: names winner, incumbent and the diff', () => {
    const r = planAdoption({ test: test(), variants });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.winner.id).toBe('vb');
    expect(r.data.incumbent?.id).toBe('va');
    expect(r.data.diff).toMatchObject({ before: 'prompt va', after: 'prompt vb', identical: false });
    expect(r.data.contested).toBe(false);
  });

  it('already-active when the winner is the served variant', () => {
    const r = planAdoption({ test: test(), variants: [variant('va'), variant('vb', true)] });
    expect(r).toMatchObject({ ok: false, error: { kind: 'already-active' } });
  });

  it('not-concluded / no-winner', () => {
    expect(planAdoption({ test: test({ status: 'running', winnerId: null }), variants }))
      .toMatchObject({ ok: false, error: { kind: 'not-concluded' } });
    expect(planAdoption({ test: test({ winnerId: null }), variants }))
      .toMatchObject({ ok: false, error: { kind: 'no-winner' } });
  });

  it('contested when current evidence favours the loser by >= TIE_MARGIN', () => {
    const r = planAdoption({ test: test({ variantASuccesses: 9, variantBSuccesses: 5 }), variants });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.contested).toBe(true);
    expect(r.data.caution).toMatch(/favours the other/);
  });

  it('superseded by a newer concluded test with a different winner', () => {
    const newer = test({ id: 't2', winnerId: 'va', concludedAt: '2026-02-01T00:00:00.000Z' });
    const r = planAdoption({ test: test(), variants, tests: [test(), newer] });
    expect(r).toMatchObject({ ok: false, error: { kind: 'superseded', testId: 't2' } });
  });

  it('unknown-winner when the winner is not loaded', () => {
    const r = planAdoption({ test: test(), variants: [variant('va', true)] });
    expect(r).toMatchObject({ ok: false, error: { kind: 'unknown-winner' } });
  });
});

describe('runAdoption', () => {
  it('restores the winner once and undo restores the previous id', async () => {
    const plan = planAdoption({ test: test(), variants });
    if (!plan.ok) throw new Error('plan');
    const restore = vi.fn().mockResolvedValue(variant('vb', true));
    const h = await runAdoption(plan.data, restore);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith('vb');
    if (!h.ok) throw new Error('handle');
    expect(h.previousId).toBe('va');
    await h.undo!();
    expect(restore).toHaveBeenLastCalledWith('va');
  });

  it('has no undo when nothing was active before', async () => {
    const plan = planAdoption({ test: test(), variants: [variant('va'), variant('vb')] });
    if (!plan.ok) throw new Error('plan');
    const h = await runAdoption(plan.data, vi.fn().mockResolvedValue(variant('vb', true)));
    expect(h).toMatchObject({ ok: true, previousId: null });
    expect((h as { undo?: unknown }).undo).toBeUndefined();
  });
});

describe('after a real store restore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('flips the loaded variants, so the winner is already-active and its suggestion drops; undo reverses it', async () => {
    usePromptEvolutionStore.setState({ variants: [variant('va', true), variant('vb')], error: null });
    const respond = (v: PromptVariant) => ({ status: 200, json: async () => ({ success: true, data: { ...v, active: true } }) });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond(variant('vb')))
      .mockResolvedValueOnce(respond(variant('va')));
    vi.stubGlobal('fetch', fetchMock);
    const suggestions: EvolutionSuggestion[] = [
      { type: 'adopt-winner', moduleId: mod, checklistItemId: 'ac-1', message: 'm', variantId: 'vb', confidence: 0.9 },
      { type: 'cluster-insight', moduleId: mod, message: 'c', confidence: 0.5 },
    ];
    expect(filterAdoptSuggestions(suggestions, usePromptEvolutionStore.getState().variants)).toHaveLength(2);

    await usePromptEvolutionStore.getState().restoreVariant('vb');
    const after = usePromptEvolutionStore.getState().variants;
    expect(planAdoption({ test: test(), variants: after }))
      .toMatchObject({ ok: false, error: { kind: 'already-active' } });
    expect(filterAdoptSuggestions(suggestions, after).map((s) => s.type)).toEqual(['cluster-insight']);

    await usePromptEvolutionStore.getState().restoreVariant('va');
    const undone = usePromptEvolutionStore.getState().variants;
    expect(planAdoption({ test: test(), variants: undone }).ok).toBe(true);
    expect(filterAdoptSuggestions(suggestions, undone)).toHaveLength(2);
  });
});
