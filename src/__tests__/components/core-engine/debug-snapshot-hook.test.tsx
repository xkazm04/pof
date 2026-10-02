import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, screen, waitFor, cleanup } from '@testing-library/react';
import { useDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/useDebugSnapshot';
import { projectDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { DebugDashboard } from '@/components/modules/core-engine/sub_debug';
import type { ProfilingSession, ProfileSourceType } from '@/types/performance-profiling';

/**
 * Acceptance for scan-sweep --challenge card debug-performance/A: the Debug tab
 * reads the newest profiler session through the profiling store's list reader,
 * falls back to the one SAMPLE_SESSION fixture, and says which one it shows —
 * never 'LIVE', and never 'CAPTURE' for a generated sample.
 */

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    features: [],
    defs: [],
    isLoading: false,
  }),
}));
// Out of scope here (SSE transport / feature matrix fetches) — stub them.
vi.mock('@/components/modules/core-engine/sub_debug/console/ConsoleSection', () => ({
  ConsoleSection: () => null,
}));
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({ default: () => null }));

afterEach(cleanup);

interface Row { id: string; name: string; source: ProfileSourceType; importedAt: string }

function session(row: Row): ProfilingSession {
  return {
    ...SAMPLE_SESSION, ...row,
    summary: { ...SAMPLE_SESSION.summary, avgDrawCallsPerFrame: 777 },
  };
}

let calls: Array<{ action: string; sessionId?: string }>;

function mockProfiler(rows: Row[]) {
  calls = [];
  const envelope = (data: unknown) => ({ json: async () => ({ success: true, data }) });
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { action: string; sessionId?: string };
    calls.push(body);
    if (body.action === 'list-sessions') {
      return envelope({ sessions: rows.map((r) => ({ ...r, frameCount: 1, avgFPS: 60, hasTriage: false, overallScore: null, bottleneck: null })) });
    }
    const row = rows.find((r) => r.id === body.sessionId);
    return envelope({ session: row ? session(row) : null, triage: null });
  }) as unknown as typeof fetch;
}

const S1: Row = { id: 's1', name: 'older capture', source: 'csv-stats', importedAt: '2026-09-28T10:00:00.000Z' };
const S2: Row = { id: 's2', name: 'boss arena', source: 'csv-stats', importedAt: '2026-09-29T10:00:00.000Z' };
const GEN: Row = { id: 'g1', name: 'combat-heavy (50 enemies, 60fps target)', source: 'manual', importedAt: '2026-09-29T11:00:00.000Z' };

beforeEach(() => {
  usePerformanceProfilingStore.setState({ sessionList: [], activeSession: null, error: null, isLoading: false });
});

describe('useDebugSnapshot', () => {
  it('no captures -> the sample fixture, and no get-session request', async () => {
    mockProfiler([]);
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(calls.some((c) => c.action === 'list-sessions')).toBe(true));
    await waitFor(() => expect(result.current.listed).toBe(true));
    expect(result.current.provenance).toEqual({ kind: 'sample' });
    expect(result.current.snapshot).toEqual(projectDebugSnapshot(SAMPLE_SESSION, null));
    expect(calls.filter((c) => c.action === 'get-session')).toHaveLength(0);
  });

  it('captures -> reads the newest one once, provenance carries its source', async () => {
    mockProfiler([S2, S1]);
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(result.current.provenance.kind).toBe('session'));
    const gets = calls.filter((c) => c.action === 'get-session');
    expect(gets).toEqual([{ action: 'get-session', sessionId: 's2' }]);
    expect(result.current.provenance).toEqual({
      kind: 'session', source: 'csv-stats', name: S2.name, importedAt: S2.importedAt,
    });
    expect(result.current.snapshot.drawCalls.perFrame).toBe(777);
  });
});

describe('DebugDashboard provenance', () => {
  it('no captures -> SAMPLE DATA, never LIVE, and no 800 ms random-walk interval', async () => {
    mockProfiler([]);
    const spy = vi.spyOn(window, 'setInterval');
    render(<DebugDashboard moduleId="arpg-polish" />);
    await waitFor(() => expect(calls.some((c) => c.action === 'list-sessions')).toBe(true));
    expect(screen.getByText(/SAMPLE DATA/)).toBeTruthy();
    expect(screen.queryByText(/LIVE STREAM ACTIVE/)).toBeNull();
    expect(spy.mock.calls.some((c) => c[1] === 800)).toBe(false);
    spy.mockRestore();
  });

  it('newest session is a generated sample -> GENERATED SAMPLE: <name>, never CAPTURE', async () => {
    mockProfiler([GEN, S1]);
    render(<DebugDashboard moduleId="arpg-polish" />);
    await screen.findByText(`GENERATED SAMPLE: ${GEN.name}`);
    expect(screen.queryByText(/CAPTURE/)).toBeNull();
  });
});
