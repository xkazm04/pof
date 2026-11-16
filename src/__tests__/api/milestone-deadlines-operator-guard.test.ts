/**
 * PUT /api/milestone-deadlines upserts or deletes a roadmap deadline that the NBA engine
 * ranks by, so it is operator-guarded like every other write: a cross-site browser request
 * is refused (403) and, when POF_OPERATOR_TOKEN is set, a call without the token (401).
 * GET stays open - it only reads.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-milestone-guard-${process.pid}.db`;
});

import { GET, PUT } from '@/app/api/milestone-deadlines/route';

const savedToken = process.env.POF_OPERATOR_TOKEN;
afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(new NextRequest('http://localhost/api/milestone-deadlines', { method: 'PUT', headers, body: JSON.stringify(body) }));
const read = async () => ((await (await GET()).json()) as { data: Record<string, { targetDate: string }> }).data;

describe('milestone-deadlines PUT operator guard', () => {
  it('refuses a write without the operator token when one is configured, and leaves the row alone', async () => {
    delete process.env.POF_OPERATOR_TOKEN;
    expect((await put({ milestoneId: 'g1', targetDate: '2026-12-01' })).status).toBe(200);
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await put({ milestoneId: 'g1', targetDate: '2027-01-01' });
    expect(res.status).toBe(401);
    expect((await put({ milestoneId: 'g1', targetDate: null })).status).toBe(401);
    expect((await read()).g1.targetDate).toBe('2026-12-01');
  });

  it('accepts the token, and refuses a cross-origin browser write in local mode', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const ok = await put({ milestoneId: 'g2', targetDate: '2026-12-02' }, { 'x-operator-token': 'secret' });
    expect(ok.status).toBe(200);
    delete process.env.POF_OPERATOR_TOKEN;
    const cross = await put({ milestoneId: 'g2', targetDate: '2027-02-02' }, { origin: 'http://evil.example', host: 'localhost' });
    expect(cross.status).toBe(403);
    expect((await read()).g2.targetDate).toBe('2026-12-02');
  });
});
