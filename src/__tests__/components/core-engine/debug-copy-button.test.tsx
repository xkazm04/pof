import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { CopyButton } from '@/components/modules/core-engine/sub_debug/system/CircularGauge';

/**
 * scan-sweep night 2026-11-08 (debug-performance, copy-auditor): the Debug tab's
 * CopyButton only writes to the clipboard, yet it was labelled "EXEC" - next to
 * the console's real EXEC button, which sends the command to UE5. A label that
 * promises execution for a copy is a claim the button does not keep.
 */

afterEach(cleanup);

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('sub_debug CopyButton', () => {
  it('says COPY (never EXEC) and names what it copies', () => {
    stubClipboard(async () => {});
    const { container } = render(<CopyButton text="stat fps" />);
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('COPY');
    expect(btn.getAttribute('aria-label')).toBe('Copy "stat fps" to clipboard');
  });

  it('control: after a successful copy it says COPIED', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    const { container } = render(<CopyButton text="stat fps" />);
    await act(async () => { fireEvent.click(container.querySelector('button')!); });
    expect(writeText).toHaveBeenCalledWith('stat fps');
    expect(container.querySelector('button')!.textContent).toBe('COPIED');
  });
});
