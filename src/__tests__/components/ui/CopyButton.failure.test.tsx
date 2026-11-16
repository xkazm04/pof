import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { CopyButton } from '@/components/ui/CopyButton';
import { UI_TIMEOUTS } from '@/lib/constants';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

async function click(button: Element) {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

describe('CopyButton outcome', () => {
  it('says so when the clipboard write is denied, then returns to idle', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.reject(new Error('denied')));
    const onCopied = vi.fn();
    const { getByRole } = render(<CopyButton text="x" onCopied={onCopied} />);
    const button = getByRole('button');
    await click(button);
    expect(button.getAttribute('aria-label')).toBe('Copy failed');
    expect(onCopied).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.copyFeedback); });
    expect(button.getAttribute('aria-label')).toBe('Copy');
  });

  it('a second click restarts the feedback window', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    const { getByRole } = render(<CopyButton text="x" />);
    const button = getByRole('button');
    await click(button);
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.copyFeedback - 100); });
    await click(button);
    act(() => { vi.advanceTimersByTime(200); });
    expect(button.getAttribute('aria-label')).toBe('Copied!');
  });
});
