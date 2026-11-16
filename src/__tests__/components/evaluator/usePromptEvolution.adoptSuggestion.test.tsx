import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from 'sonner';
import { usePromptEvolution } from '@/components/modules/evaluator/PromptEvolutionView/usePromptEvolution';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { ABTest, PromptOptimizationResult, PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;

const variant = (id: string, active = false): PromptVariant => ({
  id, moduleId: MOD, checklistItemId: 'ac-1', label: id, prompt: `prompt ${id}`,
  origin: 'default', style: 'imperative', parentId: null, active, createdAt: '2026-01-01T00:00:00.000Z',
});

const decided = (over: Partial<ABTest>): ABTest => ({
  id: 't1', moduleId: MOD, checklistItemId: 'ac-1', variantAId: 'va', variantBId: 'vb',
  variantATrials: 10, variantBTrials: 10, variantASuccesses: 1, variantBSuccesses: 9,
  variantATotalDurationMs: 1000, variantBTotalDurationMs: 1000, minTrials: 5, status: 'concluded', winnerId: 'vb',
  confidence: 0.95, createdAt: '2026-01-01T00:00:00.000Z', concludedAt: '2026-01-02T00:00:00.000Z', ...over,
});

const initial = usePromptEvolutionStore.getState();
const restoreVariant = vi.fn(async (id: string) => variant(id, true));

function seed(test: ABTest) {
  usePromptEvolutionStore.setState({
    variants: [variant('va', true), variant('vb')],
    abTests: [test],
    activeSubTab: 'variants',
    init: vi.fn(async () => {}),
    loadVariants: vi.fn(async () => {}),
    loadSuggestions: vi.fn(async () => {}),
    getBestVariant: vi.fn(async () => variant('vb')),
    restoreVariant,
  } as never);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  usePromptEvolutionStore.setState(initial, true);
});

describe('usePromptEvolution — the suggestion path obeys the adoption rules', () => {
  it('adopts a well-evidenced winner in one click', async () => {
    seed(decided({}));
    const { result } = renderHook(() => usePromptEvolution());
    await act(async () => { await result.current.adoptBestForItem(MOD, 'ac-1'); });
    expect(restoreVariant).toHaveBeenCalledWith('vb');
  });

  it('sends a cautioned winner to its test card instead of adopting it', async () => {
    seed(decided({ variantASuccesses: 5, variantBSuccesses: 6, confidence: 0.2 }));
    const { result } = renderHook(() => usePromptEvolution());
    await act(async () => { await result.current.adoptBestForItem(MOD, 'ac-1'); });
    expect(restoreVariant).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(usePromptEvolutionStore.getState().activeSubTab).toBe('tests');
    expect(result.current.expandedTestId).toBe('t1');
  });
});

describe('usePromptEvolution — a rewrite belongs to the module it was optimized in', () => {
  it('clears the last optimization when the module changes', () => {
    seed(decided({}));
    usePromptEvolutionStore.setState({ lastOptimization: { optimized: 'x' } as PromptOptimizationResult });
    const { result } = renderHook(() => usePromptEvolution());
    act(() => { result.current.handleSelectModule('arpg-loot' as SubModuleId); });
    expect(usePromptEvolutionStore.getState().lastOptimization).toBeNull();
  });
});
