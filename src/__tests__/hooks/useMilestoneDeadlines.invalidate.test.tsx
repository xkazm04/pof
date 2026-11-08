/**
 * The roadmap writes deadlines; the NBA cache must see the write. Drives the real
 * roadmap hook's save path against a mocked fetch seam.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

const { tryApiFetch } = vi.hoisted(() => ({ tryApiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', async (orig) => ({ ...(await orig<typeof import('@/lib/api-utils')>()), tryApiFetch }));
vi.mock('@/stores/projectHealthStore', () => ({
  useProjectHealthStore: (sel: (s: unknown) => unknown) => sel({
    milestones: [], summary: {}, fetchHealth: vi.fn(), error: null,
  }),
}));

import { useMilestoneDeadlines, __resetMilestoneDeadlineCache } from '@/hooks/useMilestoneDeadlines';
import { useCalendarRoadmapView } from '@/components/modules/evaluator/CalendarRoadmapView/useCalendarRoadmapView';

let server: Record<string, { targetDate: string }> = {};
const gets = () => tryApiFetch.mock.calls.filter((c) => !(c[1] as RequestInit | undefined)?.method).length;

beforeEach(() => {
  __resetMilestoneDeadlineCache();
  server = {};
  tryApiFetch.mockReset();
  tryApiFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const b = JSON.parse(init.body as string);
      server = { ...server, [b.milestoneId]: { targetDate: b.targetDate } };
      return { ok: true, data: {} };
    }
    return { ok: true, data: { ...server } };
  });
});
afterEach(cleanup);

describe('milestone deadlines: roadmap save reaches the NBA cache', () => {
  it('re-reads after a roadmap save and serves the new deadline', async () => {
    const nba = renderHook(() => useMilestoneDeadlines());
    const road = renderHook(() => useCalendarRoadmapView());
    await waitFor(() => expect(nba.result.current.state).toBe('ready'));
    // One shared read path: the NBA card and the roadmap together issued ONE get.
    expect(gets()).toBe(1);
    await act(async () => { await road.result.current.saveDeadline('m1', '2026-12-01'); });
    await waitFor(() => expect(nba.result.current.deadlines?.m1?.targetDate).toBe('2026-12-01'));
    expect(gets()).toBe(2);
  });
});
