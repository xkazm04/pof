/**
 * Run evidence must follow a recorded run (scan-sweep night 2026-11-08).
 *
 * useModuleRunEvidence caches `/api/session-analytics?action=module` for the process
 * lifetime, and recordSessionOutcome — the one writer of those rows, called by
 * useModuleCLI when a run ends — never told it. So the NBA card kept scoring its
 * success odds from the read it made at mount: the run the user just finished was
 * invisible until a page reload. A recorded outcome must invalidate the module's
 * entry and the project aggregate so mounted cards re-read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

const { apiFetch, tryApiFetch, rows } = vi.hoisted(() => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  tryApiFetch: vi.fn(),
  rows: { sessions: [] as { success: boolean }[], dashboard: [] as { moduleId: string; totalSessions: number; successCount: number }[] },
}));

vi.mock('@/lib/api-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-utils')>()),
  apiFetch,
  tryApiFetch,
}));

import { useModuleRunEvidence, useProjectRunEvidence, __resetRunEvidenceCache } from '@/hooks/useModuleRunEvidence';
import { recordSessionOutcome } from '@/hooks/useSessionAnalytics';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-combat' as SubModuleId;

function outcome() {
  return {
    moduleId: MODULE, sessionKey: 'k', prompt: 'p', hadProjectContext: false,
    success: true, durationMs: 1, startedAt: new Date(0).toISOString(),
  };
}

beforeEach(() => {
  __resetRunEvidenceCache();
  rows.sessions = [];
  rows.dashboard = [];
  apiFetch.mockClear();
  tryApiFetch.mockReset();
  tryApiFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url.includes('action=module')
        ? { ok: true, data: { sessions: [...rows.sessions] } }
        : { ok: true, data: { moduleStats: [...rows.dashboard] } },
    ),
  );
});
afterEach(cleanup);

describe('run evidence after a recorded outcome', () => {
  it('re-reads the module evidence once the outcome is recorded', async () => {
    const { result } = renderHook(() => useModuleRunEvidence(MODULE));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.evidence?.runs).toBe(0);

    rows.sessions = [{ success: true }];
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    tryApiFetch.mockImplementationOnce(async () => { await gate; return { ok: true, data: { sessions: [...rows.sessions] } }; });
    await act(async () => { await recordSessionOutcome(outcome()); });
    // While the re-read is in flight the last good figure stays (no flash to "no odds").
    seen.push(result.current.state);
    await act(async () => { release(); await gate; });

    await waitFor(() => expect(result.current.evidence?.runs).toBe(1));
    expect(seen).toEqual(['ready']);
  });

  it('re-reads the project aggregate too', async () => {
    const { result } = renderHook(() => useProjectRunEvidence());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.byModule.get(MODULE)).toBeUndefined();

    rows.dashboard = [{ moduleId: MODULE, totalSessions: 1, successCount: 1 }];
    await act(async () => { await recordSessionOutcome(outcome()); });

    await waitFor(() => expect(result.current.byModule.get(MODULE)?.runs).toBe(1));
  });

  it('leaves the cache alone when the record POST fails', async () => {
    apiFetch.mockImplementationOnce(() => Promise.reject(new Error('down')));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useModuleRunEvidence(MODULE));
    await waitFor(() => expect(tryApiFetch).toHaveBeenCalledTimes(1));
    await act(async () => { await recordSessionOutcome(outcome()); });
    expect(tryApiFetch).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});
