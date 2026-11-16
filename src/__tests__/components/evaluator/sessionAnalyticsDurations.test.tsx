import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

describe('session durations use the shared format', () => {
  it('90s reads 1m 30s on the tile, module detail and recent row', () => {
    ref.current = board({
      totalSessions: 1, totalDurationMs: 90_000, moduleStats: [mod('arpg-combat', 1)],
      recentSessions: [{ id: 1, moduleId: 'arpg-combat', sessionKey: 'k', prompt: 'p', promptPreview: 'p', hadProjectContext: false, promptLength: 1, success: true, durationMs: 90_000, startedAt: '', completedAt: '' }],
    });
    render(<SessionAnalyticsDashboard />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getAllByText('1m 30s')).toHaveLength(3);
    expect(screen.queryByText('2m')).toBeNull();
  });

  it('a fractional average never prints decimals of a millisecond', () => {
    ref.current = board({ totalSessions: 3, totalDurationMs: 2000, moduleStats: [mod('arpg-combat', 3, 666.6667)] });
    render(<SessionAnalyticsDashboard />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getAllByText('667ms')).toHaveLength(2);
  });
});
