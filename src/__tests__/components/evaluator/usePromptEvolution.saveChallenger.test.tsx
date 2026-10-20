import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from 'sonner';
import { usePromptEvolution } from '@/components/modules/evaluator/PromptEvolutionView/usePromptEvolution';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import { getModuleChecklist } from '@/lib/module-registry';
import type { SubModuleId } from '@/types/modules';

/**
 * The Optimizer's one-click challenger: seed the baseline, save the challenger,
 * start the A/B. With the server now refusing a second running test per item, the
 * refusal reason comes back inline and never becomes the view-wide error banner.
 */

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = getModuleChecklist(MOD)[0];
const REFUSAL = 'A/B test ab-old is already running on this item — conclude it before starting another.';

type Body = { action: string; [k: string]: unknown };

interface StubData { variants?: unknown[]; tests?: unknown[]; seedPrompt?: string }

function stubServer(refuseStart: boolean, opts: StubData = {}) {
  const calls: Body[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Body;
    calls.push(body);
    const variant = (id: string) => ({
      id, moduleId: MOD, checklistItemId: ITEM.id, label: id, prompt: id === 'v-base' ? (opts.seedPrompt ?? 'p') : 'p', origin: 'default',
      style: 'descriptive', parentId: null, active: id === 'v-base', createdAt: '2026-09-01T10:00:00.000Z',
    });
    if (body.action === 'start-ab-test' && refuseStart) {
      return { status: 409, json: async () => ({ success: false, error: REFUSAL }) };
    }
    const data = (() => {
      switch (body.action) {
        case 'get-stats': return {
          totalVariants: 0, activeABTests: 0, concludedABTests: 0, avgImprovementRate: 0,
          topPerformingModule: null, moduleBreakdown: [],
        };
        case 'get-tests': return opts.tests ?? [];
        case 'get-variants': return opts.variants ?? [];
        case 'get-prompt-fitness': case 'get-variant-fitness': case 'get-suggestions': return [];
        case 'seed-baseline-variant': return { variant: variant('v-base'), seeded: true };
        case 'create-variant': return variant('v-new');
        case 'start-ab-test': return {
          id: 'ab-new', moduleId: MOD, checklistItemId: ITEM.id, variantAId: body.variantId, variantBId: body.testId,
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

describe('usePromptEvolution.handleSaveChallenger', () => {
  beforeEach(() => usePromptEvolutionStore.setState({ selectedModuleId: MOD, error: null, abTests: [], variants: [] }));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('[guard] seeds the baseline, creates the challenger and starts the A/B test (baseline = arm A)', async () => {
    const calls = stubServer(false);
    const { result } = renderHook(() => usePromptEvolution());
    let outcome: { ok: boolean; message: string } | undefined;
    await act(async () => { outcome = await result.current.handleSaveChallenger(ITEM.id, 'An optimized prompt text.'); });

    expect(outcome?.ok).toBe(true);
    const actions = calls.map((c) => c.action);
    expect(actions).toEqual(expect.arrayContaining(['seed-baseline-variant', 'create-variant', 'start-ab-test']));
    expect(calls.find((c) => c.action === 'start-ab-test')).toMatchObject({ variantId: 'v-base', testId: 'v-new' });
  });

  it('surfaces a 409 refusal inline and keeps the view-wide error clear', async () => {
    stubServer(true);
    const { result } = renderHook(() => usePromptEvolution());
    let outcome: { ok: boolean; message: string } | undefined;
    await act(async () => { outcome = await result.current.handleSaveChallenger(ITEM.id, 'An optimized prompt text.'); });

    expect(outcome).toEqual({ ok: false, message: REFUSAL });
    expect(usePromptEvolutionStore.getState().error).toBeNull();
  });

  it('does not save a challenger when the item already has a running test', async () => {
    const calls = stubServer(false, { tests: [runningTest()] });
    usePromptEvolutionStore.setState({ abTests: [runningTest() as never] });
    const { result } = renderHook(() => usePromptEvolution());
    let outcome: { ok: boolean; message: string } | undefined;
    await act(async () => { outcome = await result.current.handleSaveChallenger(ITEM.id, 'An optimized prompt text.'); });

    expect(outcome?.ok).toBe(false);
    expect(calls.filter((c) => c.action === 'create-variant')).toHaveLength(0);
    expect(calls.filter((c) => c.action === 'start-ab-test')).toHaveLength(0);
  });

  it('does not save a challenger identical to the baseline', async () => {
    const calls = stubServer(false, { seedPrompt: 'Same text.' });
    const { result } = renderHook(() => usePromptEvolution());
    let outcome: { ok: boolean; message: string } | undefined;
    await act(async () => { outcome = await result.current.handleSaveChallenger(ITEM.id, 'Same text.'); });

    expect(outcome?.ok).toBe(false);
    expect(calls.filter((c) => c.action === 'create-variant')).toHaveLength(0);
  });
});

describe('usePromptEvolution.handleStartTest', () => {
  beforeEach(() => { vi.clearAllMocks(); usePromptEvolutionStore.setState({ selectedModuleId: MOD, error: null, abTests: [], variants: [] }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('sends nothing and toasts the reason when a test is already running on the item', async () => {
    const mk = (id: string, prompt: string, active: boolean) => ({
      id, moduleId: MOD, checklistItemId: ITEM.id, label: id, prompt, origin: 'default',
      style: 'descriptive', parentId: null, active, createdAt: '2026-09-01T10:00:00.000Z',
    });
    const calls = stubServer(false, { variants: [mk('a', 'one', true), mk('b', 'two', false)], tests: [runningTest()] });
    const { result } = renderHook(() => usePromptEvolution());
    await waitFor(() => expect(result.current.variants).toHaveLength(2));
    await waitFor(() => expect(result.current.abTests).toHaveLength(1));
    await act(async () => { await result.current.handleStartTest('b', 'a'); });

    expect(calls.filter((c) => c.action === 'start-ab-test')).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

function runningTest() {
  return {
    id: 'ab-old', moduleId: MOD, checklistItemId: ITEM.id, variantAId: 'x', variantBId: 'y',
    variantATrials: 0, variantBTrials: 0, variantASuccesses: 0, variantBSuccesses: 0,
    variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5, status: 'running',
    winnerId: null, confidence: 0, createdAt: '2026-09-05T10:00:00.000Z', concludedAt: null,
  };
}
