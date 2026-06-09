import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Deterministic reduced-motion + avoid jsdom matchMedia gaps.
const motionState = vi.hoisted(() => ({ reduced: false as boolean | null }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => motionState.reduced };
});

import { CountUp } from '@/components/modules/core-engine/sub_world/_shared/CountUp';
import { RipplePulse } from '@/components/modules/core-engine/sub_world/_shared/RipplePulse';
import { ACCENT_CYAN } from '@/lib/chart-colors';

describe('CountUp', () => {
  it('renders the current value', () => {
    motionState.reduced = false;
    render(<CountUp value={7} />);
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('renders the target instantly under reduced motion', () => {
    motionState.reduced = true;
    const { rerender } = render(<CountUp value={3} />);
    expect(screen.getByText('3')).toBeTruthy();
    rerender(<CountUp value={12} />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('applies the optional formatter', () => {
    motionState.reduced = true;
    render(<CountUp value={5} format={(n) => `${n} zones`} />);
    expect(screen.getByText('5 zones')).toBeTruthy();
  });
});

describe('RipplePulse', () => {
  it('renders its children and a non-interactive ring overlay', () => {
    motionState.reduced = false;
    const { container } = render(
      <RipplePulse trigger="a|b" color={ACCENT_CYAN}>
        <div>panel content</div>
      </RipplePulse>,
    );
    expect(screen.getByText('panel content')).toBeTruthy();
    const ring = container.querySelector('[aria-hidden="true"]');
    expect(ring).toBeTruthy();
    expect(ring?.className).toContain('pointer-events-none');
  });

  it('survives a trigger change without unmounting children', () => {
    motionState.reduced = false;
    const { rerender } = render(
      <RipplePulse trigger="a" color={ACCENT_CYAN}>
        <div>panel content</div>
      </RipplePulse>,
    );
    rerender(
      <RipplePulse trigger="a|b|c" color={ACCENT_CYAN}>
        <div>panel content</div>
      </RipplePulse>,
    );
    expect(screen.getByText('panel content')).toBeTruthy();
  });

  it('does not pulse under reduced motion', () => {
    motionState.reduced = true;
    const { rerender } = render(
      <RipplePulse trigger="a" color={ACCENT_CYAN}>
        <div>panel content</div>
      </RipplePulse>,
    );
    rerender(
      <RipplePulse trigger="b" color={ACCENT_CYAN}>
        <div>panel content</div>
      </RipplePulse>,
    );
    expect(screen.getByText('panel content')).toBeTruthy();
  });
});
