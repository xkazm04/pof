import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

const realGetContext = HTMLCanvasElement.prototype.getContext;
afterEach(() => { HTMLCanvasElement.prototype.getContext = realGetContext; });

function failClipboard() {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
}
function failCanvas() {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof realGetContext;
}

describe.each([
  ['WeeklyDigestView', () => { h.apiFetch.mockResolvedValue({ digest: DIGEST }); render(<WeeklyDigestView />); }],
  ['ProjectWrappedView', () => { h.apiFetch.mockResolvedValue({ wrapped: WRAPPED }); render(<ProjectWrappedView />); }],
])('%s share failures', (_name, mount) => {
  it('a refused clipboard write says so', async () => {
    failClipboard();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Copy/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/copy/i);
  });

  it('a failed poster render reports and frees the button', async () => {
    failCanvas();
    mount();
    const btn = await screen.findByRole('button', { name: /Share as Image/ }) as HTMLButtonElement;
    fireEvent.click(btn);
    expect((await screen.findByRole('alert')).textContent).toMatch(/image/i);
    await waitFor(() => expect(btn.disabled).toBe(false));
  });
});
