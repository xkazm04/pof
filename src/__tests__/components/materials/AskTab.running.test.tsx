import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, isRunning: true }),
}));

import { AskTab } from '@/components/modules/content/materials/tabs/AskTab';

afterEach(() => {
  cleanup();
  execute.mockReset();
});

/**
 * Every other Materials dispatch surface (Configure, Patterns, Post-Process,
 * Style, Hierarchy) refuses while its session is running; the Ask box sent a
 * second prompt into the busy terminal on Enter or Send.
 */
describe('Materials AskTab while a run is in progress', () => {
  it('does not dispatch on Enter or Send, and keeps the draft', () => {
    const { container } = render(<AskTab />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    const send = container.querySelector('button') as HTMLButtonElement;
    fireEvent.change(input, { target: { value: 'second question' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(send);
    expect(execute).not.toHaveBeenCalled();
    expect(send.disabled).toBe(true);
    expect(input.value).toBe('second question');
  });
});
