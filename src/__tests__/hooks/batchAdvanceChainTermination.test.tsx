/**
 * Wave-7 recursive-`setTimeout` audit (Lot AE).
 *
 * `src/components/modules/**` holds 78 real `setTimeout` call sites; only four
 * are self-rescheduling chains. Two live in the forge store (settled by the
 * wave-6 `forge-poll-has-a-stop` commit). The other two are the CLI batch-drain
 * chains covered here — `useScanTab`'s batch fix and `useReviewableModuleView`'s
 * batch run.
 *
 * Both are deliberately long-lived: a batch CLI run is a paid multi-minute job
 * the user started, so it must NOT pause when the module is hidden in the LRU.
 * What they lacked was a *stated stop*. These tests pin the three terminal
 * conditions each chain now has — drained, skipped-and-continued, unmounted —
 * plus the control proving the chain still survives suspension.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { SuspendContext } from '@/hooks/useSuspend';

// ── CLI mock: capture the batch-fix session's onComplete so tests can drive it ──
const { sendPrompt, execute, onCompleteBySession } = vi.hoisted(() => ({
  sendPrompt: vi.fn(),
  execute: vi.fn(),
  onCompleteBySession: { current: {} as Record<string, (success: boolean) => void> },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (config: { sessionKey: string; onComplete?: (s: boolean) => void }) => {
    const suffix = config.sessionKey.split('-').pop() ?? '';
    if (config.onComplete) onCompleteBySession.current[suffix] = config.onComplete;
    return { execute, sendPrompt, isRunning: false, session: null };
  },
}));

// ── Store mock: the hook both selects from it and reads getState() ──
type Finding = { id: string; category: string; severity: string; description: string; file?: string; suggestedFix: string };
const { storeState } = vi.hoisted(() => ({
  storeState: {
    current: {
      scanResults: {} as Record<string, Finding[]>,
      checklistProgress: {} as Record<string, Record<string, boolean>>,
      addScanFindings: vi.fn(),
      clearScanFindings: vi.fn(),
      resolveScanFinding: vi.fn(),
      setChecklistItem: vi.fn(),
      quickActionsPanelCollapsed: true,
      setQuickActionsPanelCollapsed: vi.fn(),
    },
  },
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (sel: (s: { projectPath: string }) => unknown) => sel({ projectPath: '' }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/stores/moduleStore', () => {
  const useModuleStore = (sel: (s: typeof storeState.current) => unknown) => sel(storeState.current);
  useModuleStore.getState = () => storeState.current;
  return { useModuleStore };
});

const { logInfo, logWarn } = vi.hoisted(() => ({ logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: logInfo, warn: logWarn, error: vi.fn(), debug: vi.fn() },
}));

import { useScanTab } from '@/components/modules/core-engine/ScanTab/useScanTab';
import { useReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView/useReviewableModuleView';
import { UI_TIMEOUTS } from '@/lib/constants';

const MODULE = 'arpg-combat' as const;

function finding(id: string): Finding {
  return { id, category: 'perf', severity: 'high', description: `desc ${id}`, suggestedFix: `fix ${id}` };
}

/** Drive the batch-fix CLI's completion callback. */
function completeFix(success = true) {
  act(() => onCompleteBySession.current.fix?.(success));
}

/** Let one batch-advance tick land. */
function tick() {
  act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.batchItemDelay + 1); });
}

function renderScanTab(suspended = false) {
  return renderHook(() => useScanTab(MODULE), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(SuspendContext.Provider, { value: suspended }, children),
  });
}

describe('batch-advance chains — self-rescheduling setTimeout with a stated stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendPrompt.mockClear();
    execute.mockClear();
    logInfo.mockClear();
    logWarn.mockClear();
    onCompleteBySession.current = {};
    storeState.current.scanResults = { [MODULE]: [finding('f1'), finding('f2'), finding('f3')] };
    storeState.current.resolveScanFinding = vi.fn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('drains a finite queue and reports the reason it ended', () => {
    const { result } = renderScanTab();

    act(() => {
      result.current.toggleSelectFinding('f1');
      result.current.toggleSelectFinding('f2');
    });
    act(() => { result.current.startBatchFix(); });

    // First item dispatched synchronously by startBatchFix.
    expect(sendPrompt).toHaveBeenCalledTimes(1);

    // Completion arms the next tick; the tick dispatches the second item.
    completeFix();
    expect(sendPrompt).toHaveBeenCalledTimes(1); // not yet — the delay is real
    tick();
    expect(sendPrompt).toHaveBeenCalledTimes(2);

    // Completing the last item drains the queue: the chain stops and SAYS SO.
    completeFix();
    tick();
    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(logInfo.mock.calls.some(([m]) => String(m).includes('queue drained'))).toBe(true);

    // And it stays stopped — no re-arm from a drained queue.
    tick();
    tick();
    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(result.current.isBatchFixing).toBe(false);
  });

  it('keeps draining while SUSPENDED — a paid batch run must survive being hidden', () => {
    const { result } = renderScanTab(true);

    act(() => {
      result.current.toggleSelectFinding('f1');
      result.current.toggleSelectFinding('f2');
    });
    act(() => { result.current.startBatchFix(); });
    expect(sendPrompt).toHaveBeenCalledTimes(1);

    completeFix();
    tick();
    // Control for the suspend tests elsewhere: this chain is DELIBERATELY not
    // suspendable, so the hidden module still advances to the next item.
    expect(sendPrompt).toHaveBeenCalledTimes(2);
  });

  it('skips a finding that vanished from the scan results, reports why, and continues', () => {
    const { result } = renderScanTab();

    act(() => {
      result.current.toggleSelectFinding('f1');
      result.current.toggleSelectFinding('f2');
      result.current.toggleSelectFinding('f3');
    });
    act(() => { result.current.startBatchFix(); });
    expect(sendPrompt).toHaveBeenCalledTimes(1);

    // f2 is resolved/cleared elsewhere while it sits in the queue. Nothing will
    // ever call onComplete for it, so without the skip the batch would stall
    // with isBatchFixing stuck true forever.
    storeState.current.scanResults = { [MODULE]: [finding('f1'), finding('f3')] };

    completeFix();
    tick();
    expect(logWarn.mock.calls.some(([m]) => String(m).includes('f2') && String(m).includes('no longer in scan results'))).toBe(true);
    expect(sendPrompt).toHaveBeenCalledTimes(1); // f2 not dispatched

    // The drain continued on its own: f3 goes out on the next tick.
    tick();
    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(sendPrompt.mock.calls[1][0]).toContain('desc f3');
  });

  it('unmount is a terminal condition: the pending tick is cancelled and reported', () => {
    const { result, unmount } = renderScanTab();

    act(() => {
      result.current.toggleSelectFinding('f1');
      result.current.toggleSelectFinding('f2');
    });
    act(() => { result.current.startBatchFix(); });
    completeFix(); // arms a pending advance

    logInfo.mockClear();
    unmount();

    expect(logInfo.mock.calls.some(([m]) => String(m).includes('unmounted with items still queued'))).toBe(true);

    // The armed tick must NOT dispatch into a torn-down hook.
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.batchItemDelay * 10); });
    expect(sendPrompt).toHaveBeenCalledTimes(1);
  });
});

// ── The second chain: ReviewableModuleView's checklist batch run ─────────────

const CHECKLIST = [
  { id: 'c1', label: 'One', description: 'd1', prompt: 'p1' },
  { id: 'c2', label: 'Two', description: 'd2', prompt: 'p2' },
  { id: 'c3', label: 'Three', description: 'd3', prompt: 'p3' },
];

function renderReviewable() {
  return renderHook(() =>
    useReviewableModuleView({
      moduleId: MODULE,
      moduleLabel: 'Combat',
      accentColor: '#fff',
      checklist: CHECKLIST,
      extraTabs: [],
    }),
  );
}

function completeChecklist(success = true) {
  act(() => onCompleteBySession.current.cli?.(success));
}

describe('useReviewableModuleView batch run — the same chain, the same stated stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendPrompt.mockClear();
    execute.mockClear();
    logInfo.mockClear();
    logWarn.mockClear();
    onCompleteBySession.current = {};
    storeState.current.checklistProgress = {};
    storeState.current.setChecklistItem = vi.fn();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('drains the queue and reports that it drained', () => {
    const { result } = renderReviewable();

    act(() => { result.current.startBatchRun(['c1', 'c2']); });
    expect(execute).toHaveBeenCalledTimes(1);

    completeChecklist();
    tick();
    expect(execute).toHaveBeenCalledTimes(2);

    completeChecklist();
    expect(logInfo.mock.calls.some(([m]) => String(m).includes('queue drained'))).toBe(true);

    tick();
    tick();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('reports a queued id that is not a checklist item instead of dropping it silently', () => {
    const { result } = renderReviewable();

    act(() => { result.current.startBatchRun(['c1', 'ghost-item']); });
    completeChecklist();

    expect(logWarn.mock.calls.some(([m]) => String(m).includes('ghost-item') && String(m).includes('no such checklist item'))).toBe(true);
    tick();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('unmount cancels the armed tick and states why', () => {
    const { result, unmount } = renderReviewable();

    act(() => { result.current.startBatchRun(['c1', 'c2']); });
    completeChecklist(); // arms the advance

    logInfo.mockClear();
    unmount();
    expect(logInfo.mock.calls.some(([m]) => String(m).includes('unmounted with items still queued'))).toBe(true);

    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.batchItemDelay * 10); });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
