import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionActivityCard } from '@/components/ecw/mission/SessionActivityCard';
import type { AnalyticsDashboard } from '@/types/session-analytics';

const { crud } = vi.hoisted(() => ({ crud: vi.fn() }));
vi.mock('@/hooks/useCRUD', () => ({ useCRUD: () => crud() }));

function moduleStat(moduleId: string, totalSessions: number, successRate: number) {
  return { moduleId, totalSessions, successCount: Math.round(totalSessions * successRate), failCount: 0, successRate, avgDurationMs: 1000, avgSuccessDurationMs: 1000, avgFailDurationMs: 0, contextInjectedCount: 0, contextInjectedSuccessRate: 0 };
}

function mockData(over: Partial<AnalyticsDashboard>, isLoading = false) {
  const data: AnalyticsDashboard = {
    totalSessions: 0, overallSuccessRate: 0, totalDurationMs: 0, moduleStats: [], insights: [], qualityScores: [], recentSessions: [], ...over,
  };
  crud.mockReturnValue({ data, isLoading, error: null, refetch: vi.fn(), retry: vi.fn(), mutate: vi.fn() });
}

describe('SessionActivityCard', () => {
  afterEach(cleanup);

  it('shows total sessions and overall success rate', () => {
    mockData({
      totalSessions: 12, overallSuccessRate: 0.75,
      moduleStats: [moduleStat('arpg-combat', 8, 0.875), moduleStat('arpg-loot', 4, 0.5)] as AnalyticsDashboard['moduleStats'],
    });
    render(<SessionActivityCard />);
    expect(screen.getByText('CLI Activity')).toBeTruthy();
    expect(screen.getByText('75% success')).toBeTruthy();
    expect(screen.getByText(/12 sessions/i)).toBeTruthy();
  });

  it('lists the most active modules', () => {
    mockData({
      totalSessions: 12, overallSuccessRate: 0.75,
      moduleStats: [moduleStat('arpg-combat', 8, 0.875), moduleStat('arpg-loot', 4, 0.5)] as AnalyticsDashboard['moduleStats'],
    });
    render(<SessionActivityCard />);
    expect(screen.getByText(/Most active/i)).toBeTruthy();
    expect(screen.getByText('arpg-combat')).toBeTruthy();
  });

  it('shows an empty state when no sessions are recorded', () => {
    mockData({});
    render(<SessionActivityCard />);
    expect(screen.getByText(/no cli sessions recorded yet/i)).toBeTruthy();
  });
});
