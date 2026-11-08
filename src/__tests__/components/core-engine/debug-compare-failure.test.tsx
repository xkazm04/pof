import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, waitFor, cleanup } from '@testing-library/react';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import type { PerformanceFinding } from '@/types/performance-profiling';

/**
 * scan-sweep night 2026-11-08 (debug-performance, error-handler): when an earlier
 * real capture EXISTS but the compare request fails, the queue used to say
 * "No earlier real capture to compare with" - a false statement about the
 * operator's data. A failed compare is reported as a failed compare.
 */

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));

import { useDebugSnapshot } from '@/components/modules/core-engine/sub_debug/_shared/useDebugSnapshot';
import { OptimizationQueue } from '@/components/modules/core-engine/sub_debug/performance/OptimizationQueue';

afterEach(cleanup);
beforeEach(() => {
  usePerformanceProfilingStore.setState({ sessionList: [], activeSession: null, error: null, isLoading: false });
});

const FINDING: PerformanceFinding = {
  id: 'f1', priority: 'high', category: 'tick', title: 'BP_Enemy ticks at 60Hz',
  description: 'd', estimatedSavingsMs: 1, involvedClasses: [], fixPrompt: 'p',
  checklistLabel: 'l', metric: 'tickFrequencyHz', metricValue: 60, metricThreshold: 10,
};
const TRIAGE = { sessionId: 's2', findings: [FINDING], overallScore: 40, bottleneck: 'game-thread' as const, generatedAt: 'x' };

function mockProfiler(compareOk: boolean) {
  const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) });
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    if (body.action === 'list-sessions') {
      return ok({ sessions: ['s2', 's1'].map((id) => ({ id, name: id, source: 'csv-stats', importedAt: '2026-11-0' + (id === 's2' ? '2' : '1') + 'T00:00:00.000Z', frameCount: 1, avgFPS: 60, hasTriage: true, overallScore: 40, bottleneck: null })) });
    }
    if (body.action === 'get-session') {
      return ok({ session: { ...SAMPLE_SESSION, id: body.sessionId, name: body.sessionId, source: 'csv-stats' }, triage: TRIAGE });
    }
    if (body.action === 'compare') {
      return compareOk ? ok(null) : { json: async () => ({ success: false, error: 'base session s1 not found' }) };
    }
    return ok(null);
  }) as unknown as typeof fetch;
}

describe('compare failure', () => {
  it('hook: a base capture exists and compare fails -> compareError carries the route reason', async () => {
    mockProfiler(false);
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(result.current.latest.kind).toBe('ready'));
    const latest = result.current.latest;
    if (latest.kind !== 'ready') throw new Error('not ready');
    expect(latest.comparison).toBeNull();
    expect(latest.compareError).toBe('base session s1 not found');
  });

  it('queue: a failed compare is not reported as "no earlier capture"', () => {
    const { container } = render(<OptimizationQueue latest={{
      kind: 'ready', session: { id: 's2', name: 'boss arena', source: 'csv-stats', importedAt: 'x' },
      triage: TRIAGE, comparison: null, compareError: 'base session s1 not found',
    }} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/No earlier real capture/);
    expect(text).toMatch(/base session s1 not found/);
  });

  it('control: no base capture at all still says there is no earlier capture', () => {
    const { container } = render(<OptimizationQueue latest={{
      kind: 'ready', session: { id: 's2', name: 'boss arena', source: 'csv-stats', importedAt: 'x' },
      triage: TRIAGE, comparison: null,
    }} />);
    expect(container.textContent).toMatch(/No earlier real capture/);
  });
});

describe('triage failure', () => {
  function mockTriageFailure() {
    const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) });
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
      if (body.action === 'list-sessions') {
        return ok({ sessions: [{ id: 's2', name: 's2', source: 'csv-stats', importedAt: '2026-11-02T00:00:00.000Z', frameCount: 1, avgFPS: 60, hasTriage: false, overallScore: null, bottleneck: null }] });
      }
      if (body.action === 'get-session') return ok({ session: { ...SAMPLE_SESSION, id: 's2', name: 's2', source: 'csv-stats' }, triage: null });
      if (body.action === 'triage') return { json: async () => ({ success: false, error: 'profiling db locked' }) };
      return ok(null);
    }) as unknown as typeof fetch;
  }

  it('hook: a failed triage request -> triageError carries the route reason', async () => {
    mockTriageFailure();
    const { result } = renderHook(() => useDebugSnapshot());
    await waitFor(() => expect(result.current.latest.kind).toBe('ready'));
    const latest = result.current.latest;
    if (latest.kind !== 'ready') throw new Error('not ready');
    expect(latest.triage).toBeNull();
    expect(latest.triageError).toBe('profiling db locked');
  });

  it('queue: the note names the cause; without one it keeps the plain sentence', () => {
    const session = { id: 's2', name: 'boss arena', source: 'csv-stats' as const, importedAt: 'x' };
    const withErr = render(<OptimizationQueue latest={{ kind: 'ready', session, triage: null, comparison: null, triageError: 'profiling db locked' }} />);
    expect(withErr.container.textContent).toMatch(/Triage could not be run for boss arena: profiling db locked/);
    cleanup();
    const plain = render(<OptimizationQueue latest={{ kind: 'ready', session, triage: null, comparison: null }} />);
    expect(plain.container.textContent).toMatch(/Triage could not be run for boss arena\./);
  });
});
