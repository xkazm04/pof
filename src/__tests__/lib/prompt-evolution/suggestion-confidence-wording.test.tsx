import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ABTest, EvolutionSuggestion } from '@/types/prompt-evolution';

const state = vi.hoisted(() => ({ tests: [] as unknown[] }));

vi.mock('@/lib/prompt-evolution/evolution-db', async (orig) => {
  const actual = await orig<typeof import('@/lib/prompt-evolution/evolution-db')>();
  return {
    ...actual,
    getAllABTests: () => state.tests,
    getAllVariants: () => [],
    getVariantsForModule: () => [],
    getVariantById: (id: string) => ({ id, label: 'Wording B', moduleId: 'arpg-combat' }),
  };
});
vi.mock('@/lib/prompt-evolution/judge-fitness', () => ({ getPromptVariantFitness: () => [] }));

import { generateSuggestions } from '@/lib/prompt-evolution/engine';
import { SuggestionsBar } from '@/components/modules/evaluator/PromptEvolutionView/SuggestionsBar';

function concludedAt(confidence: number): ABTest {
  return {
    id: 't1', moduleId: 'arpg-combat', checklistItemId: 'ci',
    variantAId: 'va', variantBId: 'vb',
    variantATrials: 7, variantBTrials: 7, variantASuccesses: 3, variantBSuccesses: 5,
    variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5,
    status: 'concluded', winnerId: 'vb', confidence,
    createdAt: '2026-01-01T00:00:00.000Z', concludedAt: '2026-01-02T00:00:00.000Z',
  } as unknown as ABTest;
}

afterEach(() => cleanup());

describe('adopt-winner suggestion wording', () => {
  beforeEach(() => { state.tests = []; });

  it('does not call a 0.7 decide-now score a confidence', () => {
    state.tests = [concludedAt(0.7)];
    const s = generateSuggestions('arpg-combat', []).find((x) => x.type === 'adopt-winner');
    expect(s).toBeDefined();
    expect(s!.message).not.toMatch(/70%/);
    expect(s!.message).toMatch(/weakest confidence band/);
  });

  it('keeps the confidence wording at or above the weak band', () => {
    state.tests = [concludedAt(0.9)];
    const s = generateSuggestions('arpg-combat', []).find((x) => x.type === 'adopt-winner');
    expect(s!.message).toMatch(/won with 90% confidence/);
  });
});

describe('SuggestionsBar confidence badge', () => {
  const sug = (confidence: number): EvolutionSuggestion => ({
    type: 'adopt-winner', moduleId: 'arpg-combat' as EvolutionSuggestion['moduleId'],
    checklistItemId: 'ci', message: 'm', variantId: 'vb', confidence,
  });
  const renderBar = (c: number) => render(
    <SuggestionsBar
      suggestions={[sug(c)]}
      onMutate={async () => null}
      onCluster={async () => {}}
      onAdoptWinner={async () => {}}
      onNavigateVariants={() => {}}
      onNavigateClusters={() => {}}
    />,
  );

  it('hides the badge below 0.8', () => {
    const { container } = renderBar(0.7);
    expect(container.querySelector('[title^="Confidence:"]')).toBeNull();
  });

  it('shows the badge at 0.9', () => {
    const { container } = renderBar(0.9);
    expect(container.querySelector('[title="Confidence: 90%"]')).not.toBeNull();
  });
});
