import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import React from 'react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// framer-motion drives its own rAF; replace motion.* with plain elements so the
// only requestAnimationFrame callers in these tests are the editor's own.
const FRAMER_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag', 'drag',
]);
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const motion = new Proxy({} as Record<string, unknown>, {
    get: (_t, tag: string) =>
      function MockMotion(props: Record<string, unknown> & { children?: React.ReactNode }) {
        const domProps: Record<string, unknown> = {};
        for (const key of Object.keys(props)) {
          if (!FRAMER_PROPS.has(key) && key !== 'children') domProps[key] = props[key];
        }
        return React.createElement(tag, domProps, props.children);
      },
  });
  return {
    ...actual,
    useReducedMotion: () => false,
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

import { DodgeTimelineEditor } from '@/components/modules/core-engine/sub_combat/dodge-timeline';
import { usePlayheadStats } from '@/components/modules/core-engine/sub_combat/dodge-timeline/useDodgeTimelineState';
import { DEFAULT_PARAMS } from '@/components/modules/core-engine/sub_combat/_shared/dodge-types';
import { computePhases } from '@/components/modules/core-engine/sub_combat/_shared/dodge-math';
import { useCharacterHeuristicStore } from '@/stores/heuristicTuningStore';

/* ── Manual rAF clock ─────────────────────────────────────────────────────── */

let queue: Map<number, FrameRequestCallback>;
let nextId: number;
let now: number;

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  now = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { queue.delete(id); });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  useCharacterHeuristicStore.setState({ log: [], isOptimizing: false, pendingResult: null, sidebarOpen: false });
});

afterEach(() => { vi.restoreAllMocks(); });

/** Advance the clock by `ms` and run every queued frame once. */
function tick(ms: number) {
  now += ms;
  const due = [...queue.entries()];
  queue.clear();
  act(() => { for (const [, cb] of due) cb(now); });
}

function frameRow(container: HTMLElement, label: string): string {
  const row = [...container.querySelectorAll('tr')].find((tr) => tr.textContent?.includes(label));
  return row?.textContent ?? '';
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((el) => el.textContent?.trim() === text);
  if (!b) throw new Error(`button "${text}" not found`);
  return b as HTMLButtonElement;
}

describe('DodgeTimelineEditor playback', () => {
  it('stops scheduling frames once the playhead reaches the end of the timeline', () => {
    const { container } = render(<DodgeTimelineEditor />);
    tick(0); // flush the mount-time one-shot frame
    fireEvent.click(buttonByText(container, 'Play'));
    // Default timeline is 0.5s dodge + 0.8s cooldown = 1.3s; run 2s of frames.
    for (let i = 0; i < 20; i++) tick(100);
    expect(container.textContent).toContain('Playhead: 1.300s');
    expect(queue.size).toBe(0);
  });

  it.skip('Play pressed at the end replays from the start', () => {
    const { container } = render(<DodgeTimelineEditor />);
    tick(0);
    fireEvent.click(buttonByText(container, 'Play'));
    for (let i = 0; i < 20; i++) tick(100);
    expect(container.textContent).toContain('Playhead: 1.300s');
    fireEvent.click(buttonByText(container, 'Play'));
    tick(100);
    expect(container.textContent).toContain('Playhead: 0.100s');
    expect(buttonByText(container, 'Pause')).toBeTruthy();
  });
});

describe('DodgeTimelineEditor Optimize (local)', () => {
  it.skip('applies the heuristic result to the editor params', () => {
    const { container } = render(<DodgeTimelineEditor />);
    // Defaults: 0.3s i-frames @60fps = 18f.
    expect(frameRow(container, 'Active I-Frames')).toContain('18f');
    fireEvent.click(buttonByText(container, 'Optimize (local)'));
    // 0.3 * 1.15 = 0.345s -> 21f.
    expect(frameRow(container, 'Active I-Frames')).toContain('21f');
    expect(useCharacterHeuristicStore.getState().pendingResult).toBeNull();
  });
});

describe('DodgeTimelineEditor param edits keep the cross-field invariants', () => {
  it.skip('shrinking the dodge duration clamps the i-frame window inside it', () => {
    const { container } = render(<DodgeTimelineEditor />);
    const toggle = container.querySelector('button[title="Toggle parameter editor"]') as HTMLButtonElement;
    fireEvent.click(toggle);
    const numberInputs = [...container.querySelectorAll('input[type="number"]')] as HTMLInputElement[];
    // PARAM_FIELDS[0] is dodgeDuration (min 0.1).
    fireEvent.change(numberInputs[0], { target: { value: '0.1' } });
    const text = container.textContent ?? '';
    const m = text.match(/I-Frame Window:\s*(\d+)%/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(100);
    // i-frames end at the dodge end: start 0.05 + dur 0.05 = 0.1s.
    expect(frameRow(container, 'Active I-Frames')).toContain('3f');
  });
});

describe('usePlayheadStats', () => {
  it.skip('reports a finite speed when the dodge duration is zero', () => {
    const params = { ...DEFAULT_PARAMS, dodgeDuration: 0 };
    const { result } = renderHook(() => usePlayheadStats(0, params, computePhases(params), []));
    expect(Number.isFinite(result.current.speed)).toBe(true);
  });
});
