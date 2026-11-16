import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { AnalyticsDashboard } from '@/types/session-analytics';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const ref = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/hooks/useSessionAnalytics', () => ({
  useSessionDashboard: () => ({ dashboard: ref.current, isLoading: false, error: null, retry: vi.fn(), refetch: vi.fn() }),
}));

import { SessionAnalyticsDashboard } from '@/components/modules/evaluator/SessionAnalyticsDashboard';

const mod = (moduleId: string, totalSessions: number, avgDurationMs = 90_000) => ({
  moduleId, totalSessions, successCount: totalSessions, failCount: 0, successRate: 1, avgDurationMs,
  contextInjectedCount: 0, contextInjectedSuccessRate: 0, noContextCount: 0, noContextSuccessRate: 0,
});
function board(over: Record<string, unknown> = {}): AnalyticsDashboard {
  return {
    totalSessions: 6, overallSuccessRate: 1, totalDurationMs: 540_000,
    moduleStats: [mod('arpg-loot', 1), mod('arpg-combat', 5)],
    insights: [], qualityScores: [], recentSessions: [], ...over,
  } as unknown as AnalyticsDashboard;
}

describe('Module Performance ordering', () => {
  it('sorts for display without reordering the hook-owned array', () => {
    const d = board();
    ref.current = d;
    const { container } = render(<SessionAnalyticsDashboard />);
    expect(d.moduleStats.map((m) => m.moduleId)).toEqual(['arpg-loot', 'arpg-combat']);
    const text = container.textContent ?? '';
    expect(text.indexOf('arpg-combat')).toBeLessThan(text.indexOf('arpg-loot'));
  });
});
