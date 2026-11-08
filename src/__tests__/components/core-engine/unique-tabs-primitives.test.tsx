import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { CopyButton, TabHeader, ProgressChip } from '@/components/modules/core-engine/unique-tabs/_shared';
import { STATUS_SUCCESS, ACCENT_CYAN } from '@/lib/chart-colors';
import { Box } from 'lucide-react';

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

/** jsdom serialises inline colours as rgb(); compare against the same conversion. */
function rgbOf(hex: string): string {
  const el = document.createElement('span');
  el.style.color = hex;
  return el.style.color;
}

describe('TabHeader — "complete" means the same thing as ProgressChip', () => {
  it('0 of 0 is not painted as complete (ProgressChip already guards total > 0)', () => {
    const { container } = render(<TabHeader icon={Box} title="T" implemented={0} total={0} accent={ACCENT_CYAN} />);
    const count = container.querySelector('span.font-mono') as HTMLElement;
    expect(count.style.color).toBe(rgbOf(ACCENT_CYAN));
    cleanup();
    const chip = render(<ProgressChip implemented={0} total={0} accent={ACCENT_CYAN} />).container;
    expect((chip.querySelector('span.font-bold') as HTMLElement).style.color).toBe(rgbOf(ACCENT_CYAN));
  });

  it('[control] 3 of 3 is complete in both', () => {
    const { container } = render(<TabHeader icon={Box} title="T" implemented={3} total={3} accent={ACCENT_CYAN} />);
    expect((container.querySelector('span.font-mono') as HTMLElement).style.color).toBe(rgbOf(STATUS_SUCCESS));
  });
});
