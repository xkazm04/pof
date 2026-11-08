import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

// Motion values never reach the DOM in jsdom, so expose what ChartPanel asked for.
const motionState = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  return {
    useReducedMotion: () => motionState.reduced,
    motion: new Proxy({}, {
      get: (_target, tag: string) => ({ animate, transition, initial: _initial, ...rest }: Record<string, unknown>) =>
        createElement(tag, { ...rest, 'data-animate': JSON.stringify(animate), 'data-transition': JSON.stringify(transition) }),
    }),
  };
});

import { ChartPanel } from '@/components/layout-lab/steps/shared/ChartPanel';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(() => { cleanup(); motionState.reduced = false; });

describe('<ChartPanel /> geometry stays inside its track', () => {
  it('clamps an over-budget or negative bar to the track', () => {
    const { container } = render(
      <ChartPanel t={LIGHT} variant="bars" max={100} rows={[{ label: 'over', value: 150 }, { label: 'neg', value: -5 }]} />,
    );
    const widths = [...container.querySelectorAll('[data-animate]')].map((el) => JSON.parse(el.getAttribute('data-animate') ?? '{}').width);
    expect(widths).toEqual(['100%', '0%']);
  });

  it('clamps a histogram bar to the plot height', () => {
    const { container } = render(
      <ChartPanel t={LIGHT} variant="histogram" height={130} max={10} bars={[{ value: 40 }, { value: -1 }]} />,
    );
    const heights = [...container.querySelectorAll('rect')].map((el) => Number(el.getAttribute('height')));
    expect(heights).toEqual([110, 0]);
  });
});
