import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlaytestsCard } from '@/components/ecw/mission/PlaytestsCard';
import type { DirectorStats } from '@/lib/game-director-db';

const { crud } = vi.hoisted(() => ({ crud: vi.fn() }));
vi.mock('@/hooks/useCRUD', () => ({ useCRUD: () => crud() }));

function mockData(over: Partial<DirectorStats>, isLoading = false) {
  const data: DirectorStats = { totalSessions: 0, completedSessions: 0, totalFindings: 0, criticalFindings: 0, avgScore: null, recentSessions: [], ...over };
  crud.mockReturnValue({ data, isLoading, error: null, refetch: vi.fn(), retry: vi.fn(), mutate: vi.fn() });
}

describe('PlaytestsCard', () => {
  afterEach(cleanup);

  it('shows session counts, avg score, and critical findings', () => {
    mockData({
      totalSessions: 5, completedSessions: 3, totalFindings: 12, criticalFindings: 2, avgScore: 78,
      recentSessions: [{ id: 's1', name: 'Boss balance pass', status: 'complete' }] as DirectorStats['recentSessions'],
    });
    render(<PlaytestsCard />);
    expect(screen.getByText('Playtests')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();
    expect(screen.getByText(/3 of 5 sessions complete/i)).toBeTruthy();
    expect(screen.getByText(/2 critical findings outstanding/i)).toBeTruthy();
    expect(screen.getByText('Boss balance pass')).toBeTruthy();
  });

  it('shows an empty state when no sessions exist', () => {
    mockData({});
    render(<PlaytestsCard />);
    expect(screen.getByText(/no playtest sessions yet/i)).toBeTruthy();
  });
});
