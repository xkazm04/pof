/**
 * useSnapshots runs the plugin's snapshot contract as written: POST capture is
 * an async ACK (`{ accepted, presetIds }`), the DiffReport is read back from
 * GET diff until a report NEWER than the pre-capture one covers the requested
 * presets, and accepting a baseline is verified by an immediate re-compare.
 * The readback is suspend-aware (paused while the pane is hidden) and bounded.
 * Every bridge call is a fetch double; nothing reaches a plugin.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSnapshots } from '@/hooks/useSnapshots';
import { SuspendContext } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { PofSnapshotDiffReport, PofSnapshotDiffResult } from '@/types/pof-bridge';

type Status = PofSnapshotDiffResult['status'];

function row(presetId: string, status: Status, diffPercentage = 0): PofSnapshotDiffResult {
  return {
    presetId,
    presetName: `Preset ${presetId.toUpperCase()}`,
    status,
    diffPercentage,
    maxPixelDiff: status === 'passed' ? 2 : 90,
    diffPixelCount: status === 'failed' ? 4096 : 0,
    totalPixelCount: 1920 * 1080,
  };
}

function report(results: PofSnapshotDiffResult[], generatedAt: string): PofSnapshotDiffReport {
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  return {
    generatedAt,
    diffThreshold: 0.5,
    overallStatus: results.every((r) => r.status === 'passed') ? 'passed' : 'failed',
    results,
    summary: {
      totalPresets: results.length,
      passed: count('passed'),
      failed: count('failed'),
      noBaseline: count('no-baseline'),
      skipped: 0,
    },
  };
}

// ── Fetch double: a scripted plugin behind /api/pof-bridge/snapshot ──────────

interface Call { method: string; url: string; body: unknown }
let calls: Call[];
/** GET diff answers, in order; the last one repeats. null = no report yet (error envelope). */
let diffAnswers: (PofSnapshotDiffReport | null)[];
let baselineError: string | null;

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (error: string, status = 502) => new Response(JSON.stringify({ success: false, error }), { status });

const originalFetch = global.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  diffAnswers = [null];
  baselineError = null;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (!url.startsWith('/api/pof-bridge/snapshot')) return fail('not stubbed', 500);
    if (method === 'GET') {
      const answer = diffAnswers.length > 1 ? diffAnswers.shift()! : diffAnswers[0];
      return answer ? ok(answer) : fail('Snapshot diff error: no diff report yet', 404);
    }
    const req = body as { action?: string; presetIds: string[] };
    if (req.action === 'baseline') {
      return baselineError ? fail(baselineError) : ok({ saved: req.presetIds });
    }
    return ok({ accepted: true, presetIds: req.presetIds });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  global.fetch = originalFetch;
});

const POLL = UI_TIMEOUTS.pofSnapshotPoll;
const shape = () => calls.map((c) => `${c.method} ${c.body && (c.body as { action?: string }).action === 'baseline' ? 'baseline' : c.method === 'POST' ? 'capture' : 'diff'}`);

/**
 * Drive the readback: each poll is its own act() so React commits the readback
 * state (and its interval effect) between ticks, then collect the settled value.
 */
async function settle<T>(promise: Promise<T>, polls: number): Promise<T> {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  for (let i = 0; i < polls; i += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL); });
  }
  let out!: T;
  await act(async () => { out = await promise; });
  return out;
}

const OLDER = report([row('a', 'failed', 3.1)], '2026-09-30T11:00:00.000Z');
const R = report([row('a', 'failed', 2.4)], '2026-09-30T12:00:00.000Z');

describe('useSnapshots.capture', () => {
  it('treats the POST reply as an ack and reads back the report newer than the capture (case 4)', async () => {
    diffAnswers = [OLDER, OLDER, R];
    const { result } = renderHook(() => useSnapshots());

    let pending!: Promise<PofSnapshotDiffReport | null>;
    act(() => { pending = result.current.capture({ presetIds: ['a'], compareToBaseline: true }); });
    const resolved = await settle(pending, 3);

    expect(resolved).toEqual(R);
    expect(result.current.diffReport).toEqual(R);
    expect(result.current.error).toBeNull();
    expect(result.current.isCapturing).toBe(false);
    // pre-capture read (learns "since"), the capture, a stale readback, the fresh one
    expect(shape()).toEqual(['GET diff', 'POST capture', 'GET diff', 'GET diff']);
    expect(calls[1].body).toEqual({ presetIds: ['a'], compareToBaseline: true });
  });

  it('the readback pauses while the pane is suspended and resumes on show', async () => {
    diffAnswers = [null, R];
    let suspended = false;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SuspendContext.Provider value={suspended}>{children}</SuspendContext.Provider>
    );
    const { result, rerender } = renderHook(() => useSnapshots(), { wrapper });

    let pending!: Promise<PofSnapshotDiffReport | null>;
    await act(async () => {
      pending = result.current.capture({ presetIds: ['a'], compareToBaseline: true });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shape()).toEqual(['GET diff', 'POST capture']);

    suspended = true;
    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL * 10); });
    expect(shape()).toEqual(['GET diff', 'POST capture']);

    suspended = false;
    rerender();
    expect(await settle(pending, 1)).toEqual(R);
    expect(shape()).toEqual(['GET diff', 'POST capture', 'GET diff']);
  });

  it('gives up after the readback budget and says why', async () => {
    diffAnswers = [OLDER];
    const { result } = renderHook(() => useSnapshots());
    let pending!: Promise<PofSnapshotDiffReport | null>;
    act(() => { pending = result.current.capture({ presetIds: ['a'], compareToBaseline: true }); });
    const polls = Math.ceil(UI_TIMEOUTS.pofSnapshotReadbackTimeout / POLL) + 1;
    expect(await settle(pending, polls)).toBeNull();
    expect(result.current.error).toMatch(/no diff report newer than/i);
    expect(result.current.diffReport).toBeNull();
  });
});

describe('useSnapshots.acceptBaselines', () => {
  const SEEN = report([row('a', 'failed', 3.1), row('c', 'passed')], '2026-09-30T11:00:00.000Z');
  const REDIFF = report([row('a', 'passed')], '2026-09-30T12:00:00.000Z');

  async function withSeenReport() {
    diffAnswers = [SEEN];
    const hook = renderHook(() => useSnapshots());
    await act(async () => { await hook.result.current.refreshDiff(); });
    expect(hook.result.current.diffReport).toEqual(SEEN);
    calls = [];
    return hook;
  }

  it('saves the baseline, recaptures those presets and resolves the verified re-diff (case 5)', async () => {
    const { result } = await withSeenReport();
    diffAnswers = [REDIFF];

    let pending!: Promise<PofSnapshotDiffReport | null>;
    act(() => { pending = result.current.acceptBaselines(['a']); });
    const resolved = await settle(pending, 1);

    expect(shape()).toEqual(['POST baseline', 'POST capture', 'GET diff']);
    expect(calls[0].body).toEqual({ action: 'baseline', presetIds: ['a'] });
    expect(calls[1].body).toMatchObject({ presetIds: ['a'], compareToBaseline: true });
    expect(resolved).toEqual(REDIFF);
    expect(result.current.diffReport).toEqual(REDIFF);
    expect(result.current.error).toBeNull();
  });

  it('a failed baseline POST stops there: no recapture, the reason surfaces, the report stays (case 6)', async () => {
    const { result } = await withSeenReport();
    baselineError = 'Snapshot error: no capture for a';

    let pending!: Promise<PofSnapshotDiffReport | null>;
    act(() => { pending = result.current.acceptBaselines(['a']); });
    expect(await settle(pending, 2)).toBeNull();

    expect(shape()).toEqual(['POST baseline']);
    expect(result.current.error).toBe('Snapshot error: no capture for a');
    expect(result.current.diffReport).toEqual(SEEN);
  });
});
