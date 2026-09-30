import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useLatestTriage } from '@/components/modules/core-engine/sub_debug/_shared/useLatestTriage';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import type { PerformanceFinding, ProfilingSession, ProfileSourceType } from '@/types/performance-profiling';

/**
 * Acceptance for scan-sweep --challenge card debug-performance/B: the queue's
 * data comes through the Debug tab's ONE reader (useDebugSnapshot) - list,
 * newest session, its triage (run when missing) and the compare against the
 * previous real capture. No capture -> 'no-capture' after the single list read.
 */

afterEach(cleanup);

interface Row { id: string; source: ProfileSourceType; importedAt: string; hasTriage: boolean }

const FINDING: PerformanceFinding = {
  id: 'tick-freq-BP_Enemy', priority: 'critical', category: 'tick', title: 'BP_Enemy ticks at 60Hz',
  description: 'd', estimatedSavingsMs: 1.5, involvedClasses: ['BP_Enemy'], fixPrompt: 'Set TickInterval 0.1f',
  checklistLabel: 'Optimize BP_Enemy tick rate', metric: 'tickFrequencyHz', metricValue: 60, metricThreshold: 10,
};

let calls: Array<Record<string, unknown>>;

function mockProfiler(rows: Row[]) {
  calls = [];
  const envelope = (data: unknown) => ({ json: async () => ({ success: true, data }) });
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push(body);
    if (body.action === 'list-sessions') {
      return envelope({ sessions: rows.map((r) => ({ ...r, name: r.id, frameCount: 1, avgFPS: 60, overallScore: null, bottleneck: null })) });
    }
    if (body.action === 'get-session') {
      const row = rows.find((r) => r.id === body.sessionId);
      const session: ProfilingSession | null = row ? { ...SAMPLE_SESSION, id: row.id, name: row.id, source: row.source, importedAt: row.importedAt } : null;
      return envelope({ session, triage: null });
    }
    if (body.action === 'triage') {
      return envelope({ triage: { sessionId: body.sessionId, findings: [FINDING], overallScore: 40, bottleneck: 'game-thread', generatedAt: 'x' } });
    }
    if (body.action === 'compare') {
      const head = { id: body.headId, name: 'h', importedAt: 'x', frameBudgetMs: 16.67, overallScore: 40, bottleneck: 'game-thread' };
      return envelope({
        base: { ...head, id: body.baseId }, head, comparable: true, metrics: [],
        findings: { resolved: [], introduced: [], persisting: [] }, resolvedFindings: [], introducedFindings: [],
        realizedSavingsMs: 0, overall: 'unchanged',
      });
    }
    return envelope(null);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  usePerformanceProfilingStore.setState({ sessionList: [], activeSession: null, error: null, isLoading: false });
});

describe('useLatestTriage', () => {
  it('no sessions -> no-capture after exactly one fetch', async () => {
    mockProfiler([]);
    const { result } = renderHook(() => useLatestTriage());
    await waitFor(() => expect(result.current.kind).toBe('no-capture'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('newest untriaged + older -> triages the newest, compares older -> newest, exposes both', async () => {
    const newest: Row = { id: 'n1', source: 'csv-stats', importedAt: '2026-09-30T10:00:00.000Z', hasTriage: false };
    const older: Row = { id: 'o1', source: 'csv-stats', importedAt: '2026-09-29T10:00:00.000Z', hasTriage: true };
    mockProfiler([newest, older]);
    const { result } = renderHook(() => useLatestTriage());
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(calls).toContainEqual({ action: 'triage', sessionId: 'n1' });
    expect(calls).toContainEqual({ action: 'compare', baseId: 'o1', headId: 'n1' });
    const latest = result.current;
    if (latest.kind !== 'ready') throw new Error('not ready');
    expect(latest.triage?.findings).toEqual([FINDING]);
    expect(latest.comparison?.base.id).toBe('o1');
    expect(latest.session).toMatchObject({ id: 'n1', source: 'csv-stats' });
  });
});
