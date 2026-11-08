/** Entry contracts of /api/ue5-source/parse and /api/ue5-bridge/build-health. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import path from 'path';

const parseUE5AbilitySystem = vi.fn(async () => ({ abilities: [] }));
const getBuildHealthReport = vi.fn(() => ({ total: 0 }));
vi.mock('@/lib/ue5-source-parser', () => ({ parseUE5AbilitySystem }));
vi.mock('@/lib/ue5-bridge/build-health', () => ({ getBuildHealthReport }));

const { POST: parse } = await import('@/app/api/ue5-source/parse/route');
const { GET: health } = await import('@/app/api/ue5-bridge/build-health/route');

const ROOT = path.resolve('some-ue-project');
const parseReq = (raw: string) =>
  new NextRequest('http://localhost:3001/api/ue5-source/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
const healthReq = (qs: string) => new NextRequest(`http://localhost:3001/api/ue5-bridge/build-health?projectPath=p${qs}`);

beforeEach(() => {
  parseUE5AbilitySystem.mockClear();
  getBuildHealthReport.mockClear();
});

describe('POST /api/ue5-source/parse', () => {
  it.each(['{not json', 'null', '[]'])('answers 400 for body %s', async (raw) => {
    expect((await parse(parseReq(raw))).status).toBe(400);
  });

  it.each(['relative/p', `${ROOT}${path.sep}..${path.sep}x`])('refuses %s', async (p) => {
    expect((await parse(parseReq(JSON.stringify({ projectPath: p })))).status).toBe(400);
    expect(parseUE5AbilitySystem).not.toHaveBeenCalled();
  });

  it('accepts a trailing separator and a folder whose name contains dots', async () => {
    expect((await parse(parseReq(JSON.stringify({ projectPath: `${ROOT}${path.sep}` })))).status).toBe(200);
    expect((await parse(parseReq(JSON.stringify({ projectPath: `${ROOT}..v2` })))).status).toBe(200);
    expect(parseUE5AbilitySystem).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/ue5-bridge/build-health', () => {
  it.each(['abc', '0', '-5', '1.5', '10x'])('answers 400 for limit=%s', async (l) => {
    expect((await health(healthReq(`&limit=${l}`))).status).toBe(400);
    expect(getBuildHealthReport).not.toHaveBeenCalled();
  });

  it('defaults, passes through, and caps at 1000', async () => {
    await health(healthReq(''));
    await health(healthReq('&limit=50'));
    await health(healthReq('&limit=5000'));
    expect(getBuildHealthReport.mock.calls.map((c) => (c as unknown[])[1])).toEqual([
      { limit: 200 }, { limit: 50 }, { limit: 1000 },
    ]);
  });
});
