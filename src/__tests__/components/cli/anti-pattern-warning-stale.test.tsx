import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// scan-sweep night 2026-11-08 cli-terminal-shell — the debounced anti-pattern check
// applied its reply whenever it arrived. Submitting clears the input (the render
// reset empties the warnings), but the reply for the just-sent prompt then landed
// and painted its warnings over the empty box. A reply for a prompt that is no
// longer in the box must be dropped.

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { AntiPatternWarning } from '@/components/cli/AntiPatternWarning';

const WARNING = {
  antiPattern: { id: 'ap1', title: 'Tick-polling stamina', severity: 'high', approach: 'tick', alternative: null },
  matchScore: 90,
  message: 'Polling stamina in Tick wastes frames',
};

afterEach(() => { cleanup(); vi.useRealTimers(); apiFetch.mockReset(); });

describe('AntiPatternWarning — a stale check reply is dropped', () => {
  it('warnings for a prompt that was already cleared are not shown', async () => {
    vi.useFakeTimers();
    let reply!: (v: unknown) => void;
    apiFetch.mockImplementation(() => new Promise((resolve) => { reply = resolve; }));
    const typed = 'Implement stamina regen polling every Tick in the character';
    const { container, rerender } = render(<AntiPatternWarning prompt={typed} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(apiFetch).toHaveBeenCalledTimes(1);

    rerender(<AntiPatternWarning prompt="" />); // submitted: the input is cleared
    await act(async () => { reply({ warnings: [WARNING] }); await vi.advanceTimersByTimeAsync(10); });

    expect(container.textContent ?? '').not.toContain('Tick-polling stamina');
  });

  it('a reply for the prompt still in the box is shown', async () => {
    vi.useFakeTimers();
    apiFetch.mockResolvedValue({ warnings: [WARNING] });
    const typed = 'Implement stamina regen polling every Tick in the character';
    const { container } = render(<AntiPatternWarning prompt={typed} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(container.textContent ?? '').toContain('Tick-polling stamina');
  });
});
