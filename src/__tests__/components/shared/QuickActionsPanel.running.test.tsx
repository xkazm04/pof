/**
 * The Ask Claude box has two ways to send: the Send button and Enter. The button
 * is disabled while a CLI task runs; Enter must honour the same rule, or a second
 * prompt is dispatched into a session that is still busy (and the typed text is
 * cleared as if it had been accepted).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useSessionAnalytics', () => ({
  usePromptSuggestions: () => ({ suggestions: [], fetchSuggestions: () => {} }),
}));

import { QuickActionsPanel } from '@/components/modules/shared/QuickActionsPanel';

afterEach(cleanup);

function renderPanel(isRunning: boolean) {
  const onRunPrompt = vi.fn();
  const view = render(
    <QuickActionsPanel
      actions={[]}
      onRunPrompt={onRunPrompt}
      accentColor="var(--core)"
      isRunning={isRunning}
      moduleLabel="Combat"
      moduleId="arpg-combat"
    />,
  );
  const input = view.container.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'add a dodge roll' } });
  return { onRunPrompt, input };
}

describe('QuickActionsPanel — Enter obeys the running guard', () => {
  it('does not dispatch on Enter while a task is running, and keeps the text', () => {
    const { onRunPrompt, input } = renderPanel(true);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRunPrompt).not.toHaveBeenCalled();
    expect(input.value).toBe('add a dodge roll');
  });

  it('dispatches on Enter when idle', () => {
    const { onRunPrompt, input } = renderPanel(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRunPrompt).toHaveBeenCalledTimes(1);
    expect(onRunPrompt).toHaveBeenCalledWith('add a dodge roll');
    expect(input.value).toBe('');
  });
});

describe('QuickActionsPanel — Enter that commits an IME composition is not a send', () => {
  it('does not dispatch while the input method is composing', () => {
    const { onRunPrompt, input } = renderPanel(false);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onRunPrompt).not.toHaveBeenCalled();
    expect(input.value).toBe('add a dodge roll');
  });
});
