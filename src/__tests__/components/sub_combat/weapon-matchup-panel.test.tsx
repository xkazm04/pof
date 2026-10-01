import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MetricsTab } from '@/components/modules/core-engine/sub_combat/metrics/MetricsTab';

// Compare weapons against an enemy (scan-sweep --challenge combat-metrics/B): the
// comparison names its target, reads time-to-kill with its band, and pulls the
// out-of-band weapons into the comparison in one click.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
afterEach(() => cleanup());

describe('WeaponMatchupPanel on the Metrics tab', () => {
  it('target Hollow Knight: band strip, one-click out-of-band compare, selection survives a target switch', () => {
    render(<MetricsTab />);
    const panel = screen.getByTestId('weapon-matchup-panel');

    fireEvent.click(within(panel).getByRole('button', { name: /^Hollow Knight/ }));
    expect(panel.textContent).toContain('vs Hollow Knight');
    const strip = within(panel).getByTestId('matchup-band-strip');
    expect(strip.textContent).toContain('10 long');
    expect(strip.textContent).toContain('1 stall');

    fireEvent.click(within(panel).getByRole('button', { name: /Compare out-of-band/ }));
    expect(panel.textContent).toContain('4/4');
    const rows = Array.from(within(panel).getByTestId('weapon-compare-rows').children);
    expect(rows).toHaveLength(4);
    const staff = rows.find(r => (r.textContent ?? '').includes('Walking Staff'));
    expect(staff).toBeDefined();
    expect(staff!.textContent).toContain('45.8 s');
    expect(within(staff as HTMLElement).getByText('stall')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: /^Forest Grunt/ }));
    expect(panel.textContent).toContain('vs Forest Grunt');
    expect(panel.textContent).toContain('4/4');
    const after = Array.from(within(panel).getByTestId('weapon-compare-rows').children);
    expect(after).toHaveLength(4);
    for (const r of after) expect(within(r as HTMLElement).getByText('healthy')).toBeTruthy();
  });
});
