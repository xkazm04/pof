import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ComboChainBuilder } from '@/components/modules/core-engine/sub_combat/combos';

// The combo builder states both DPS bases, names the cooldown that bounds the loop,
// and every preset button carries its burst / sustained DPS so the pick is not blind
// (scan-sweep --challenge combat-damage-pipeline/B).

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

const statValue = (label: string) => {
  // 'div': a preset is also named "Burst DPS" (a button), the stat label is a div.
  const box = screen.getByText(label, { selector: 'div' }).parentElement;
  if (!box) throw new Error(`no stat ${label}`);
  return box;
};

describe('ComboChainBuilder', () => {
  it('Dark Side Burst shows its sustained DPS, the binding cooldown, and DPS on every preset', () => {
    render(<ComboChainBuilder />);
    fireEvent.click(screen.getByRole('button', { name: /Dark Side Burst/ }));

    expect(within(statValue('Sustained DPS')).getByText('27')).toBeTruthy();
    expect(within(statValue('Burst DPS')).getByText('177')).toBeTruthy();
    expect(screen.getByText('Loop bound by Death Field (20s CD)')).toBeTruthy();

    const figures: Record<string, [string, string]> = {
      'Basic Melee Chain': ['44', '44'],
      'Dash Opener': ['50', '24'],
      'Spell Weave': ['41', '6'],
      'Burst DPS': ['56', '37'],
      'KOTOR Force Chain': ['105', '35'],
      'Dark Side Burst': ['177', '27'],
    };
    for (const [name, [burst, sustained]] of Object.entries(figures)) {
      const btn = screen.getByRole('button', { name: new RegExp(`^${name}`) });
      expect(btn.textContent).toContain(`${burst} burst`);
      expect(btn.textContent).toContain(`${sustained} sustained`);
    }
  });
});
