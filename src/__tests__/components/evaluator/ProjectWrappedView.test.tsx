import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ProjectWrapped } from '@/types/project-wrapped';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const h = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: h.apiFetch };
});

import { ProjectWrappedView } from '@/components/modules/evaluator/ProjectWrappedView';

const WRAPPED: ProjectWrapped = {
  generatedAt: '2026-06-03T00:00:00.000Z',
  firstSessionDate: '2025-05-07',
  lastSessionDate: '2026-06-11',
  activeDays: 42,
  spanDays: 400,
  totalSessions: 318,
  successCount: 270,
  successRate: 0.849,
  totalTimeMs: 18_000_000, // 5h
  biggestWeek: { weekStart: '2025-05-05', sessions: 22, timeMs: 3_600_000, successRate: 0.9 },
  modulesTouched: 9,
  modulesConquered: 4,
  topModules: [
    { moduleId: 'arpg-combat', label: 'Combat', sessions: 120, successRate: 0.92, timeMs: 9_000_000 },
    { moduleId: 'arpg-loot', label: 'Loot', sessions: 60, successRate: 0.7, timeMs: 3_000_000 },
  ],
  longestStreak: 14,
  longestActiveDayStreak: 6,
  biggestDay: { date: '2025-05-07', sessions: 9 },
  milestones: [
    { date: '2025-05-07', type: 'first-session', title: 'The journey began', description: 'First session recorded', icon: '🌱' },
    { date: '2025-06-01', type: 'sessions', title: '100 sessions', description: 'Reached 100 total sessions', icon: '🚀' },
  ],
  achievements: [
    { id: 'lifetime-centurion', title: 'Centurion', description: '100+ lifetime sessions', icon: '💯' },
  ],
  monthlyActivity: [
    { month: '2025-05', sessions: 40, success: 34 },
    { month: '2025-06', sessions: 22, success: 18 },
  ],
};

describe('ProjectWrappedView', () => {
  it('renders the lifetime recap: hero stats, milestones, modules, achievements', async () => {
    h.apiFetch.mockResolvedValue({ wrapped: WRAPPED });

    render(<ProjectWrappedView />);

    // Hero + KPI strip derive from the fetched recap.
    expect(await screen.findByText('Project Wrapped')).toBeTruthy();
    expect(screen.getByText('318')).toBeTruthy();             // total sessions
    expect(screen.getByText('85%')).toBeTruthy();             // rounded success rate
    expect(screen.getByText('The journey began')).toBeTruthy(); // milestone
    expect(screen.getByText('100 sessions')).toBeTruthy();
    expect(screen.getByText('Centurion')).toBeTruthy();        // achievement
    expect(screen.getByText('Combat')).toBeTruthy();           // top module
  });

  it('copies a markdown recap to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    h.apiFetch.mockResolvedValue({ wrapped: WRAPPED });

    render(<ProjectWrappedView />);
    fireEvent.click(await screen.findByRole('button', { name: /Copy/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('# POF Project Wrapped');
  });

  it('shows an empty state when there is no session history', async () => {
    h.apiFetch.mockResolvedValue({
      wrapped: { ...WRAPPED, totalSessions: 0 },
    });

    render(<ProjectWrappedView />);
    expect(await screen.findByText(/No journey to wrap up yet/)).toBeTruthy();
  });
});
