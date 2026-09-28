import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { PromptVersionTimeline } from '@/components/modules/evaluator/PromptVersionTimeline';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { ABTest, PromptVariant, VariantStats, VariantVersionHistory } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;

function variant(over: Partial<PromptVariant>): PromptVariant {
  return {
    id: 'v', moduleId: MOD, checklistItemId: 'ac-1', label: 'v', prompt: '', origin: 'default',
    style: 'descriptive', parentId: null, active: false, createdAt: '2026-06-01T10:00:00.000Z', ...over,
  };
}
const zero = (variantId: string): VariantStats => ({ variantId, trials: 0, successes: 0, successRate: 0, wins: 0, testCount: 0 });

const ROOT = variant({ id: 'v-root', label: 'baseline', active: true, prompt: 'Implement a melee attack.' });
const CHILD = variant({
  id: 'v-child', label: 'verified', origin: 'mutation', parentId: 'v-root', mutationType: 'add-verification',
  prompt: 'Implement a melee attack.\nVerify it compiles.', createdAt: '2026-06-01T11:00:00.000Z',
});

const HISTORY: VariantVersionHistory = {
  moduleId: MOD,
  checklistItemId: 'ac-1',
  versions: [
    { variant: ROOT, stats: zero('v-root'), isActive: true },
    { variant: CHILD, stats: zero('v-child'), isActive: false },
  ],
  roots: [{
    variant: ROOT, stats: zero('v-root'), isActive: true, depth: 0,
    children: [{ variant: CHILD, stats: zero('v-child'), isActive: false, depth: 1, children: [] }],
  }],
  activeVariantId: 'v-root',
};

function setup(abTests: ABTest[] = []) {
  const startChallenge = vi.fn().mockResolvedValue({ ok: true, test: {} });
  usePromptEvolutionStore.setState({
    versionHistory: HISTORY, isLoadingHistory: false, isRestoring: false, abTests,
    variantFitness: [{ variantId: 'v-root', producedArtifacts: 3, judgedArtifacts: 3, verdicts: 3, avgScore: 81, passRate: 1 }],
    selectedChecklistItemId: 'ac-1',
    loadVersionHistory: vi.fn().mockResolvedValue(undefined),
    loadVariantFitness: vi.fn().mockResolvedValue(undefined),
    startChallenge,
  });
  render(<PromptVersionTimeline selectedModuleId={MOD} itemOptions={[{ id: 'ac-1', label: 'ac-1' }]} />);
  return { startChallenge };
}

afterEach(() => { cleanup(); usePromptEvolutionStore.setState({ selectedChecklistItemId: null }); });

describe('PromptVersionTimeline — challenge the current version', () => {
  it('opens a preflight with the current version as A, judge evidence per arm, and starts on confirm', async () => {
    const { startChallenge } = setup();
    expect((screen.getByTestId('challenge-v-root') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('challenge-v-child'));
    expect(screen.getByTestId('challenge-preflight')).toBeTruthy();
    expect(screen.getByTestId('challenge-arm-A').textContent).toContain('baseline');
    expect(screen.getByTestId('challenge-arm-A').textContent).toContain('81 avg');
    expect(screen.getByTestId('challenge-arm-B').textContent).toContain('unjudged');

    fireEvent.click(screen.getByTestId('challenge-start'));
    await waitFor(() => expect(startChallenge).toHaveBeenCalledWith('v-child'));
  });

  it('shows the blocker instead of a start button while a test runs on the item', () => {
    setup([{
      id: 'ab-1', moduleId: MOD, checklistItemId: 'ac-1', variantAId: 'v-root', variantBId: 'v-child',
      variantATrials: 0, variantBTrials: 0, variantASuccesses: 0, variantBSuccesses: 0,
      variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5, status: 'running',
      winnerId: null, confidence: 0, createdAt: '2026-06-02T10:00:00.000Z', concludedAt: null,
    }]);
    fireEvent.click(screen.getByTestId('challenge-v-child'));
    expect(screen.getByTestId('challenge-blocker').getAttribute('data-kind')).toBe('test-running');
    expect(screen.queryByTestId('challenge-start')).toBeNull();
  });
});
