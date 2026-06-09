import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { AFFIX_DEFS } from '@/components/modules/core-engine/sub_loot/_shared/data';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Drive reduced-motion deterministically AND replace motion.* with plain
// elements that stamp their animate/transition props onto data-attributes so we
// can assert the reel choreography (staggered settle + tier-3 win pop) and that
// it collapses under reduced motion.
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
          'data-animate': JSON.stringify(props.animate ?? null),
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

import { AffixRollSimulator } from '@/components/modules/core-engine/sub_loot/affix/AffixRollSimulator';

const NAMES = new Set(AFFIX_DEFS.map(a => a.name));
const slotEls = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('.w-24.h-12'));

describe('AffixRollSimulator reel + win cue', () => {
  it('reveals the result instantly under reduced motion (no timers, no spin pop)', () => {
    motionState.reduced = true;
    const { container } = render(<AffixRollSimulator />);

    const slots = slotEls(container);
    expect(slots).toHaveLength(3);
    expect(slots.every(s => s.textContent === '?')).toBe(true);

    // No fake timers installed: if the reveal needed setTimeout it would never land.
    fireEvent.click(container.querySelector('button.text-xs.font-semibold') as HTMLElement);

    // Resolved immediately to real affix names from the pool…
    expect(slotEls(container).every(s => NAMES.has(s.textContent || ''))).toBe(true);
    expect(container.textContent).toContain('1 roll performed');
    // …and every slot's animation is gated off (no spin bob / scale pop).
    expect(slotEls(container).every(s => s.getAttribute('data-animate') === 'null')).toBe(true);
  });

  it('staggers the reels left-to-right and only commits after the last one lands', () => {
    motionState.reduced = false;
    vi.useFakeTimers();
    const { container } = render(<AffixRollSimulator />);

    fireEvent.click(container.querySelector('button.text-xs.font-semibold') as HTMLElement);

    // Mid-spin: all reels in motion, nothing committed yet.
    let slots = slotEls(container);
    expect(slots.every(s => s.getAttribute('data-animate')?.includes('"y"'))).toBe(true);
    expect(container.textContent).not.toContain('roll performed');

    // First reel (400ms) settles before the others.
    act(() => { vi.advanceTimersByTime(420); });
    slots = slotEls(container);
    expect(NAMES.has(slots[0].textContent || '')).toBe(true);
    expect(slots[2].getAttribute('data-animate')).toContain('"y"'); // still spinning
    expect(container.textContent).not.toContain('roll performed');

    // After the final reel (800ms) all are resolved and the roll is committed.
    act(() => { vi.advanceTimersByTime(420); });
    slots = slotEls(container);
    expect(slots.every(s => NAMES.has(s.textContent || ''))).toBe(true);
    expect(container.textContent).toContain('1 roll performed');
  });

  it('pops + glows a tier-3 (godroll) landing, and that pop is gated by reduced motion', () => {
    // Force every pick onto the rarest end of the weighted roll → a tier-3 affix.
    const tier3 = AFFIX_DEFS.filter(a => a.tier === 3).map(a => a.name);
    expect(tier3.length).toBeGreaterThan(0);
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);

    // Motion on: the landed tier-3 slot animates a scale pop + boxShadow glow.
    motionState.reduced = false;
    vi.useFakeTimers();
    const { container, unmount } = render(<AffixRollSimulator />);
    fireEvent.click(container.querySelector('button.text-xs.font-semibold') as HTMLElement);
    act(() => { vi.advanceTimersByTime(820); });

    const won = slotEls(container);
    expect(tier3).toContain(won[0].textContent); // forced a godroll
    const anim = won[0].getAttribute('data-animate') || '';
    expect(anim).toContain('scale');
    expect(anim).toContain('boxShadow');
    unmount();
    vi.useRealTimers();

    // Reduced motion: same forced godroll, but the pop is gated off.
    motionState.reduced = true;
    const { container: c2 } = render(<AffixRollSimulator />);
    fireEvent.click(c2.querySelector('button.text-xs.font-semibold') as HTMLElement);
    const reduced = slotEls(c2);
    expect(tier3).toContain(reduced[0].textContent);
    expect(reduced[0].getAttribute('data-animate')).toBe('null');
  });
});
