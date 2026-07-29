import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OptimizerPanel } from '@/components/modules/evaluator/PromptEvolutionView/OptimizerPanel';
import type { PromptOptimizationResult } from '@/types/prompt-evolution';

/**
 * The optimizer's rewrite used to be display-only — a diff with no way to run it.
 * These assert the "save as challenger" seam: it hands the OPTIMIZED text and the
 * chosen checklist item to the caller, which seeds the baseline + starts the test.
 */

const OPTIMIZED: PromptOptimizationResult = {
  original: 'Implement melee hit detection.',
  optimized: 'Implement melee hit detection. Verify the build compiles afterwards.',
  diffs: [{ type: 'add-verification', description: 'Added a build check', reason: 'Runs that verify succeed more often' }],
  predictedImprovement: 0.12,
  sampleSize: 8,
  wasModified: true,
};

const ITEMS = [{ id: 'ac-1', label: 'Melee hit detection' }];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof OptimizerPanel>> = {}) {
  const onSaveChallenger = vi.fn(async () => ({ ok: true, message: 'A/B test running.' }));
  render(
    <OptimizerPanel
      selectedModuleId="arpg-combat"
      lastOptimization={OPTIMIZED}
      isOptimizing={false}
      onOptimize={vi.fn(async () => null)}
      checklistItems={ITEMS}
      onSaveChallenger={onSaveChallenger}
      {...overrides}
    />,
  );
  return { onSaveChallenger };
}

describe('OptimizerPanel — save as challenger', () => {
  it('offers the challenger affordance once a rewrite exists', () => {
    renderPanel();
    expect(screen.getByTestId('save-challenger')).toBeTruthy();
    expect(screen.getByTestId('save-challenger-run').hasAttribute('disabled')).toBe(true);
  });

  it('dispatches the OPTIMIZED prompt against the chosen checklist item', async () => {
    const { onSaveChallenger } = renderPanel();

    fireEvent.change(screen.getByTestId('challenger-item-select'), { target: { value: 'ac-1' } });
    fireEvent.click(screen.getByTestId('save-challenger-run'));

    await waitFor(() => expect(onSaveChallenger).toHaveBeenCalledTimes(1));
    expect(onSaveChallenger).toHaveBeenCalledWith('ac-1', OPTIMIZED.optimized);
    await waitFor(() =>
      expect(screen.getByTestId('save-challenger-result').textContent).toContain('A/B test running.'),
    );
  });

  it('surfaces the failure reason instead of a silent no-op', async () => {
    const onSaveChallenger = vi.fn(async () => ({ ok: false, message: 'Could not establish a baseline version.' }));
    renderPanel({ onSaveChallenger });

    fireEvent.change(screen.getByTestId('challenger-item-select'), { target: { value: 'ac-1' } });
    fireEvent.click(screen.getByTestId('save-challenger-run'));

    await waitFor(() =>
      expect(screen.getByTestId('save-challenger-result').textContent).toContain('Could not establish a baseline'),
    );
  });

  it('hides the affordance when the optimizer changed nothing', () => {
    renderPanel({ lastOptimization: { ...OPTIMIZED, wasModified: false, diffs: [] } });
    expect(screen.queryByTestId('save-challenger')).toBeNull();
  });
});
