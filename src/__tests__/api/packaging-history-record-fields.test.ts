/** A recorded build's status and numeric fields are validated before the row feeds the dashboard. */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-psa-history-${process.pid}.db`;
});

import { POST as historyPOST, GET as historyGET } from '@/app/api/packaging/history/route';

const post = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('POST /api/packaging/history — record fields', () => {
  const base = { platform: 'Win64', status: 'failed' };
  it.each([
    ['unknown status', { ...base, status: 'banana' }],
    ['string sizeBytes', { ...base, sizeBytes: 'big' }],
    ['negative durationMs', { ...base, durationMs: -1 }],
    ['non-string platform', { ...base, platform: 7 }],
  ])('refuses %s with 400 and stores nothing', async (_l, body) => {
    const count = async () => (await (await historyGET(new NextRequest('http://localhost/api/packaging/history?action=list'))).json()).data.builds.length;
    const before = await count();
    expect((await post(historyPOST, 'packaging/history', body)).status).toBe(400);
    expect(await count()).toBe(before);
  });
  it('records a valid build', async () => {
    expect((await post(historyPOST, 'packaging/history', { ...base, sizeBytes: 10 })).status).toBe(200);
  });
});
