import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  runPredictiveBalance,
  runPredictiveBalanceAsync,
  DEFAULT_PREDICTIVE_CONFIG,
  type BalanceReport,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';

// The predictive sweep as a cancellable, yielding job: the same report as the
// sync runner, progress per cell, yields between AND inside cells, and an
// AbortSignal honoured at every yield.

const SMALL: PredictiveBalanceConfig = {
  ...DEFAULT_PREDICTIVE_CONFIG,
  levelRange: [5, 8],
  levelStep: 3, // levels 5, 8
  iterations: 40,
  enemyConfigs: [
    { archetypeId: 'melee-grunt', count: 2, levelOffset: 0 },
    { archetypeId: 'brute', count: 1, levelOffset: 0 },
  ],
  sensitivityAttributes: ['attackPower'],
};

/** One level x one encounter x no sensitivity: exactly one cell. */
const ONE_CELL: PredictiveBalanceConfig = {
  ...DEFAULT_PREDICTIVE_CONFIG,
  levelRange: [10, 10],
  levelStep: 1,
  iterations: 1000,
  enemyConfigs: [{ archetypeId: 'melee-grunt', count: 3, levelOffset: 0 }],
  sensitivityAttributes: [],
};

const withoutDuration = (r: BalanceReport) => ({ ...r, durationMs: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runPredictiveBalanceAsync — the sweep as a job', () => {
  it('resolves the same report as the sync runner (ignoring durationMs)', async () => {
    const job = await runPredictiveBalanceAsync(SMALL);
    expect(job.aborted).toBeFalsy();
    const sync = runPredictiveBalance(SMALL);
    expect(withoutDuration(job as BalanceReport)).toEqual(withoutDuration(sync));
  });

  it('reports progress per cell, up to levels*encounters + attrs*13, and yields between cells', async () => {
    const calls: [number, number][] = [];
    let timerFired = false;
    setTimeout(() => { timerFired = true; }, 0);
    const pending = runPredictiveBalanceAsync(SMALL, undefined, {
      onProgress: (done, total) => { calls.push([done, total]); },
    });
    let firedBeforeResolve = false;
    await pending.then(() => { firedBeforeResolve = timerFired; });

    const total = 2 * 2 + 1 * 13;
    expect(calls.length).toBeGreaterThan(1);
    for (const [, t] of calls) expect(t).toBe(total);
    for (let i = 1; i < calls.length; i++) expect(calls[i][0]).toBeGreaterThan(calls[i - 1][0]);
    expect(calls[calls.length - 1][0]).toBe(total);
    expect(firedBeforeResolve).toBe(true);
  });

  it('yields INSIDE a cell: a 1000-iteration cell yields at least 4 times', async () => {
    const real = globalThis.setImmediate;
    let yields = 0;
    vi.stubGlobal('setImmediate', ((cb: () => void) => { yields++; return real(cb); }) as typeof setImmediate);
    const job = await runPredictiveBalanceAsync(ONE_CELL);
    expect(job.aborted).toBeFalsy();
    expect(yields).toBeGreaterThanOrEqual(4);
  });

  it('abort after the first onProgress resolves { aborted: true } with no report and no further progress', async () => {
    const ac = new AbortController();
    const calls: number[] = [];
    const job = await runPredictiveBalanceAsync(SMALL, undefined, {
      signal: ac.signal,
      onProgress: (done) => { calls.push(done); if (calls.length === 1) ac.abort(); },
    });
    expect(job).toEqual({ aborted: true });
    expect(calls).toHaveLength(1);
  });

  it('abort mid-cell resolves { aborted: true } before that cell finishes', async () => {
    const real = globalThis.setImmediate;
    const ac = new AbortController();
    let yields = 0;
    vi.stubGlobal('setImmediate', ((cb: () => void) => {
      yields++;
      // Yield #1 is the job handing the frame back; #2 is the first in-cell
      // yield (after the first batch of fights). Abort there.
      if (yields === 2) ac.abort();
      return real(cb);
    }) as typeof setImmediate);
    const done: number[] = [];
    const job = await runPredictiveBalanceAsync(ONE_CELL, undefined, {
      signal: ac.signal,
      onProgress: (d) => { done.push(d); },
    });
    expect(job).toEqual({ aborted: true });
    // The cell never completed (no progress past 0) and no batch ran after the abort.
    expect(done.filter((d) => d > 0)).toHaveLength(0);
    expect(yields).toBe(2);
  });
});
