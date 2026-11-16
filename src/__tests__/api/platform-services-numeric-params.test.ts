/**
 * Numeric query params on the platform-services read routes are validated before they
 * reach SQLite: a non-numeric, fractional or negative `limit` / `offset` / `trendLimit`
 * is the caller's error (400 naming the param) — never a NaN bound into `LIMIT ?`
 * (a 500, or a silently unbounded read for a negative LIMIT).
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-platform-numeric-params-${process.pid}.db`;
});

import { GET as historyGET } from '@/app/api/packaging/history/route';
import { GET as scanGET } from '@/app/api/module-scan/import/route';

const get = (handler: (r: NextRequest) => Promise<Response>, url: string) =>
  handler(new NextRequest(`http://localhost/api/${url}`));

const BAD = ['abc', '-1', '2.5', ''];

describe('GET /api/packaging/history — numeric params', () => {
  it.each(BAD)('list refuses limit=%s with 400', async (v) => {
    const res = await get(historyGET, `packaging/history?action=list&limit=${v}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/limit/);
  });
  it.each(BAD)('list refuses offset=%s with 400', async (v) => {
    const res = await get(historyGET, `packaging/history?action=list&offset=${v}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/offset/);
  });
  it.each(BAD)('dashboard refuses trendLimit=%s with 400', async (v) => {
    const res = await get(historyGET, `packaging/history?action=dashboard&trendLimit=${v}`);
    expect(res.status).toBe(400);
  });
  it.each(BAD)('trend refuses limit=%s with 400', async (v) => {
    const res = await get(historyGET, `packaging/history?action=trend&limit=${v}`);
    expect(res.status).toBe(400);
  });
  it('defaults still answer 200', async () => {
    expect((await get(historyGET, 'packaging/history?action=list')).status).toBe(200);
    expect((await get(historyGET, 'packaging/history?action=list&limit=5&offset=0')).status).toBe(200);
    expect((await get(historyGET, 'packaging/history?action=trend')).status).toBe(200);
  });
});

describe('GET /api/module-scan/import — numeric params', () => {
  it.each(BAD)('refuses limit=%s with 400', async (v) => {
    const res = await get(scanGET, `module-scan/import?moduleId=arpg-combat&limit=${v}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/limit/);
  });
  it('defaults and a valid limit still answer 200', async () => {
    expect((await get(scanGET, 'module-scan/import?moduleId=arpg-combat')).status).toBe(200);
    expect((await get(scanGET, 'module-scan/import?moduleId=arpg-combat&limit=5000')).status).toBe(200);
  });
});
