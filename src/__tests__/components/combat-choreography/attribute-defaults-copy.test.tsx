import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { AttributeDefaultsTab } from '@/components/modules/core-engine/sub_combat/attributes/AttributeDefaultsTab';

const realClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  cleanup();
  if (realClipboard) Object.defineProperty(navigator, 'clipboard', realClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

async function clickCopy(container: HTMLElement) {
  const btn = [...container.querySelectorAll('button')].find((b) => /copy/i.test(b.textContent ?? ''))!;
  await act(async () => { fireEvent.click(btn); });
  return btn;
}

describe('AttributeDefaultsTab copy affordance', () => {
  it('does not claim "Copied" when the clipboard write is rejected', async () => {
    stubClipboard(vi.fn(() => Promise.reject(new Error('denied'))));
    const { container } = render(<AttributeDefaultsTab />);
    const btn = await clickCopy(container);
    expect(btn.textContent).not.toMatch(/^Copied$/);
    expect(btn.textContent).toMatch(/failed/i);
  });

  it('says "Copied" only after a write that landed', async () => {
    const write = vi.fn(() => Promise.resolve());
    stubClipboard(write);
    const { container } = render(<AttributeDefaultsTab />);
    const btn = await clickCopy(container);
    expect(write).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toBe('Copied');
  });
});
