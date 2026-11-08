import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, isRunning: false }),
}));

import { AskTab } from '@/components/modules/content/materials/tabs/AskTab';

afterEach(() => {
  cleanup();
  execute.mockReset();
});

/**
 * The Materials Ask box was a placeholder-only text input with `outline-none`:
 * no accessible name (a placeholder is not a label) and no visible focus ring.
 */
describe('Materials AskTab accessibility', () => {
  it('names the question input', () => {
    const { container } = render(<AskTab />);
    const input = container.querySelector('input[type="text"]')!;
    const name = input.getAttribute('aria-label') ?? '';
    expect(name.length).toBeGreaterThan(0);
  });

  it('gives the input and the Send button a focus-visible ring', () => {
    const { container } = render(<AskTab />);
    const input = container.querySelector('input[type="text"]')!;
    const send = container.querySelector('button')!;
    expect(input.className).toMatch(/\bfocus-ring/);
    expect(send.className).toMatch(/\bfocus-ring/);
    expect(send.getAttribute('type')).toBe('button');
  });

  it('still dispatches the trimmed question on Enter', () => {
    const { container } = render(<AskTab />);
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: '  why is my glass black?  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
