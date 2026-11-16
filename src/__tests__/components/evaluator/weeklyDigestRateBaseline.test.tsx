import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { WeeklyDigest } from '@/types/weekly-digest';

afterEach(cleanup);

const h = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, apiFetch: h.apiFetch };
});

import { WeeklyDigestView } from '@/components/modules/evaluator/WeeklyDigestView';
import { formatDigestMarkdown } from '@/components/modules/evaluator/WeeklyDigestView/helpers';

const DIGEST: WeeklyDigest = {
  periodStart: '2026-09-28', periodEnd: '2026-10-05', zone: 'UTC',
  checklistCompleted: 0, checklistTotal: 100, checklistDelta: 0,
  totalSessions: 4, successRate: 0.75, totalTimeMs: 120_000,
  mostActiveModule: null, moduleActivity: [], longestStreak: 2, currentStreak: 1,
  achievements: [], dailySessions: [], prevWeekSessions: 2, prevWeekSuccessRate: 0.5,
};
beforeEach(() => h.apiFetch.mockReset());

describe('a success rate with no sessions behind it is unmeasured, not 0%', () => {
  it('shows no delta when the previous week had no sessions', async () => {
    h.apiFetch.mockResolvedValue({ digest: { ...DIGEST, prevWeekSessions: 0, prevWeekSuccessRate: 0 } });
    render(<WeeklyDigestView />);
    expect(await screen.findByText('75%')).toBeTruthy();
    expect(screen.queryByText('+75%')).toBeNull();
  });

  it('shows a dash and no delta when the viewed week has no sessions', async () => {
    h.apiFetch.mockResolvedValue({ digest: { ...DIGEST, totalSessions: 0, successRate: 0, prevWeekSuccessRate: 0.8 } });
    render(<WeeklyDigestView />);
    expect(await screen.findByText('—')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByText('-80%')).toBeNull();
  });

  it('keeps a real delta when both weeks were measured', async () => {
    h.apiFetch.mockResolvedValue({ digest: DIGEST });
    render(<WeeklyDigestView />);
    expect(await screen.findByText('+25%')).toBeTruthy();
  });

  it('the markdown export carries the dash too', () => {
    const md = formatDigestMarkdown({ ...DIGEST, totalSessions: 0, successRate: 0 });
    expect(md).toContain('**Success Rate:** —');
  });
});
