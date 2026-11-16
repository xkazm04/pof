/**
 * The upsert's COALESCE exists to keep the stored label when none is sent, but the route
 * bound `label ?? ''`, so COALESCE never saw NULL and every re-date blanked the label.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-milestone-label-${process.pid}.db`;
});

import { GET, PUT } from '@/app/api/milestone-deadlines/route';

const put = (body: unknown) => PUT(new NextRequest('http://localhost/api/milestone-deadlines', { method: 'PUT', body: JSON.stringify(body) }));
const read = async () => ((await (await GET()).json()) as { data: Record<string, { targetDate: string; label: string }> }).data;

describe('milestone deadline label', () => {
  it('a re-date without a label keeps the stored label', async () => {
    await put({ milestoneId: 'm1', targetDate: '2026-12-01', label: 'Alpha' });
    await put({ milestoneId: 'm1', targetDate: '2026-12-15' });
    expect(await read()).toMatchObject({ m1: { targetDate: '2026-12-15', label: 'Alpha' } });
  });

  it('a sent label replaces it, and a first write without one stores empty', async () => {
    await put({ milestoneId: 'm2', targetDate: '2026-12-01', label: 'A' });
    await put({ milestoneId: 'm2', targetDate: '2026-12-01', label: 'B' });
    await put({ milestoneId: 'm3', targetDate: '2026-12-01' });
    expect(await read()).toMatchObject({ m2: { label: 'B' }, m3: { label: '' } });
  });
});
