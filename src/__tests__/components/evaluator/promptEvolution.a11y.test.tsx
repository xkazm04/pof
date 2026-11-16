import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { ABTestCard } from '@/components/modules/evaluator/PromptEvolutionView/ABTestCard';
import { VariantCard } from '@/components/modules/evaluator/PromptEvolutionView/VariantCard';
import type { ABTest, PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const v = (id: string, label: string): PromptVariant => ({
  id, moduleId: 'arpg-combat' as SubModuleId, checklistItemId: 'ac-1', label, prompt: 'p',
  origin: 'default', style: 'imperative', parentId: null, active: false, createdAt: '2026-01-01T00:00:00.000Z',
});
const running: ABTest = {
  id: 't', moduleId: 'arpg-combat' as SubModuleId, checklistItemId: 'ac-1', variantAId: 'va', variantBId: 'vb',
  variantATrials: 0, variantBTrials: 0, variantASuccesses: 0, variantBSuccesses: 0,
  variantATotalDurationMs: 0, variantBTotalDurationMs: 0, minTrials: 5, status: 'running', winnerId: null,
  confidence: 0, createdAt: '2026-01-01T00:00:00.000Z', concludedAt: null,
};
const variantCard = (isExpanded: boolean) => (
  <VariantCard
    variant={v('va', 'Alpha')} isExpanded={isExpanded} onToggle={() => {}} selectedMutation={'imperative-rewrite'}
    setSelectedMutation={() => {}} onMutate={() => {}} isMutating={false}
    siblings={[v('va', 'Alpha'), v('vb', 'Beta')]} onStartTest={() => {}}
  />
);

afterEach(() => cleanup());

describe('prompt-evolution disclosure semantics', () => {
  it('ABTestCard toggle exposes its state', () => {
    render(<ABTestCard test={running} isExpanded={false} onToggle={() => {}} mode="simple" />);
    expect(screen.getByRole('button', { name: /ac-1/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('VariantCard toggle exposes its state', () => {
    render(variantCard(true));
    expect(screen.getByRole('button', { name: /Alpha/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('the icon-only A/B start button says what it starts', () => {
    render(variantCard(true));
    expect(screen.getByRole('button', { name: 'Start A/B test against Beta' })).toBeTruthy();
  });
});
