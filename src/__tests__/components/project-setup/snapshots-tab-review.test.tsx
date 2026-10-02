/**
 * The Test Harness Snapshots tab is the whole regression loop: rows that did not
 * pass offer "Accept as baseline", and because an accept OVERWRITES
 * <project>/.pof/snapshots/<id>-baseline.png (no restore endpoint exists), every
 * accept goes through a confirm that names what it overwrites and creates.
 * runSuite derives the suite's snapshot status from the READ-BACK diff report,
 * never from the capture ack. Every bridge call is a fetch double.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { SnapshotsTab } from '@/components/modules/project-setup/TestHarnessPanel/SnapshotsTab';
import { useTestHarnessPanel } from '@/components/modules/project-setup/TestHarnessPanel/useTestHarnessPanel';
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

function report(results: PofSnapshotDiffResult[], generatedAt = '2026-09-30T12:00:00.000Z'): PofSnapshotDiffReport {
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

const originalFetch = global.fetch;
let fetchSpy: ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  global.fetch = originalFetch;
});

// ── Case 7: accept is click-only and confirmed ───────────────────────────────

describe('SnapshotsTab accept', () => {
  const ABC = report([row('a', 'failed', 3.1), row('b', 'no-baseline'), row('c', 'passed')]);

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  function renderTab(diffReport: PofSnapshotDiffReport) {
    const onAccept = vi.fn(async () => null);
    render(
      <SnapshotsTab
        diffReport={diffReport}
        isCapturing={false}
        presets={diffReport.results.map((r) => r.presetId)}
        onPresetsChange={vi.fn()}
        onCapture={vi.fn(async () => null)}
        onAccept={onAccept}
        onRefresh={vi.fn(async () => {})}
      />,
    );
    return onAccept;
  }

  it('bulk accept opens a confirm naming the overwrite; Cancel does nothing, Confirm accepts both (case 7)', () => {
    const onAccept = renderTab(ABC);
    expect(screen.queryByRole('button', { name: /Accept c as baseline/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Accept 2 as baseline' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(
      'Overwrites 1 existing baseline (a) - cannot be undone from PoF; creates 1 (b)',
    );
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Accept 2 as baseline' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept).toHaveBeenCalledWith(['a', 'b']);
  });

  it('a row accept confirms that one preset only', () => {
    const onAccept = renderTab(ABC);
    fireEvent.click(screen.getByRole('button', { name: 'Accept a as baseline' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Overwrites 1 existing baseline (a) - cannot be undone from PoF');
    expect(dialog.textContent).not.toContain('creates');
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(onAccept).toHaveBeenCalledWith(['a']);
  });

  it('an all-passed report renders no accept control [guard]', () => {
    renderTab(report([row('a', 'passed'), row('c', 'passed')]));
    expect(screen.queryByRole('button', { name: /as baseline/ })).toBeNull();
  });
});

// ── Case 8: runSuite reads the suite's snapshot status from the read-back report ──

describe('useTestHarnessPanel.runSuite snapshots', () => {
  it('a suite with presets passes on the read-back report, not the capture ack (case 8)', async () => {
    vi.useFakeTimers();
    const R = report([row('a', 'passed')]);
    let captured = false;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      if (url.startsWith('/api/pof-bridge/snapshot') && method === 'POST') {
        captured = true;
        const { presetIds } = JSON.parse(String(init?.body)) as { presetIds: string[] };
        return new Response(JSON.stringify({ success: true, data: { accepted: true, presetIds } }));
      }
      if (url.startsWith('/api/pof-bridge/snapshot')) {
        return captured
          ? new Response(JSON.stringify({ success: true, data: R }))
          : new Response(JSON.stringify({ success: false, error: 'Snapshot diff error: none yet' }), { status: 404 });
      }
      return new Response(JSON.stringify({ success: false, error: 'not stubbed' }), { status: 500 });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useTestHarnessPanel());
    act(() => { result.current.createSuite(); });
    act(() => { result.current.removeScenario(0); });
    const suiteId = result.current.activeSuiteId!;
    act(() => { result.current.updateSuiteField(suiteId, 'snapshotPresets', ['a']); });

    let run!: Promise<void>;
    act(() => { run = result.current.runSuite(); });
    // each tick in its own act() so the readback's interval effect commits between them
    for (let i = 0; i < 3; i += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.pofSnapshotPoll); });
    }
    await act(async () => { await run; });

    const [latest] = result.current.suiteRunHistory;
    expect(latest.snapshotReport).toEqual(R);
    expect(latest.status).toBe('passed');
  });
});
