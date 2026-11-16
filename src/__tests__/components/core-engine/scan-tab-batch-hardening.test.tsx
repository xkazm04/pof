/**
 * useScanTab batch-fix hardening (scan-sweep night 2026-11-08, core-engine-scan-telemetry).
 *
 * The batch chain's ADVANCE step already skips a finding that vanished from the
 * scan results; these tests pin the same rule on the START step and on the
 * selection the batch is started from.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

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

type Finding = {
  id: string; category: string; severity: string; description: string;
  suggestedFix: string; pass: string; effort: string; resolvedAt?: string;
};
const { storeState } = vi.hoisted(() => ({
  storeState: {
    current: {
      scanResults: {} as Record<string, Finding[]>,
      addScanFindings: vi.fn(),
      clearScanFindings: vi.fn(),
      resolveScanFinding: vi.fn(),
    },
  },
}));

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
import { UI_TIMEOUTS } from '@/lib/constants';

const MODULE = 'arpg-combat' as const;

function finding(id: string, resolvedAt?: string): Finding {
  return {
    id, category: 'perf', severity: 'high', description: `desc ${id}`,
    suggestedFix: `fix ${id}`, pass: 'quality', effort: 'small', resolvedAt,
  };
}

function tick() {
  act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.batchItemDelay + 1); });
}

describe('useScanTab batch fix — start step and selection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sendPrompt.mockClear();
    execute.mockClear();
    logInfo.mockClear();
    logWarn.mockClear();
    onCompleteBySession.current = {};
    storeState.current.scanResults = { [MODULE]: [finding('f1'), finding('f2')] };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a FIRST selected finding that is no longer listed is skipped, not left as a stuck batch', () => {
    // A row's "Fix This" closes over its id; a reload can drop that finding before
    // the click lands. (The batch path filters its selection to active findings —
    // see the next test — so the single-row path is where startFixes meets it.)
    const { result } = renderHook(() => useScanTab(MODULE));
    act(() => { result.current.fixFinding('gone'); });

    // Nothing is dispatched for "gone", so no CLI run will ever call onComplete for
    // it: without the skip the view sits on it "fixing" forever.
    expect(sendPrompt).toHaveBeenCalledTimes(0);
    expect(logWarn.mock.calls.some(([m]) => String(m).includes('gone') && String(m).includes('no longer in scan results'))).toBe(true);
    tick();
    expect(result.current.isBatchFixing).toBe(false);
  });

  it('a selected finding resolved after selection drops out of the selection — no fix run for it', () => {
    const { result, rerender } = renderHook(() => useScanTab(MODULE));
    act(() => {
      result.current.toggleSelectFinding('f1');
      result.current.toggleSelectFinding('f2');
    });
    // f1 is resolved (row "Mark Resolved", or a reload) while it is still ticked.
    storeState.current.scanResults = { [MODULE]: [finding('f1', '2026-11-08T00:00:00Z'), finding('f2')] };
    rerender();

    // The count the "Fix Selected (n)" button shows is the ACTIVE selection.
    expect(result.current.selectedFindings.size).toBe(1);
    expect(result.current.allSelected).toBe(true);

    act(() => { result.current.startBatchFix(); });
    expect(sendPrompt).toHaveBeenCalledTimes(1);
    expect(sendPrompt.mock.calls[0][0]).toContain('desc f2');
    expect(sendPrompt.mock.calls.some(([p]) => String(p).includes('desc f1'))).toBe(false);
  });
});
