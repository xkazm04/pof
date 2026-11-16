import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MetricsTab } from '@/components/modules/core-engine/sub_combat/metrics/MetricsTab';
import {
  COMBO_SEQUENCES, WEAPON_ROSTER, comboDerivedDps,
} from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// One DPS meaning per surface (scan-sweep 2026-11-08, combat-metrics): Related Combos
// sit beside weapon DPS, so they read the weapon-DPS law, not the authored 190-350 score.

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

/** Authored scores ran 8.0x-13.0x their category best; derived ones stay near 1x. */
const MAX_RATIO = 2.5;

describe('combo DPS shares the weapon-DPS scale', () => {
  it('no combo exceeds MAX_RATIO x the best weapon of its category', () => {
    const over = COMBO_SEQUENCES.flatMap((c) => {
      const max = WEAPON_ROSTER.groups.find((g) => g.category === c.weaponCategory)!.maxDps;
      const ratio = comboDerivedDps(c) / max;
      return ratio > MAX_RATIO ? [`${c.id} x${ratio.toFixed(2)}`] : [];
    });
    expect(over).toEqual([]);
  });

  it('Related Combos prints the derived value, not the authored one', () => {
    render(<MetricsTab />);
    const panel = screen.getByTestId('weapon-matchup-panel');
    fireEvent.click(within(panel).getByRole('button', { name: /^Mounted Lance/ }));
    fireEvent.click(within(panel).getByRole('button', { name: /^Halberd/ }));
    const lance = COMBO_SEQUENCES.find((c) => c.id === 'cb-pl-charge')!;
    const row = Array.from(panel.querySelectorAll('div')).find(
      (d) => d.children.length >= 4 && (d.textContent ?? '').startsWith('Lance Charge'),
    );
    expect(row).toBeDefined();
    expect(row!.textContent).toContain(`${comboDerivedDps(lance).toFixed(1)} DPS`);
    expect(row!.textContent).not.toContain(`${lance.dps} DPS`);
    expect(panel.textContent).toContain('derived DPS');
  });
});
