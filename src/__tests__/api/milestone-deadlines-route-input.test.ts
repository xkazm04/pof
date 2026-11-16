/**
 * PUT /api/milestone-deadlines: only an explicit null or empty string clears a deadline.
 * A body that merely omitted targetDate used to DELETE the row, and an unparseable date
 * was stored where the NBA deadline engine reads it through new Date().
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-milestone-input-${process.pid}.db`;
});

import { GET, PUT } from '@/app/api/milestone-deadlines/route';

const put = (body: unknown) => PUT(new NextRequest('http://localhost/api/milestone-deadlines', { method: 'PUT', body: JSON.stringify(body) }));
const read = async () => ((await (await GET()).json()) as { data: Record<string, { targetDate: string }> }).data;

describe('PUT /api/milestone-deadlines input', () => {
  it('an omitted targetDate is refused and deletes nothing', async () => {
    await put({ milestoneId: 'keep', targetDate: '2026-12-01' });
    const res = await put({ milestoneId: 'keep' });
    expect(res.status).toBe(400);
    expect((await read()).keep?.targetDate).toBe('2026-12-01');
  });

  it.each([['not a date', 'soon'], ['an impossible date', '2026-13-45'], ['a number', 7]])('targetDate as %s -> 400', async (_l, targetDate) => {
    expect((await put({ milestoneId: 'bad', targetDate })).status).toBe(400);
    expect((await read()).bad).toBeUndefined();
  });

  it.each([
    ['milestoneId', { milestoneId: 7, targetDate: '2026-12-01' }],
    ['label', { milestoneId: 'm', targetDate: '2026-12-01', label: {} }],
  ])('a non-string %s -> 400', async (_l, body) => {
    expect((await put(body)).status).toBe(400);
  });

  it('null and empty string still clear the deadline', async () => {
    await put({ milestoneId: 'a', targetDate: '2026-12-01' });
    await put({ milestoneId: 'b', targetDate: '2026-12-01' });
    expect((await put({ milestoneId: 'a', targetDate: null })).status).toBe(200);
    expect((await put({ milestoneId: 'b', targetDate: '' })).status).toBe(200);
    const after = await read();
    expect(after.a).toBeUndefined();
    expect(after.b).toBeUndefined();
  });
});
