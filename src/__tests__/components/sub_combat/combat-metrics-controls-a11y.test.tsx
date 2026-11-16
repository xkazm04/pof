import { describe, it, expect, afterEach, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StatInfluencePanel } from '@/components/modules/core-engine/sub_combat/metrics/StatInfluencePanel';
import { WeaponMatchupPanel } from '@/components/modules/core-engine/sub_combat/metrics/WeaponMatchupPanel';
import { WEAPONS } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// combat-metrics controls carry an accessible name and expose their state
// (scan-sweep night 2026-11-08, accessibility-checker).

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

afterEach(() => cleanup());

describe('StatInfluencePanel controls are named', () => {
  it('STR and DEX sliders and the weapon select have accessible names', () => {
    render(<StatInfluencePanel moduleId="combat-action-map" />);
    const str = screen.getByRole('slider', { name: 'STR' });
    const dex = screen.getByRole('slider', { name: 'DEX' });
    expect(str.getAttribute('min')).toBe('8');
    expect(dex.getAttribute('max')).toBe('20');
    const select = screen.getByRole('combobox', { name: 'Weapon' });
    expect(select.tagName).toBe('SELECT');
  });

  it('every slider and select in the panel is named (none unnamed)', () => {
    const { container } = render(<StatInfluencePanel moduleId="combat-action-map" />);
    const controls = Array.from(container.querySelectorAll('input, select'));
    expect(controls.length).toBe(3);
    const unnamed = controls.filter((el) => {
      const id = el.getAttribute('id');
      const labelled = id ? container.querySelector(`label[for="${id}"]`) : null;
      return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !labelled && !el.closest('label');
    });
    expect(unnamed).toHaveLength(0);
  });

  it('a named slider still drives the value', () => {
    render(<StatInfluencePanel moduleId="combat-action-map" />);
    const str = screen.getByRole('slider', { name: 'STR' }) as HTMLInputElement;
    fireEvent.change(str, { target: { value: '14' } });
    expect(str.value).toBe('14');
  });
});

describe('WeaponMatchupPanel compare toggles expose their state', () => {
  it('every weapon toggle carries aria-pressed, and it follows the selection', () => {
    render(<WeaponMatchupPanel />);
    const panel = screen.getByTestId('weapon-matchup-panel');
    const toggles = WEAPONS.map((w) => {
      const btn = Array.from(panel.querySelectorAll('button')).find((b) => b.textContent?.startsWith(w.name));
      if (!btn) throw new Error(`no toggle for ${w.name}`);
      return btn;
    });
    expect(toggles).toHaveLength(WEAPONS.length);
    expect(toggles.filter((b) => b.getAttribute('aria-pressed') === null)).toHaveLength(0);
    expect(toggles.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0);

    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute('aria-pressed')).toBe('false');
  });
});
