import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ── Toast + clipboard stubs ──────────────────────────────────────────────────
const { toastSuccess, toastError, toastInfo } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, info: toastInfo },
}));

// ── Store mock: a selector over a static state object ────────────────────────
const { storeState } = vi.hoisted(() => {
  const mid = (s: string) => s as unknown;
  const baseVariant = {
    moduleId: mid('arpg-combat'),
    checklistItemId: 'ac-1',
    origin: 'default',
    style: 'imperative',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const variantA = { ...baseVariant, id: 'va', label: 'Wording A', prompt: 'Do the thing the plain way.' };
  const variantB = { ...baseVariant, id: 'vb', label: 'Wording B', prompt: 'Do the thing the better way, with detail.' };
  const concludedTest = {
    id: 'ab-1',
    moduleId: mid('arpg-combat'),
    checklistItemId: 'ac-1',
    variantAId: 'va',
    variantBId: 'vb',
    variantATrials: 10,
    variantBTrials: 10,
    variantASuccesses: 5,
    variantBSuccesses: 8,
    variantATotalDurationMs: 50_000,
    variantBTotalDurationMs: 40_000,
    minTrials: 5,
    status: 'concluded',
    winnerId: 'vb',
    confidence: 0.95,
    createdAt: '2026-01-01T00:00:00.000Z',
    concludedAt: '2026-01-02T00:00:00.000Z',
  };
  const stats = {
    totalVariants: 2,
    activeABTests: 0,
    concludedABTests: 1,
    avgImprovementRate: 0,
    topPerformingModule: null,
    moduleBreakdown: [],
  };
  const state: Record<string, unknown> = {
    variants: [variantA, variantB],
    abTests: [concludedTest],
    clusters: [],
    suggestions: [],
    stats,
    selectedModuleId: 'arpg-combat',
    selectedChecklistItemId: null,
    selectedVariantId: null,
    selectedTestId: null,
    lastOptimization: null,
    isOptimizing: false,
    isLoading: false,
    isMutating: false,
    isClustering: false,
    error: null,
    activeSubTab: 'tests',
    init: vi.fn().mockResolvedValue(undefined),
    setSelectedModule: vi.fn(),
    setSelectedChecklistItem: vi.fn(),
    setSelectedVariant: vi.fn(),
    setSelectedTest: vi.fn(),
    setActiveSubTab: vi.fn(),
    loadVariants: vi.fn().mockResolvedValue(undefined),
    createVariant: vi.fn().mockResolvedValue(null),
    mutateVariant: vi.fn().mockResolvedValue(null),
    startABTest: vi.fn().mockResolvedValue(null),
    recordTrial: vi.fn().mockResolvedValue(null),
    concludeTest: vi.fn().mockResolvedValue(null),
    clusterPrompts: vi.fn().mockResolvedValue(undefined),
    loadStats: vi.fn().mockResolvedValue(undefined),
    loadSuggestions: vi.fn().mockResolvedValue(undefined),
    getBestVariant: vi.fn().mockResolvedValue(null),
    optimizePrompt: vi.fn().mockResolvedValue(null),
  };
  return { storeState: state };
});

vi.mock('@/stores/promptEvolutionStore', () => {
  const hook = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  hook.getState = () => storeState;
  return { usePromptEvolutionStore: hook };
});

import { PromptEvolutionView } from '@/components/modules/evaluator/PromptEvolutionView';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => cleanup());

/** Expand the (only) A/B test card so its verdict body renders. */
function expandTestCard() {
  fireEvent.click(screen.getByText('ac-1'));
}

describe('PromptEvolutionView — Simple Mode', () => {
  it('defaults to Simple mode and hides the math-heavy Clusters/Stats tabs', () => {
    render(<PromptEvolutionView />);
    expect(screen.getByRole('button', { name: 'Simple' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Clusters' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stats' })).toBeNull();
  });

  it('shows a plain-language verdict with concrete counts instead of jargon', () => {
    render(<PromptEvolutionView />);
    expandTestCard();
    expect(screen.getByText('Wording B wins')).toBeTruthy();
    // "It succeeded 8 of 10 times (80%), compared with 50% for Wording A."
    expect(screen.getByText(/8 of 10/)).toBeTruthy();
    expect(screen.getByText(/80%/)).toBeTruthy();
    // No raw statistical jargon visible in Simple mode.
    expect(screen.queryByText(/epsilon-greedy/i)).toBeNull();
    expect(screen.queryByText(/z-test/i)).toBeNull();
  });

  it('lets the user adopt the winning wording with one click', async () => {
    render(<PromptEvolutionView />);
    expandTestCard();
    fireEvent.click(screen.getByRole('button', { name: /use this wording/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Do the thing the better way, with detail.');
      expect(toastSuccess).toHaveBeenCalled();
    });
  });
});

describe('PromptEvolutionView — Advanced Mode', () => {
  it('reveals the Clusters/Stats tabs and the statistical explainer when toggled', () => {
    render(<PromptEvolutionView />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    expect(screen.getByRole('button', { name: 'Clusters' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stats' })).toBeTruthy();
    // The jargon now surfaces (as hover-tooltip terms).
    expect(screen.getByText('epsilon-greedy')).toBeTruthy();
    expect(screen.getByText('z-test')).toBeTruthy();
  });

  it('still leads with the plain verdict, then exposes the raw confidence', () => {
    render(<PromptEvolutionView />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expandTestCard();
    expect(screen.getByText('Wording B wins')).toBeTruthy();
    expect(screen.getByText('Confidence')).toBeTruthy();
    // 95% appears both in the plain note and the raw confidence line.
    expect(screen.getAllByText(/95%/).length).toBeGreaterThan(0);
  });
});
