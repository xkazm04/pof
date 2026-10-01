/**
 * perf-capture: reading a CSV Profiler capture and gating runs against the noise floor.
 * Frame times are hand-built or SIMULATED (simulated-frames.ts): no engine produced them.
 */
import { describe, it, expect } from 'vitest';
import { PERF_CAPTURE_EVENTS } from '@/types/observation';
import {
  gateCaptureCsvs,
  gatePerfRuns,
  parseFrameCsv,
  percentile,
  splitPerfCapture,
} from '@/lib/profiling/perf-capture';
import { simulateCaptureCsv, simulateRun } from './simulated-frames';

const flat = (ms: number, n = 600): number[] => Array.from({ length: n }, () => ms);
const runs = (values: number[], n = 600): number[][] => values.map((v) => flat(v, n));

describe('parseFrameCsv', () => {
  it('reads the profiler layout and stops at the summary header row and metadata', () => {
    const csv = [
      'EVENTS,FrameTime,GameThreadTime',
      ',8.5,6.1',
      'PoFScenarioBegin##1.25;Other,9.5,7.0',
      ',10,8',
      'EVENTS,FrameTime,GameThreadTime',
      '[HasHeaderRowAtEnd],1',
      '[Commandline],-csvStartOnEvent=x',
    ].join('\r\n');
    const r = parseFrameCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.frames.map((f) => f.frameMs)).toEqual([8.5, 9.5, 10]);
    expect(r.frames[1].events).toEqual(['PoFScenarioBegin', 'Other']);
  });

  it('rejects a capture with no FrameTime column instead of guessing one', () => {
    const r = parseFrameCsv('Name,Group,Inclusive\nSTAT_GameThread,GameThread,24');
    expect(r).toMatchObject({ ok: false });
    expect(parseFrameCsv('   \n')).toMatchObject({ ok: false, reason: 'empty capture' });
  });

  it('skips a row whose FrameTime is not a number', () => {
    const r = parseFrameCsv('EVENTS,FrameTime\n,8\n,abc\n,9');
    expect(r.ok && r.frames.map((f) => f.frameMs)).toEqual([8, 9]);
  });
});

describe('splitPerfCapture', () => {
  const frame = (frameMs: number, ...events: string[]) => ({ frameMs, events });

  it('cuts baseline phase and window at the scenario markers; the end frame is not in the window', () => {
    const s = splitPerfCapture([
      frame(5, PERF_CAPTURE_EVENTS.baselineStart), frame(6),
      frame(8, PERF_CAPTURE_EVENTS.windowStart), frame(9), frame(10),
      frame(7, PERF_CAPTURE_EVENTS.windowEnd), frame(7),
    ]);
    expect(s).toEqual({ status: 'ok', baselineMs: [5, 6], windowMs: [8, 9, 10], droppedFrames: 0 });
  });

  it('matches a category-prefixed event, and drops non-positive frame times', () => {
    const s = splitPerfCapture([
      frame(0, PERF_CAPTURE_EVENTS.baselineStart),
      frame(8, `PoF/${PERF_CAPTURE_EVENTS.windowStart}`), frame(9),
      frame(7, PERF_CAPTURE_EVENTS.windowEnd),
    ]);
    expect(s.status).toBe('ok');
    expect(s.baselineMs).toEqual([]);
    expect(s.windowMs).toEqual([8, 9]);
    expect(s.droppedFrames).toBe(1);
  });

  it('with no window-start marker nothing is guessed', () => {
    expect(splitPerfCapture([frame(5), frame(6)])).toEqual({ status: 'no-window-start', baselineMs: [], windowMs: [], droppedFrames: 0 });
  });

  it('with no window-end marker the window is truncated and the status says so', () => {
    const s = splitPerfCapture([frame(5), frame(8, PERF_CAPTURE_EVENTS.windowStart), frame(9)]);
    expect(s.status).toBe('no-window-end');
    expect(s.windowMs).toEqual([8, 9]);
  });
});

describe('percentile', () => {
  it('interpolates between order statistics and is NaN on no data', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([10, 0, 20], 0)).toBe(0);
    expect(percentile([10, 0, 20], 100)).toBe(20);
    expect(percentile([], 95)).toBeNaN();
  });
});

describe('gatePerfRuns', () => {
  it('identical builds pass, a 2 ms slowdown fails', () => {
    expect(gatePerfRuns(runs([8, 8, 8, 8, 8]), runs([8, 8, 8, 8, 8])).verdict).toBe('pass');
    const slow = gatePerfRuns(runs([8, 8, 8, 8, 8]), runs([10, 10, 10, 10, 10]));
    expect(slow.verdict).toBe('fail');
    expect(slow.metrics.map((m) => m.percentile)).toEqual([50, 95]);
  });

  it('a difference smaller than the A/A spread is unverifiable: never pass, never fail', () => {
    // Baseline runs of the SAME build already differ by 1.5 ms; the candidate is 0.4 ms over their median.
    const g = gatePerfRuns(runs([8, 9, 8.5, 9.5, 8.2]), runs([8.9, 8.9, 8.9, 8.9, 8.9]));
    expect(g.verdict).toBe('unverifiable');
    expect(g.metrics.every((m) => m.spreadMs > m.effectMs)).toBe(true);
    expect(g.reason).toContain('A/A spread');
  });

  it('gates the tail: p50 unchanged, p95 slower, still a fail', () => {
    const tail = (slow: boolean) => Array.from({ length: 600 }, (_, i) => (slow ? (i < 540 ? 8 : 14) : (i < 570 ? 8 : 9)));
    const g = gatePerfRuns([1, 2, 3, 4, 5].map(() => tail(false)), [1, 2, 3, 4, 5].map(() => tail(true)));
    expect(g.metrics.find((m) => m.percentile === 50)?.verdict).toBe('pass');
    expect(g.metrics.find((m) => m.percentile === 95)?.verdict).toBe('fail');
    expect(g.verdict).toBe('fail');
  });

  it('a faster candidate is not a regression', () => {
    expect(gatePerfRuns(runs([8, 8, 8, 8, 8]), runs([6, 6, 6, 6, 6])).verdict).toBe('pass');
  });

  it('too few runs, or a run with too few frames, is unverifiable with the reason', () => {
    expect(gatePerfRuns(runs([8, 8]), runs([8, 8, 8]))).toMatchObject({ verdict: 'unverifiable', baselineRuns: 2 });
    const shortRun = gatePerfRuns(runs([8, 8, 8]), [flat(8), flat(8, 100), flat(8)]);
    expect(shortRun.verdict).toBe('unverifiable');
    expect(shortRun.reason).toContain('candidate run 1');
  });

  it('SIMULATED: two draws of one build do not fail; one with +2 ms does', () => {
    const draw = (seed: number, inject = 0) => Array.from({ length: 5 }, (_, r) => simulateRun(seed + r * 7, {}, inject));
    expect(gatePerfRuns(draw(10), draw(5000)).verdict).not.toBe('fail');
    expect(gatePerfRuns(draw(10), draw(5000, 2)).verdict).toBe('fail');
  });
});

describe('gateCaptureCsvs', () => {
  const csvOf = (seed: number, inject = 0, omit?: 'windowStart' | 'windowEnd', frames = 400) =>
    simulateCaptureCsv(simulateRun(seed, { frames: 60 }), simulateRun(seed + 1, { frames }, inject), PERF_CAPTURE_EVENTS, { omit });
  const side = (seed: number, inject = 0) => [0, 1, 2, 3, 4].map((r) => csvOf(seed + r * 11, inject));

  it('SIMULATED: end to end from CSV text, a +2 ms candidate fails and reports each run\'s phases', () => {
    const g = gateCaptureCsvs(side(100), side(900, 2), { expectedWindowFrames: 400 });
    expect(g.verdict).toBe('fail');
    expect(g.runs).toHaveLength(10);
    expect(g.runs[0]).toMatchObject({ side: 'baseline', baselinePhaseFrames: 60, windowFrames: 400 });
    expect(g.runs[0].baselinePhaseP50Ms).toBeGreaterThan(0);
  });

  it('a capture with no window markers makes the whole comparison unverifiable and names the run', () => {
    const bad = [...side(100)];
    bad[2] = csvOf(7, 0, 'windowStart');
    const g = gateCaptureCsvs(bad, side(900));
    expect(g.verdict).toBe('unverifiable');
    expect(g.reason).toContain('baseline run 2: no-window-start');
  });

  it('a truncated window (no stop marker) is refused, not read short', () => {
    const cand = [...side(900)];
    cand[0] = csvOf(3, 0, 'windowEnd');
    expect(gateCaptureCsvs(side(100), cand).reason).toContain('candidate run 0: no-window-end');
  });

  it('a window off the planned length is refused: the fixed step makes length a precondition', () => {
    const cand = [...side(900)];
    cand[4] = csvOf(9, 0, undefined, 330);
    const g = gateCaptureCsvs(side(100), cand, { expectedWindowFrames: 400 });
    expect(g.verdict).toBe('unverifiable');
    expect(g.reason).toContain('candidate run 4: window holds 330 frames, plan expects 400');
  });

  it('an unreadable capture is named, never skipped', () => {
    const g = gateCaptureCsvs(['Name,Group\nA,B', ...side(100).slice(1)], side(900));
    expect(g.verdict).toBe('unverifiable');
    expect(g.reason).toContain('baseline run 0: no FrameTime column');
  });
});
