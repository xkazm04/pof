/**
 * Honesty guards for the Experiment Lab's poll loop and its result chips.
 *
 * Each test here was RED before the `experiment-poll-budget-honest` direction:
 *  - the client slept 30 s BEFORE its first poll, so a spawn-time failure the server
 *    already knew about took half a minute to surface (this suite's first test simply
 *    times out against that code);
 *  - the timeout said "experiment timed out" and named neither ceiling;
 *  - `ok` was rendered as a green "✓ ran" beside a red behavioural fail;
 *  - a scenario run with no assertions checked rendered NOTHING where a verdict belongs.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { runExperimentJob } from '@/components/experiment-lab/client';
import { experimentChips } from '@/components/experiment-lab/outcome';
import { ExperimentLab } from '@/components/experiment-lab/ExperimentLab';
import type { ExperimentResult } from '@/lib/ue-experiment/runner';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const jsonRes = (body: unknown) => ({ json: async () => body }) as Response;

const baseResult = (over: Partial<ExperimentResult> = {}): ExperimentResult => ({
  ok: true, logs: [], markers: {}, durationMs: 1200, binary: 'b', args: [], ...over,
});

describe('runExperimentJob — poll then sleep', () => {
  it('surfaces a spawn-time failure on the FIRST tick, without waiting a poll interval', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonRes({ success: true, data: { jobId: 'exp-fast' } }))
      .mockResolvedValueOnce(jsonRes({ success: true, data: { status: 'error', error: 'POF_UE_UPROJECT not set (path to the PoF .uproject)' } }));
    // No pollMs override on purpose: with sleep-then-poll this cannot resolve inside the
    // test timeout, because the real interval elapses before the first status read.
    const started = Date.now();
    await expect(runExperimentJob({ python: 'x' }, { fetchImpl })).rejects.toThrow(/POF_UE_UPROJECT/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('names the client budget AND the server ceiling it derives from when it gives up', async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes('/api/experiment/run')
        ? jsonRes({ success: true, data: { jobId: 'exp-slow' } })
        : jsonRes({ success: true, data: { status: 'running' } }));
    await expect(
      runExperimentJob({ python: '', scenario: { map: '/Game/M' } }, { fetchImpl, pollMs: 0, maxPolls: 3 }),
    ).rejects.toThrow(/timed out .*client-side[\s\S]*3m 0s[\s\S]*scenario/i);
  });

  it('names the python ceiling for a python-probe run', async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes('/api/experiment/run')
        ? jsonRes({ success: true, data: { jobId: 'exp-slow2' } })
        : jsonRes({ success: true, data: { status: 'running' } }));
    await expect(runExperimentJob({ python: 'x' }, { fetchImpl, pollMs: 0, maxPolls: 2 }))
      .rejects.toThrow(/1m 0s[\s\S]*python/i);
  });

  it("names the spec's own settleMs when the caller set one", async () => {
    const fetchImpl = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes('/api/experiment/run')
        ? jsonRes({ success: true, data: { jobId: 'exp-slow3' } })
        : jsonRes({ success: true, data: { status: 'running' } }));
    await expect(runExperimentJob({ python: 'x', settleMs: 90_000 }, { fetchImpl, pollMs: 0, maxPolls: 2 }))
      .rejects.toThrow(/1m 30s[\s\S]*settleMs/i);
  });
});

describe('experimentChips — a chip may not claim what the run did not measure', () => {
  it('never puts a green run chip beside a failed behavioural verdict', () => {
    const chips = experimentChips(baseResult({
      observationSummary: { sampleCount: 8, maxSpeed: 0, maxAnimSpeed: 0, displacement: 0, montagePlayed: false },
      behavioralVerdict: { status: 'fail', detail: 'moved: displacement 0' },
    }));
    const run = chips.find((c) => c.key === 'run')!;
    const behavior = chips.find((c) => c.key === 'behavior')!;
    expect(behavior.level).toBe('bad');
    expect(run.level).not.toBe('ok');
    // and it says what it actually measured, not "ran"
    expect(run.word.toLowerCase()).toContain('sample');
  });

  it('renders an explicit UNVERIFIED behaviour chip when no assertions were checked', () => {
    const chips = experimentChips(baseResult({
      observationSummary: { sampleCount: 8, maxSpeed: 300, maxAnimSpeed: 300, displacement: 400, montagePlayed: false },
    }));
    const behavior = chips.find((c) => c.key === 'behavior');
    expect(behavior).toBeTruthy();
    expect(behavior!.word).toBe('UNVERIFIED');
    expect(behavior!.detail).toMatch(/no assertion/i);
  });

  it('keeps a python probe chip honest about what it measured', () => {
    const [run] = experimentChips(baseResult({ markers: { RESULT: '5.8.0' } }));
    expect(run.level).toBe('ok');
    expect(run.word.toLowerCase()).toContain('probe');
    // a python probe has no behaviour to verify — it gets no behaviour chip at all
    expect(experimentChips(baseResult()).some((c) => c.key === 'behavior')).toBe(false);
  });

  it('a failed run is bad regardless of verdicts', () => {
    const [run] = experimentChips(baseResult({ ok: false, error: 'no observations produced' }));
    expect(run.level).toBe('bad');
  });

  it('a deferred visual verdict does not drag the run chip red', () => {
    const chips = experimentChips(baseResult({ verdict: { status: 'deferred', detail: 'no key' } }));
    expect(chips.find((c) => c.key === 'run')!.level).toBe('ok');
    expect(chips.find((c) => c.key === 'visual')!.level).toBe('warn');
  });
});

describe('ExperimentLab result panel', () => {
  it('shows UNVERIFIED instead of silence for a scenario run with no assertions', async () => {
    const result = baseResult({
      observations: [],
      observationSummary: { sampleCount: 8, maxSpeed: 300, maxAnimSpeed: 300, displacement: 400, montagePlayed: false },
    });
    vi.stubGlobal('fetch', vi.fn(async (url: URL | RequestInfo) => {
      const u = String(url);
      if (u.includes('/api/experiment/run')) return jsonRes({ success: true, data: { jobId: 'exp-ui' } });
      if (u.includes('/api/experiment/status')) return jsonRes({ success: true, data: { status: 'done', result } });
      return jsonRes({ success: true, data: { runs: [] } });
    }));
    render(<ExperimentLab />);
    fireEvent.click(screen.getByRole('tab', { name: /Gameplay Scenario/ }));
    fireEvent.click(screen.getByRole('button', { name: /Run on UE 5\.8/ }));
    await waitFor(() => expect(screen.getByText('UNVERIFIED')).toBeTruthy());
    expect(screen.queryByText('✓ ran')).toBeNull();
  });
});
