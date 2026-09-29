/**
 * PerformanceProfilingView — the session rail (reopen a past capture) and the
 * compare mode (pick A/B, one store compare() call, render the diff).
 * fetch is stubbed per action so the real store actions run end to end.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

afterEach(cleanup);

import { PerformanceProfilingView } from '@/components/modules/evaluator/PerformanceProfilingView';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { compareSessions } from '@/lib/profiling/session-compare';
import type { PerformanceFinding, ProfilingSession, ProfilingSummary } from '@/types/performance-profiling';

const INITIAL = usePerformanceProfilingStore.getState();

function summary(over: Partial<ProfilingSummary>): ProfilingSummary {
  return {
    avgFrameMs: 16, p99FrameMs: 20, minFPS: 50, avgFPS: 60, maxFPS: 70,
    avgGameThreadMs: 8, avgRenderThreadMs: 6, avgGpuMs: 7,
    totalDrawCalls: 0, avgDrawCallsPerFrame: 1000, peakDrawCalls: 1200,
    totalMemoryMB: 900, peakMemoryMB: 1000,
    gcPauseCount: 0, avgGcPauseMs: 0, maxGcPauseMs: 0, totalGcTimeMs: 0,
    frameBudgetMs: 16.67, budgetHitRate: 90,
    ...over,
  };
}

function session(id: string, name: string, importedAt: string, over: Partial<ProfilingSummary>): ProfilingSession {
  return {
    id, name, source: 'csv-stats', projectPath: '', importedAt, durationMs: 0, frameCount: 0,
    summary: summary(over), frameSamples: [], actorProfiles: [], memoryAllocations: [], gcPauses: [],
  };
}

function finding(id: string, over: Partial<PerformanceFinding> = {}): PerformanceFinding {
  return {
    id, priority: 'medium', category: 'tick', title: id, description: '', estimatedSavingsMs: 1,
    involvedClasses: [], fixPrompt: '', checklistLabel: '', metric: 'm', metricValue: 10, metricThreshold: 5,
    ...over,
  };
}

const OLDER = session('sess-older', 'older-capture', '2026-09-01T10:00:00.000Z', { avgFrameMs: 20, budgetHitRate: 55 });
const NEWER = session('sess-newer', 'newer-capture', '2026-09-01T11:00:00.000Z', { avgFrameMs: 15, budgetHitRate: 80 });

function row(s: ProfilingSession) {
  return { id: s.id, name: s.name, source: s.source, importedAt: s.importedAt, frameCount: s.frameCount,
    avgFPS: s.summary.avgFPS, hasTriage: false, overallScore: null, bottleneck: null };
}

const BASE_FINDINGS = [finding('tick-freq-BP_Enemy', { estimatedSavingsMs: 3.2 }), finding('gc-pause-long', { metricValue: 8 })];
const HEAD_FINDINGS = [finding('gc-pause-long', { metricValue: 5 }), finding('draw-calls-high', { title: 'Draw calls high' })];

function compareResponse() {
  const c = compareSessions(OLDER.summary, NEWER.summary, BASE_FINDINGS, HEAD_FINDINGS);
  const side = (s: ProfilingSession) => ({ id: s.id, name: s.name, importedAt: s.importedAt,
    frameBudgetMs: s.summary.frameBudgetMs, overallScore: 60, bottleneck: 'game-thread' });
  return { base: side(OLDER), head: side(NEWER), ...c };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  usePerformanceProfilingStore.setState(INITIAL, true);
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    let data: unknown = {};
    if (body.action === 'list-sessions') data = { sessions: [row(NEWER), row(OLDER)] };
    else if (body.action === 'get-session') data = { session: body.sessionId === OLDER.id ? OLDER : NEWER, triage: null };
    else if (body.action === 'compare') data = compareResponse();
    return { json: async () => ({ success: true, data }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  usePerformanceProfilingStore.setState({ activeSession: NEWER, sessionList: [row(NEWER), row(OLDER)] });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('PerformanceProfilingView — session rail + compare', () => {
  it('the rail lists both sessions; clicking the older one reopens it via loadSession', async () => {
    const real = usePerformanceProfilingStore.getState().loadSession;
    const loadSpy = vi.fn(real);
    usePerformanceProfilingStore.setState({ loadSession: loadSpy });

    render(<PerformanceProfilingView />);
    const rail = await screen.findByRole('list', { name: /profiling sessions/i });
    expect(within(rail).getByText('newer-capture')).toBeTruthy();
    expect(within(rail).getByText('older-capture')).toBeTruthy();

    fireEvent.click(within(rail).getByRole('button', { name: /open session older-capture/i }));
    expect(loadSpy).toHaveBeenCalledWith(OLDER.id);
    await waitFor(() => expect(screen.getByText(/older-capture · 0 frames/)).toBeTruthy());
  });

  it('pick base and head, then Compare -> one store compare() call and the rendered diff', async () => {
    const real = usePerformanceProfilingStore.getState().compare;
    const compareSpy = vi.fn(real);
    usePerformanceProfilingStore.setState({ compare: compareSpy });

    render(<PerformanceProfilingView />);
    fireEvent.click(await screen.findByRole('button', { name: /use older-capture as baseline/i }));
    fireEvent.click(screen.getByRole('button', { name: /use newer-capture as head/i }));
    fireEvent.click(screen.getByRole('button', { name: /^compare/i }));

    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy).toHaveBeenCalledWith(OLDER.id, NEWER.id);
    expect(await screen.findByText('resolved 1 · introduced 1 · persisting 1')).toBeTruthy();
    const frameRow = screen.getByRole('row', { name: /avg frame/i });
    expect(within(frameRow).getByText('-5.0 ms')).toBeTruthy();
  });
});
