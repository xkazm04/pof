/**
 * A capture superseded by a newer one settles with an error, but only the LATEST capture owns
 * the busy flag and the error: the older one must not report idle or a false failure while the
 * newer one is still reading back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSnapshots } from '@/hooks/useSnapshots';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { PofSnapshotDiffReport } from '@/types/pof-bridge';

const REPORT: PofSnapshotDiffReport = {
  generatedAt: '2026-09-30T12:00:00.000Z',
  diffThreshold: 0.5,
  overallStatus: 'passed',
  results: [{
    presetId: 'a', presetName: 'Preset A', status: 'passed',
    diffPercentage: 0, maxPixelDiff: 2, diffPixelCount: 0, totalPixelCount: 1920 * 1080,
  }],
  summary: { totalPresets: 1, passed: 1, failed: 0, noBaseline: 0, skipped: 0 },
};

let reportReady: boolean;
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (error: string) => new Response(JSON.stringify({ success: false, error }), { status: 404 });
const originalFetch = global.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  reportReady = false;
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') return ok({ accepted: true, presetIds: ['a'] });
    return reportReady ? ok(REPORT) : fail('no diff report yet');
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  global.fetch = originalFetch;
});

describe('useSnapshots overlapping captures', () => {
  it('keeps isCapturing true and error null while the newest capture still reads back', async () => {
    const { result } = renderHook(() => useSnapshots());

    let first!: Promise<PofSnapshotDiffReport | null>;
    let second!: Promise<PofSnapshotDiffReport | null>;
    await act(async () => {
      first = result.current.capture({ presetIds: ['a'] });
      await vi.advanceTimersByTimeAsync(0);
      second = result.current.capture({ presetIds: ['a'] });
      await vi.advanceTimersByTimeAsync(0);
    });

    let firstOutcome: PofSnapshotDiffReport | null | undefined;
    await act(async () => { firstOutcome = await first; });
    expect(firstOutcome).toBeNull();
    expect(result.current.isCapturing).toBe(true);
    expect(result.current.error).toBeNull();

    reportReady = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.pofSnapshotPoll); });
    let secondOutcome: PofSnapshotDiffReport | null | undefined;
    await act(async () => { secondOutcome = await second; });
    expect(secondOutcome).toEqual(REPORT);
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.diffReport).toEqual(REPORT);
  });
});
