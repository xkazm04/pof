import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ABTestCard } from '@/components/modules/evaluator/PromptEvolutionView/ABTestCard';
import type { ABTest } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => cleanup());

function runningTest(aTrials: number, bTrials: number): ABTest {
  return {
    id: 'ab-1',
    moduleId: 'arpg-combat' as SubModuleId,
    checklistItemId: 'ac-1',
    variantAId: 'va',
    variantBId: 'vb',
    variantATrials: aTrials,
    variantBTrials: bTrials,
    variantASuccesses: aTrials,
    variantBSuccesses: 0,
    variantATotalDurationMs: aTrials * 1000,
    variantBTotalDurationMs: bTrials * 1000,
    minTrials: 5,
    status: 'running',
    winnerId: null,
    confidence: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    concludedAt: null,
  };
}

describe('ABTestCard — decide-now is offered only when the server would accept it', () => {
  it.each(['simple', 'advanced'] as const)(
    'hides Conclude below the per-arm floor and names the shortfall (%s mode)',
    (mode) => {
      render(
        <ABTestCard
          test={runningTest(2, 3)}
          isExpanded
          onToggle={() => {}}
          onConclude={vi.fn()}
          mode={mode}
        />,
      );
      expect(screen.queryByRole('button', { name: /finish & pick a winner/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /conclude test/i })).toBeNull();
      expect(screen.getByTestId('conclude-shortfall').textContent).toMatch(/1 more run of A/);
    },
  );

  it('offers Conclude once both arms clear the floor', () => {
    render(
      <ABTestCard test={runningTest(3, 3)} isExpanded onToggle={() => {}} onConclude={vi.fn()} mode="advanced" />,
    );
    expect(screen.getByRole('button', { name: /conclude test/i })).toBeTruthy();
    expect(screen.queryByTestId('conclude-shortfall')).toBeNull();
  });

  it('shows the basis the verdict rests on', () => {
    render(
      <ABTestCard test={runningTest(3, 3)} isExpanded onToggle={() => {}} onConclude={vi.fn()} mode="simple" />,
    );
    expect(screen.getByTestId('verdict-basis').textContent).toMatch(/self-reported/i);
  });
});

describe('ABTestCard — adopting the winner', () => {
  const winnerVariant = {
    id: 'vb', moduleId: 'arpg-combat' as SubModuleId, checklistItemId: 'ac-1', label: 'B', prompt: 'new',
    origin: 'default' as const, style: 'imperative' as const, parentId: null, active: false, createdAt: '',
  };
  const decided = (): ABTest => ({
    ...runningTest(10, 10), variantBSuccesses: 9, variantASuccesses: 4, status: 'concluded', winnerId: 'vb', confidence: 0.95,
  });

  it('offers Adopt winner when the plan allows it, and Copy wording as a secondary action', () => {
    render(
      <ABTestCard
        test={decided()} variantB={winnerVariant} isExpanded onToggle={() => {}} mode="simple"
        adoption={{ ok: true, data: { winner: winnerVariant, incumbent: null, diff: { before: null, after: 'new', identical: false, lengthDelta: 3 }, contested: false, caution: null } }}
        onAdopt={async () => true}
      />,
    );
    expect(screen.getByRole('button', { name: /adopt winner/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy wording/i })).toBeTruthy();
  });

  it('says why when the winner cannot be adopted', () => {
    render(
      <ABTestCard
        test={decided()} variantB={winnerVariant} isExpanded onToggle={() => {}} mode="simple"
        adoption={{ ok: false, error: { kind: 'already-active', message: 'B is already the version in use.' } }}
      />,
    );
    expect(screen.queryByRole('button', { name: /adopt winner/i })).toBeNull();
    expect(screen.getByTestId('adoption-blocked').textContent).toMatch(/already the version in use/);
  });
});
