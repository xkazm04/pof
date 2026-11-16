import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { CopyButton } from '@/components/modules/core-engine/sub_debug/system/CircularGauge';

/**
 * scan-sweep night 2026-11-08 (debug-performance, error-handler): the copy
 * handler had no rejection path - a denied clipboard permission was an
 * unhandled rejection, and an insecure context (no navigator.clipboard) threw
 * a TypeError out of the click handler. Either way the button said nothing.
 */

afterEach(cleanup);

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

describe('sub_debug CopyButton failure', () => {
  it('a rejected writeText -> the button says COPY FAILED', async () => {
    setClipboard({ writeText: () => Promise.reject(new Error('NotAllowedError')) });
    const { container } = render(<CopyButton text="stat fps" />);
    await act(async () => { fireEvent.click(container.querySelector('button')!); });
    expect(container.querySelector('button')!.textContent).toBe('COPY FAILED');
  });

  it('no clipboard API (insecure context) -> no throw, the button says COPY FAILED', async () => {
    setClipboard(undefined);
    const { container } = render(<CopyButton text="stat fps" />);
    await act(async () => { fireEvent.click(container.querySelector('button')!); });
    expect(container.querySelector('button')!.textContent).toBe('COPY FAILED');
  });
});
