import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SCHEDULE } from '@/lib/packaging/build-scheduler';

vi.mock('@/lib/packaging/build-schedule-store', () => ({
  getSchedule: vi.fn(),
  setSchedule: vi.fn(),
  getScheduleState: vi.fn(),
  isRunning: vi.fn(() => false),
}));
vi.mock('@/lib/packaging/scheduled-build-runner', () => ({
  tickScheduler: vi.fn(() => ({ ran: false, reason: 'not due' })),
  startScheduledRun: vi.fn(() => ({ ran: true, reason: 'manual run started' })),
}));
vi.mock('@/lib/packaging/git-head', () => ({
  getGitHead: vi.fn(async () => 'abc123def456'),
  shortSha: (s: string | null) => (s ? s.slice(0, 8) : '(none)'),
}));

import { GET, POST } from '@/app/api/packaging/schedule/route';
import { getSchedule, setSchedule, getScheduleState } from '@/lib/packaging/build-schedule-store';
import { tickScheduler, startScheduledRun } from '@/lib/packaging/scheduled-build-runner';

const enabledSchedule = { ...DEFAULT_SCHEDULE, enabled: true, time: '02:00', projectPath: 'C:\\proj' };
const emptyState = { lastRunAt: null, lastCommit: null, lastOutcome: null, lastReason: null, lastBuildId: null, lastDurationMs: null };

beforeEach(() => {
  vi.clearAllMocks();
  (getSchedule as ReturnType<typeof vi.fn>).mockReturnValue(enabledSchedule);
  (getScheduleState as ReturnType<typeof vi.fn>).mockReturnValue(emptyState);
  (setSchedule as ReturnType<typeof vi.fn>).mockImplementation((p: object) => ({ ...enabledSchedule, ...p }));
});

function req(body: unknown): Request {
  return new Request('http://localhost:3000/api/packaging/schedule', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function json(res: Response) {
  return res.json() as Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
}

describe('GET /api/packaging/schedule', () => {
  it('returns schedule, state, nextRunAt and the current HEAD', async () => {
    const res = await GET(new Request('http://localhost:3000/api/packaging/schedule?projectPath=C:\\proj'));
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.data?.schedule).toEqual(enabledSchedule);
    expect(body.data?.state).toEqual(emptyState);
    expect(body.data).toHaveProperty('nextRunAt');
    expect(body.data?.currentHead).toBe('abc123def456');
  });
});

describe('POST /api/packaging/schedule', () => {
  it('saves a sanitized schedule patch', async () => {
    const res = await POST(req({ action: 'save', enabled: true, time: '03:15', days: [1, 3], skipIfUnchanged: false, profileId: 'p-2' }));
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(setSchedule).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, time: '03:15', days: [1, 3], skipIfUnchanged: false, profileId: 'p-2' }));
  });

  it('rejects an invalid time', async () => {
    const res = await POST(req({ action: 'save', time: '99:99' }));
    const body = await json(res);
    expect(body.success).toBe(false);
    expect(setSchedule).not.toHaveBeenCalled();
  });

  it('forwards run-now to startScheduledRun', async () => {
    const res = await POST(req({ action: 'run-now', projectPath: 'C:\\proj', projectName: 'PoF', ueVersion: '5.5' }));
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(startScheduledRun).toHaveBeenCalled();
    expect(body.data?.ran).toBe(true);
  });

  it('forwards tick to tickScheduler', async () => {
    const res = await POST(req({ action: 'tick' }));
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(tickScheduler).toHaveBeenCalled();
    expect(body.data?.ran).toBe(false);
  });

  it('rejects an unknown action', async () => {
    const res = await POST(req({ action: 'nope' }));
    const body = await json(res);
    expect(body.success).toBe(false);
  });
});
