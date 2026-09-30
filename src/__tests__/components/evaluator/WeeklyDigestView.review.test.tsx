/**
 * WeeklyDigestView reviews any week: a Prev/Next stepper drives ?weeksAgo, and the
 * Checklist card shows what LANDED in the viewed week (dated ledger) with a real delta.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { WeeklyDigest } from '@/types/weekly-digest';

// setup.ts has no afterEach(cleanup).
afterEach(cleanup);

const h = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: h.apiFetch };
});

import { WeeklyDigestView } from '@/components/modules/evaluator/WeeklyDigestView';
import { useModuleStore } from '@/stores/moduleStore';

const base: Omit<WeeklyDigest, 'periodStart' | 'periodEnd'> = {
  zone: 'UTC',
  checklistCompleted: 0, checklistTotal: 100, checklistDelta: 0,
  totalSessions: 4, successRate: 0.75, totalTimeMs: 120_000,
  mostActiveModule: null, moduleActivity: [], longestStreak: 2, currentStreak: 1,
  achievements: [], dailySessions: [], prevWeekSessions: 1, prevWeekSuccessRate: 0.5, // Sessions delta +3, never confused with the checklist's +2
};
const THIS_WEEK: WeeklyDigest = { ...base, periodStart: '2026-09-28', periodEnd: '2026-10-05' };
const LAST_WEEK: WeeklyDigest = { ...base, periodStart: '2026-09-21', periodEnd: '2026-09-28' };

beforeEach(() => {
  h.apiFetch.mockReset();
  h.apiFetch.mockImplementation(async (url: string) => ({
    digest: url.includes('weeksAgo=1') ? LAST_WEEK : THIS_WEEK,
  }));
  useModuleStore.setState({
    checklistProgress: { 'arpg-character': { 'ac-1': true, 'ac-2': true } },
    checklistCompletedAt: {
      'arpg-character': { 'ac-1': Date.parse('2026-09-29T10:00:00Z'), 'ac-2': Date.parse('2026-09-30T10:00:00Z') },
    },
  });
});

describe('WeeklyDigestView — week review', () => {
  it('the Checklist card shows the landed count with its delta vs the previous week', async () => {
    render(<WeeklyDigestView />);
    expect(await screen.findByText('2 landed')).toBeTruthy();
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByText('Character foundation package')).toBeTruthy();
  });

  it("'Next week' is disabled at weeksAgo 0; 'Previous week' requests ?weeksAgo=1", async () => {
    render(<WeeklyDigestView />);
    await screen.findByText('2 landed');
    const next = screen.getByRole('button', { name: 'Next week' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() => expect(h.apiFetch).toHaveBeenCalledWith('/api/weekly-digest?weeksAgo=1'));
    expect(await screen.findByText('0 landed')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next week' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
