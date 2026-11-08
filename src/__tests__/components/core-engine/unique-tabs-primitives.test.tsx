import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CopyButton } from '@/components/modules/core-engine/unique-tabs/_shared';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

/**
 * Shared unique-tabs primitives (scan-sweep night 2026-11-08, core-engine-genre-tabs).
 * Each block pins one pair: a rule a sibling primitive already honours, now honoured here.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('CopyButton — the receipt follows the verified write (lib/clipboard contract)', () => {
  it('a rejected clipboard write never shows "Copied" and raises no unhandled rejection', async () => {
    stubClipboard(() => Promise.reject(new Error('NotAllowedError')));
    render(<CopyButton getText={() => 'abc'} accent={STATUS_SUCCESS} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    expect(screen.getByRole('button').textContent).toBe('Copy');
  });

  it('a successful write shows "Copied"', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<CopyButton getText={() => 'abc'} accent={STATUS_SUCCESS} />);
    await act(async () => { fireEvent.click(screen.getByRole('button')); });
    expect(writeText).toHaveBeenCalledWith('abc');
    expect(screen.getByRole('button').textContent).toBe('Copied');
  });
});
