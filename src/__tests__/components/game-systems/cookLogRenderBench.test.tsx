import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

afterEach(cleanup);

const captured = vi.hoisted(() => ({ handlers: null as null | {
  onStart: () => void; onEvent: (e: unknown) => void; onSettle: (r: unknown) => void; onJob: (j: unknown) => void;
} }));
vi.mock('@/components/modules/game-systems/CookProgress/cookJobStream', async (orig) => {
  const actual = await orig<typeof import('@/components/modules/game-systems/CookProgress/cookJobStream')>();
  return {
    ...actual,
    driveCookStream: (_s: unknown, _sig: unknown, h: NonNullable<typeof captured.handlers>) => {
      captured.handlers = h;
      h.onStart();
      return Promise.resolve();
    },
  };
});

import { useCookProgress } from '@/components/modules/game-systems/CookProgress/useCookProgress';

const REQUEST = { profileId: 'p1', projectPath: 'C:\PoF', projectName: 'PoF', ueVersion: '5.7.0' };
const LINES = 5000;

/** Renders per streamed log line when each event arrives in its own tick (as a real stream does). */
describe('useCookProgress - log render economy', () => {
  it('renders far fewer times than log lines, and keeps the final buffer exact', async () => {
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useCookProgress({ request: REQUEST, projectPath: 'C:\PoF' }); });
    expect(captured.handlers).toBeTruthy();
    const base = renders;
    for (let i = 0; i < LINES; i++) {
      await act(async () => {
        captured.handlers!.onEvent({ type: 'log', line: i % 10 === 0 ? `Error: bad ${i}` : `line ${i}`, t: i });
      });
    }
    // Allow any batched flush to land.
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    const perLine = (renders - base) / LINES;
    // Correctness: capped buffer, newest kept, tallies match a scan.
    expect(result.current.logs.length).toBe(2000);
    expect(result.current.logs[1999].line).toBe(`line ${LINES - 1}`);
    expect(result.current.counts.error).toBe(result.current.logs.filter((l) => l.severity === 'error').length);
    // Economy: renders per streamed line.
    expect(perLine).toBeLessThan(0.5);
  }, 120_000);
});
