import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  DEFAULT_PREDICTIVE_CONFIG,
  runPredictiveBalanceAsync,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import { usePredictiveSweep } from '@/components/modules/core-engine/sub_character/simulator/predictive/usePredictiveSweep';

vi.mock('@/lib/combat/predictive-balance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/combat/predictive-balance')>();
  return { ...actual, runPredictiveBalanceAsync: vi.fn(actual.runPredictiveBalanceAsync) };
});

const QUICK: PredictiveBalanceConfig = {
  ...DEFAULT_PREDICTIVE_CONFIG,
  levelRange: [5, 5],
  levelStep: 1,
  iterations: 10,
  enemyConfigs: [{ archetypeId: 'melee-grunt', count: 1, levelOffset: 0 }],
  sensitivityAttributes: [],
};

/** Many cells so a run is still in flight when the test acts on it. */
const LONG: PredictiveBalanceConfig = { ...DEFAULT_PREDICTIVE_CONFIG, iterations: 200 };

const lastSignal = (): AbortSignal => {
  const calls = vi.mocked(runPredictiveBalanceAsync).mock.calls;
  return calls[calls.length - 1][2]!.signal!;
};

beforeEach(() => {
  vi.mocked(runPredictiveBalanceAsync).mockClear();
});

describe('usePredictiveSweep', () => {
  it('run() goes running with {done,total} progress, then lands the report', async () => {
    const { result } = renderHook(() => usePredictiveSweep());
    act(() => { result.current.run(QUICK); });
    expect(result.current.running).toBe(true);
    expect(result.current.progress).toEqual({ done: expect.any(Number), total: 1 });

    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.report?.heatmap).toHaveLength(1);
  });

  it('cancel() stops the run and keeps the previous report', async () => {
    const { result } = renderHook(() => usePredictiveSweep());
    act(() => { result.current.run(QUICK); });
    await waitFor(() => expect(result.current.report).not.toBeNull());
    const previous = result.current.report;

    act(() => { result.current.run(LONG); });
    expect(result.current.running).toBe(true);
    const signal = lastSignal();
    act(() => { result.current.cancel(); });

    expect(signal.aborted).toBe(true);
    expect(result.current.running).toBe(false);
    expect(result.current.report).toBe(previous);
    // The aborted job resolving later must not overwrite anything.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.report).toBe(previous);
    expect(result.current.running).toBe(false);
  });

  it('unmount mid-run aborts the job', () => {
    const { result, unmount } = renderHook(() => usePredictiveSweep());
    act(() => { result.current.run(LONG); });
    const signal = lastSignal();
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
