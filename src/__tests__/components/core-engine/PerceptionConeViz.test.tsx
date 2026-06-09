import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { DetectedEntity } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { ACCENT_RED, STATUS_SUCCESS, STATUS_NEUTRAL } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Drive reduced-motion deterministically AND replace motion.* with plain
// elements that stamp their `transition` prop onto data-transition, so we can
// assert the sweep + entity pulses collapse to duration 0 under reduced motion
// while the DOM structure stays identical (hydration-safe).
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
const FRAMER_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag', 'drag',
]);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_t, tag: string) =>
      function MockMotion(props: Record<string, unknown> & { children?: React.ReactNode }) {
        const domProps: Record<string, unknown> = {
          'data-transition': JSON.stringify(props.transition ?? null),
        };
        for (const key of Object.keys(props)) {
          if (key !== 'children' && !FRAMER_PROPS.has(key)) domProps[key] = props[key];
        }
        return React.createElement(tag, domProps, props.children);
      },
  });
  return { ...actual, motion, useReducedMotion: () => motionState.reduced };
});

import { PerceptionConeViz } from '@/components/modules/core-engine/sub_bestiary/ai-logic/PerceptionConeViz';

const ENTITIES: DetectedEntity[] = [
  { label: 'Player', x: 44.7, y: 24.4, color: ACCENT_RED, inCone: true, inHearing: true },
  { label: 'NPC', x: 93.4, y: 81.3, color: STATUS_SUCCESS, inCone: false, inHearing: true },
  { label: 'Distant', x: 20.3, y: 109.7, color: STATUS_NEUTRAL, inCone: false, inHearing: false },
];

function transitionsIn(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(container.querySelectorAll('[data-transition]'))
    .map((el) => JSON.parse(el.getAttribute('data-transition') || 'null'))
    .filter(Boolean);
}

describe('PerceptionConeViz radar sweep', () => {
  it('renders the static cone diagram (AI eye, range labels, entity labels)', () => {
    motionState.reduced = false;
    render(<PerceptionConeViz entities={ENTITIES} />);
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('1500cm')).toBeTruthy();
    expect(screen.getByText('800cm')).toBeTruthy();
    expect(screen.getByText('Player')).toBeTruthy();
    expect(screen.getByText('Distant')).toBeTruthy();
  });

  it('animates the sweep and pulses only entities in cone/hearing range', () => {
    motionState.reduced = false;
    const { container } = render(<PerceptionConeViz entities={ENTITIES} />);
    // Sweep beam is present and rotating.
    expect(container.querySelector('[data-testid="perception-sweep"]')).toBeTruthy();
    // Only the two detected entities (Player, NPC) get a pulse — Distant does not.
    expect(container.querySelectorAll('[data-testid="perception-pulse"]').length).toBe(2);
    // Some transition carries a real (non-zero) duration when motion is allowed.
    const ts = transitionsIn(container);
    expect(ts.some((t) => typeof t.duration === 'number' && (t.duration as number) > 0)).toBe(true);
  });

  it('gives the seen entity a faster pulse than one that is only heard', () => {
    motionState.reduced = false;
    const { container } = render(<PerceptionConeViz entities={ENTITIES} />);
    const durations = Array.from(container.querySelectorAll('[data-testid="perception-pulse"]'))
      .map((el) => (JSON.parse(el.getAttribute('data-transition') || 'null') as { duration: number }).duration)
      .sort((a, b) => a - b);
    // inCone (Player) = 1.8s, inHearing-only (NPC) = 2.6s
    expect(durations).toEqual([1.8, 2.6]);
  });

  it('collapses every transition to duration 0 under reduced motion, structure unchanged', () => {
    motionState.reduced = true;
    const { container } = render(<PerceptionConeViz entities={ENTITIES} />);
    const ts = transitionsIn(container);
    expect(ts.length).toBeGreaterThan(0);
    ts.forEach((t) => {
      expect(t.duration).toBe(0);
      expect(t.delay ?? 0).toBe(0);
      expect(t.ease).toBeUndefined();
      expect(t.repeat ?? 0).toBe(0);
    });
    // DOM structure is identical to the animated render (hydration-safe).
    expect(container.querySelector('[data-testid="perception-sweep"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="perception-pulse"]').length).toBe(2);
    expect(screen.getByText('AI')).toBeTruthy();
  });
});
