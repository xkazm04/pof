/** A schedule weekday is a whole day 0-6; a fractional one matched no date and the schedule silently never ran. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-psa-schedule-${process.pid}.db`;
});

const setSchedule = vi.fn((p: object) => ({ enabled: false, time: '02:00', days: [], ...p }));
vi.mock('@/lib/packaging/build-schedule-store', () => ({
  getSchedule: () => ({ enabled: false, time: '02:00', days: [] }),
  setSchedule: (p: object) => setSchedule(p),
  getScheduleState: () => ({}),
  isRunning: () => false,
}));
vi.mock('@/lib/packaging/scheduled-build-runner', () => ({
  tickScheduler: () => ({ ran: false }),
  startScheduledRun: () => ({ ran: false }),
}));

import { POST as schedulePOST } from '@/app/api/packaging/schedule/route';

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

beforeEach(() => setSchedule.mockClear());

describe('POST /api/packaging/schedule — days', () => {
  it.each([[[2.5]], [[1, 6.5]]])('refuses fractional days %j', async (days) => {
    const res = await post(schedulePOST, 'packaging/schedule', { days });
    expect(res.status).toBe(400);
    expect(setSchedule).not.toHaveBeenCalled();
  });
  it('accepts whole weekdays', async () => {
    expect((await post(schedulePOST, 'packaging/schedule', { days: [0, 6] })).status).toBe(200);
  });
});
