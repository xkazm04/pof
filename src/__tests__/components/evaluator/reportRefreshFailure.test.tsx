import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { WeeklyDigest } from '@/types/weekly-digest';
import type { ProjectWrapped } from '@/types/project-wrapped';

afterEach(cleanup);

const h = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: h.apiFetch };
});

import { WeeklyDigestView } from '@/components/modules/evaluator/WeeklyDigestView';
import { ProjectWrappedView } from '@/components/modules/evaluator/ProjectWrappedView';

const DIGEST: WeeklyDigest = {
  periodStart: '2026-09-28', periodEnd: '2026-10-05', zone: 'UTC',
  checklistCompleted: 0, checklistTotal: 100, checklistDelta: 0,
  totalSessions: 4, successRate: 0.75, totalTimeMs: 120_000,
  mostActiveModule: null, moduleActivity: [], longestStreak: 2, currentStreak: 1,
  achievements: [], dailySessions: [], prevWeekSessions: 2, prevWeekSuccessRate: 0.5,
};
const WRAPPED = {
  generatedAt: '2026-06-03T00:00:00.000Z', zone: 'UTC',
  firstSessionDate: '2025-05-07', lastSessionDate: '2026-06-11',
  activeDays: 42, spanDays: 400, totalSessions: 318, successCount: 270, successRate: 0.849,
  totalTimeMs: 18_000_000, biggestWeek: null, modulesTouched: 9, modulesConquered: 4,
  topModules: [], longestStreak: 14, longestActiveDayStreak: 6, biggestDay: null,
  milestones: [], achievements: [], monthlyActivity: [],
} as ProjectWrapped;

beforeEach(() => h.apiFetch.mockReset());

describe('a failed reload of a loaded report is disclosed, not swallowed', () => {
  it('WeeklyDigestView says the step failed and which week is still on screen', async () => {
    h.apiFetch.mockResolvedValueOnce({ digest: DIGEST }).mockRejectedValueOnce(new Error('db locked'));
    render(<WeeklyDigestView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Previous week' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('db locked');
    expect(alert.textContent).toContain('Sep 28');
  });

  it('ProjectWrappedView says the refresh failed', async () => {
    h.apiFetch.mockResolvedValueOnce({ wrapped: WRAPPED }).mockRejectedValueOnce(new Error('db locked'));
    render(<ProjectWrappedView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh recap' }));
    expect((await screen.findByRole('alert')).textContent).toContain('db locked');
  });
});
