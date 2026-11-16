import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { toast } from 'sonner';
import { ABTestCard } from '@/components/modules/evaluator/PromptEvolutionView/ABTestCard';
import { VariantCard } from '@/components/modules/evaluator/PromptEvolutionView/VariantCard';
import type { ABTest, PromptVariant } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const b: PromptVariant = {
  id: 'vb', moduleId: 'arpg-combat' as SubModuleId, checklistItemId: 'ac-1', label: 'B', prompt: 'new',
  origin: 'default', style: 'imperative', parentId: null, active: false, createdAt: '2026-01-01T00:00:00.000Z',
};

const decided: ABTest = {
  id: 't', moduleId: 'arpg-combat' as SubModuleId, checklistItemId: 'ac-1', variantAId: 'va', variantBId: 'vb',
  variantATrials: 10, variantBTrials: 10, variantASuccesses: 4, variantBSuccesses: 9,
  variantATotalDurationMs: 1000, variantBTotalDurationMs: 1000, minTrials: 5, status: 'concluded', winnerId: 'vb',
  confidence: 0.95, createdAt: '2026-01-01T00:00:00.000Z', concludedAt: '2026-01-02T00:00:00.000Z',
};

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const variantCard = () => (
  <VariantCard
    variant={b} isExpanded onToggle={() => {}} selectedMutation={'imperative-rewrite'}
    setSelectedMutation={() => {}} onMutate={() => {}} isMutating={false} siblings={[b]} onStartTest={() => {}}
  />
);

describe('prompt-evolution copy actions report what happened', () => {
  it('ABTestCard: a refused clipboard toasts an error', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<ABTestCard test={decided} variantB={b} isExpanded onToggle={() => {}} mode="simple" />);
    fireEvent.click(screen.getByRole('button', { name: /copy wording/i }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('VariantCard: a refused clipboard toasts an error', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(variantCard());
    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('VariantCard: a successful copy confirms', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(variantCard());
    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
