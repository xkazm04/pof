import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ChecklistUnconfirmedBanner } from '@/components/modules/shared/ChecklistUnconfirmedBanner';
import type { UseChecklistCLIResult } from '@/hooks/useChecklistCLI';

function makeCli(overrides: Partial<UseChecklistCLIResult> = {}): UseChecklistCLIResult {
  return {
    sendPrompt: vi.fn(),
    isRunning: false,
    activeItemId: null,
    unconfirmedItemId: null,
    retryUnconfirmed: vi.fn(),
    dismissUnconfirmed: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('ChecklistUnconfirmedBanner', () => {
  it('renders nothing when there is no unconfirmed item', () => {
    const { container } = render(<ChecklistUnconfirmedBanner cli={makeCli()} />);
    expect(container.firstChild).toBe(null);
  });

  it('names the unconfirmed item and wires Retry + dismiss', () => {
    const cli = makeCli({ unconfirmedItemId: 'anim-locomotion' });
    const { container } = render(<ChecklistUnconfirmedBanner cli={cli} />);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBe(null);
    expect(alert!.textContent).toContain('anim-locomotion');
    expect(alert!.textContent).toContain('not marked done');

    const buttons = Array.from(container.querySelectorAll('button'));
    const retry = buttons.find((b) => b.textContent?.includes('Retry'));
    expect(retry).not.toBe(undefined);
    fireEvent.click(retry!);
    expect(cli.retryUnconfirmed).toHaveBeenCalledTimes(1);

    const dismiss = buttons.find((b) => b.getAttribute('aria-label') === 'Dismiss unconfirmed run');
    expect(dismiss).not.toBe(undefined);
    fireEvent.click(dismiss!);
    expect(cli.dismissUnconfirmed).toHaveBeenCalledTimes(1);
  });
});
