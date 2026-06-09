import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Drive prefers-reduced-motion deterministically AND replace motion.* with plain
// elements that stamp `animate`/`initial`/`transition` onto data-* attributes, so
// we can assert (a) the `d` morph is wired into `animate` and (b) every transition
// collapses to duration 0 under reduced motion. See reference-reduced-motion-pattern.
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
          'data-animate': JSON.stringify(props.animate ?? null),
          'data-initial': JSON.stringify(props.initial ?? null),
        };
        for (const key of Object.keys(props)) {
          if (key !== 'children' && !FRAMER_PROPS.has(key)) domProps[key] = props[key];
        }
        return React.createElement(tag, domProps, props.children);
      },
  });
  return {
    ...actual,
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => motionState.reduced,
  };
});

import { XpCurveChart } from '@/components/modules/core-engine/sub_progression/curves/XpCurveChart';
import { generateChartData } from '@/components/modules/core-engine/sub_progression/_shared/data';

function sampleData() {
  const data = generateChartData(120, 1.6).map(({ level, xp }) => ({ level, xp }));
  const maxXp = Math.max(...data.map((d) => d.xp));
  return { data, maxXp };
}

/** Parse a data-* JSON attribute, tolerating null. */
function parseAttr(el: Element, name: string): unknown {
  return JSON.parse(el.getAttribute(name) || 'null');
}

/** Recursively collect the leaf transition objects out of a (possibly per-key) transition map. */
function collectLeaves(node: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const isLeaf = ['duration', 'type', 'delay', 'ease', 'stiffness'].some((k) => k in obj);
    if (isLeaf) acc.push(obj);
    else for (const v of Object.values(obj)) collectLeaves(v, acc);
  }
  return acc;
}

function allLeafTransitions(container: HTMLElement): Record<string, unknown>[] {
  return Array.from(container.querySelectorAll('[data-transition]'))
    .flatMap((el) => collectLeaves(parseAttr(el, 'data-transition')));
}

describe('XpCurveChart', () => {
  it('wires the path `d` (and dot `cy`) into `animate` so they morph on param change', () => {
    motionState.reduced = false;
    const { data, maxXp } = sampleData();
    const { container } = render(<XpCurveChart data={data} maxXp={maxXp} />);

    const animates = Array.from(container.querySelectorAll('[data-animate]'))
      .map((el) => parseAttr(el, 'data-animate'))
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object');

    // The filled area + the stroke both animate their `d` (the morph target).
    const withD = animates.filter((a) => typeof a.d === 'string' && (a.d as string).length > 0);
    expect(withD.length).toBeGreaterThanOrEqual(2);

    // Every data point's dot morphs its `cy` along with the curve.
    const withCy = animates.filter((a) => 'cy' in a);
    expect(withCy.length).toBe(data.length);
  });

  it('uses real (spring + positive-duration) transitions when motion is allowed', () => {
    motionState.reduced = false;
    const { data, maxXp } = sampleData();
    const { container } = render(<XpCurveChart data={data} maxXp={maxXp} />);

    const leaves = allLeafTransitions(container);
    expect(leaves.length).toBeGreaterThan(0);
    // The morph is a spring...
    expect(leaves.some((t) => t.type === 'spring')).toBe(true);
    // ...and the one-time draw-in / fade keeps a positive duration.
    expect(leaves.some((t) => typeof t.duration === 'number' && (t.duration as number) > 0)).toBe(true);
  });

  it('collapses every transition to an instant snap (no draw-in, stagger, or morph) under reduced motion', () => {
    motionState.reduced = true;
    const { data, maxXp } = sampleData();
    const { container } = render(<XpCurveChart data={data} maxXp={maxXp} />);

    const leaves = allLeafTransitions(container);
    expect(leaves.length).toBeGreaterThan(0);
    leaves.forEach((t) => {
      expect(t.duration).toBe(0);
      expect(t.delay ?? 0).toBe(0); // stagger never fires
      expect(t.type).toBeUndefined(); // spring morph collapsed
      expect(t.ease).toBeUndefined();
    });
  });

  it('keeps `initial` markup identical regardless of motion preference (no hydration branch)', () => {
    const initialsFor = (reduced: boolean) => {
      motionState.reduced = reduced;
      const { data, maxXp } = sampleData();
      const { container, unmount } = render(<XpCurveChart data={data} maxXp={maxXp} />);
      const initials = Array.from(container.querySelectorAll('[data-initial]'))
        .map((el) => el.getAttribute('data-initial'));
      unmount();
      return initials;
    };
    expect(initialsFor(false)).toEqual(initialsFor(true));
  });

  it('still renders the curve content (axis + level labels) under reduced motion', () => {
    motionState.reduced = true;
    const { data, maxXp } = sampleData();
    render(<XpCurveChart data={data} maxXp={maxXp} />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText(`Lv ${data[0].level}`)).toBeTruthy();
  });

  it('renders an empty-state panel (no motion) when there are too few points', () => {
    motionState.reduced = false;
    const { container } = render(<XpCurveChart data={[{ level: 1, xp: 100 }]} maxXp={100} />);
    expect(screen.getByText('Not enough data points')).toBeTruthy();
    // No curve/dot motion elements were rendered.
    expect(container.querySelector('path[data-animate]')).toBeNull();
    expect(container.querySelector('circle[data-animate]')).toBeNull();
  });
});
