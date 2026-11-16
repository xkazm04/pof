/**
 * The discrepancy banner re-reads verdicts whenever the dashboard refreshes (batch settle).
 * Mount shape borrowed from the stale-review suite; original note: the stale count is an ACTION: mounted exactly as EvaluatorModule
 * mounts it (no props), it reviews only the stale set (or one selected module)
 * through the shared batch-review route, badges each heatmap cell from the live
 * batch, refreshes its roll-up once when the batch settles, and surfaces a 409
 * instead of failing silently.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import type { BatchReviewState, ModuleProgress, ModuleReviewStatus } from '@/types/batch-review';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const DAY = 86_400_000;
const ALL_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS);
const NEVER = 'arpg-combat';
const OLD = 'arpg-loot';

// ── Mocks ──────────────────────────────────────────────────────────────────────

let serverBatch: BatchReviewState | null = null;
let postImpl: (body: Record<string, unknown>) => Promise<unknown> = async () => ({ batchId: 'b' });
const apiFetch = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === '/api/feature-matrix/batch-review' && init?.method === 'POST') {
    return postImpl(JSON.parse(String(init.body)));
  }
  if (url === '/api/feature-matrix/batch-review') return { batch: serverBatch };
  throw new Error(`unexpected ${url}`);
});
const tryApiFetch = vi.fn(async (url: string) => {
  if (url.startsWith('/api/feature-matrix/history')) return { ok: true, data: { history: {} } };
  return { ok: true, data: [] };
});
vi.mock('@/lib/api-utils', () => ({
  apiFetch: (url: string, init?: RequestInit) => apiFetch(url, init),
  tryApiFetch: (url: string) => tryApiFetch(url),
}));

const refresh = vi.fn();
function aggregate(moduleId: string, lastReviewedAt: string): ModuleAggregate {
  return {
    moduleId: moduleId as SubModuleId, total: 2, implemented: 2, improved: 0, partial: 0,
    missing: 0, unknown: 0, avgQuality: 4, lastReviewedAt,
  } as ModuleAggregate;
}
const AGGREGATES = ALL_IDS.filter((id) => id !== NEVER).map((id) =>
  aggregate(id, new Date(NOW - (id === OLD ? 10 : 1) * DAY).toISOString()),
);
const BY_MODULE = new Map(AGGREGATES.map((a) => [a.moduleId as string, a]));
vi.mock('@/hooks/useModuleAggregates', () => ({
  useModuleAggregates: () => ({
    aggregates: AGGREGATES, byModule: BY_MODULE, isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh,
  }),
}));

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (sel: (s: unknown) => unknown) =>
    sel({ projectPath: '/proj', projectName: 'P', ueVersion: '5.5' }),
}));

import { AggregateQualityDashboard } from '@/components/modules/evaluator/AggregateQualityDashboard';

// ── Helpers ────────────────────────────────────────────────────────────────────

function progress(moduleId: string, status: ModuleReviewStatus): ModuleProgress {
  return {
    moduleId: moduleId as SubModuleId, label: moduleId, featureCount: 2, status,
    executionId: null, startedAt: null, completedAt: null, error: null,
  };
}
function batchOf(status: BatchReviewState['status'], mods: ModuleProgress[]): BatchReviewState {
  return { batchId: 'b1', status, startedAt: new Date(NOW).toISOString(), completedAt: null, modules: mods, currentIndex: 0 };
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const verdictCalls = () =>
  tryApiFetch.mock.calls.filter(([url]) => url === '/api/judge-verdicts').length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  serverBatch = null;
  postImpl = async () => ({ batchId: 'b' });
  apiFetch.mockClear();
  tryApiFetch.mockClear();
  refresh.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// ── Cases ──────────────────────────────────────────────────────────────────────

describe('QualityDiscrepancyBanner refresh', () => {
  it('re-reads verdicts when the batch settles and the dashboard refreshes', async () => {
    serverBatch = batchOf('running', [progress(NEVER, 'running')]);
    render(<AggregateQualityDashboard />);
    await flush();
    const before = verdictCalls();
    expect(before).toBe(1);
    serverBatch = batchOf('completed', [progress(NEVER, 'completed')]);
    await tick(3100);
    await tick(3100);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(verdictCalls()).toBe(before + 1);
  });
});
