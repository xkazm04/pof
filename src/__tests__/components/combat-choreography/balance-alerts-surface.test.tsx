import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { BalanceAlertsPanel } from '@/components/modules/core-engine/sub_combat/choreography/BalanceAlertsPanel';
import type { BalanceAlert } from '@/components/modules/core-engine/sub_combat/choreography/types';

const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

const alert = (kind: string, severity: BalanceAlert['severity'], timeSec: number): BalanceAlert =>
  ({ kind, severity, message: `${kind} message`, timeSec }) as BalanceAlert;

describe('BalanceAlertsPanel surfaces a newly critical finding', () => {
  it('an equal-count swap that adds a critical scrolls it into view once', async () => {
    const before = [alert('spongy-enemy', 'warning', 3), alert('flat-pacing', 'info', 5)];
    const after = [alert('player-death', 'critical', 8), alert('flat-pacing', 'info', 5)];
    const { rerender } = render(<BalanceAlertsPanel alerts={before} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(<BalanceAlertsPanel alerts={after} />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  });

  it('re-rendering the same critical set does not re-fire', async () => {
    const list = [alert('player-death', 'critical', 8)];
    const { rerender } = render(<BalanceAlertsPanel alerts={list} />);
    rerender(<BalanceAlertsPanel alerts={[...list]} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('rows are keyed by finding identity, not position', () => {
    const a = alert('spongy-enemy', 'warning', 3);
    const b = alert('player-death', 'critical', 8);
    const { container, rerender } = render(<BalanceAlertsPanel alerts={[a, b]} />);
    const node = [...container.querySelectorAll('span')].find((s) => s.textContent === 'player-death message')!.closest('div')!;
    rerender(<BalanceAlertsPanel alerts={[b, a]} />);
    const after = [...container.querySelectorAll('span')].find((s) => s.textContent === 'player-death message')!.closest('div')!;
    expect(after).toBe(node);
  });
});
