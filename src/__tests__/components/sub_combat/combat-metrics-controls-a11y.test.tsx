import { describe, it, expect, afterEach, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StatInfluencePanel } from '@/components/modules/core-engine/sub_combat/metrics/StatInfluencePanel';

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
