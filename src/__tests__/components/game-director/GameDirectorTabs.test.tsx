import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { DirectorStats } from '@/lib/game-director-db';
import { STATUS_ERROR, STATUS_BLOCKER } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// Drive the module's data without any network round-trip. The mock factory reads
// statsRef.current at render time, so tests set it before render.
const statsRef: { current: DirectorStats | null } = { current: null };

vi.mock('@/hooks/useGameDirector', () => ({
  useGameDirector: () => ({
    sessions: [],
    stats: statsRef.current,
    trend: [],
    loading: false,
    simulating: false,
    refresh: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    simulatePlaytest: vi.fn(),
    getFindings: vi.fn().mockResolvedValue([]),
    getEvents: vi.fn().mockResolvedValue([]),
    updateTriage: vi.fn(),
  }),
}));

import { GameDirectorModule } from '@/components/modules/game-director/GameDirectorModule';

// jsdom serializes inline hex colors to rgb(); compare against that form.
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function makeStats(over: Partial<DirectorStats>): DirectorStats {
  return {
    totalSessions: 3, completedSessions: 2, totalFindings: 9,
    criticalFindings: 0, openCriticalHigh: 0, activeAlerts: 0,
    avgScore: 70, recentSessions: [], ...over,
  };
}

describe('GameDirectorModule nav pills', () => {
  it('shows a red findings pill when open criticals exist, and an alerts pill', () => {
    statsRef.current = makeStats({ criticalFindings: 2, openCriticalHigh: 3, activeAlerts: 4 });
    render(<GameDirectorModule />);

    const findingsPill = screen.getByLabelText('3 open critical or high findings');
    expect(findingsPill.textContent).toBe('3');
    expect((findingsPill as HTMLElement).style.backgroundColor).toBe(rgbOf(STATUS_ERROR));

    const alertsPill = screen.getByLabelText('4 active regression alerts');
    expect(alertsPill.textContent).toBe('4');
    expect((alertsPill as HTMLElement).style.backgroundColor).toBe(rgbOf(STATUS_ERROR));
  });

  it('tints the findings pill with the blocker color when only highs are open', () => {
    statsRef.current = makeStats({ criticalFindings: 0, openCriticalHigh: 2, activeAlerts: 0 });
    render(<GameDirectorModule />);

    const findingsPill = screen.getByLabelText('2 open critical or high findings');
    expect((findingsPill as HTMLElement).style.backgroundColor).toBe(rgbOf(STATUS_BLOCKER));
    // No active alerts → no regressions pill.
    expect(screen.queryByLabelText(/active regression alert/)).toBeNull();
  });

  it('renders no pills when there is nothing urgent', () => {
    statsRef.current = makeStats({ criticalFindings: 0, openCriticalHigh: 0, activeAlerts: 0 });
    render(<GameDirectorModule />);
    expect(screen.queryByLabelText(/open critical or high finding/)).toBeNull();
    expect(screen.queryByLabelText(/active regression alert/)).toBeNull();
  });
});
