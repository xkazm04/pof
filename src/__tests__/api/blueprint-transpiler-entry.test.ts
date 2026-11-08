/** Entry contract of the Blueprint transpiler and its write-to-project route. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import path from 'path';

const planWrite = vi.fn(async () => ({ files: [] }));
const applyWrite = vi.fn(async () => ({ written: [] }));
vi.mock('@/lib/blueprint-transpiler-write', async (orig) => ({
  ...(await orig<typeof import('@/lib/blueprint-transpiler-write')>()),
  planWrite,
  applyWrite,
}));

const { POST: transpile } = await import('@/app/api/blueprint-transpiler/route');
const { POST: write } = await import('@/app/api/blueprint-transpiler/write/route');
const savedToken = process.env.POF_OPERATOR_TOKEN;

function req(url: string, raw: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3001${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: raw,
  });
}

const ROOT = path.resolve('some-ue-project');
const base = { projectPath: ROOT, moduleName: 'PoF', className: 'UFoo', header: 'h', source: 's' };
const approved = [{ relPath: 'Source/PoF/UFoo.h', before: '' }];

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  planWrite.mockClear();
  applyWrite.mockClear();
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('POST /api/blueprint-transpiler', () => {
  const URL_ = '/api/blueprint-transpiler';
  it.each(['{not json', 'null', '[]'])('answers 400 for body %s', async (raw) => {
    expect((await transpile(req(URL_, raw))).status).toBe(400);
  });

  it.each(['5', 'true', '[1]'])('refuses blueprintJson of %s', async (v) => {
    expect((await transpile(req(URL_, `{"action":"parse","blueprintJson":${v}}`))).status).toBe(400);
  });
});

describe('POST /api/blueprint-transpiler/write', () => {
  const URL_ = '/api/blueprint-transpiler/write';
  const post = (body: unknown, headers?: Record<string, string>) => write(req(URL_, JSON.stringify(body), headers));

  it('refuses a foreign Origin', async () => {
    const res = await post({ ...base, confirm: true, approved }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(applyWrite).not.toHaveBeenCalled();
  });

  it.each(['{not json', 'null', '[]'])('answers 400 for body %s', async (raw) => {
    expect((await write(req(URL_, raw))).status).toBe(400);
  });

  it.each([
    [{ ...base, projectPath: 'relative/project' }],
    [{ ...base, projectPath: `${ROOT}${path.sep}..${path.sep}other` }],
    [{ ...base, projectPath: 5 }],
    [{ ...base, moduleName: ['PoF'] }],
    [{ ...base, moduleName: '../Evil' }],
    [{ ...base, className: 'a b' }],
    [{ ...base, header: 5 }],
    [{ ...base, source: {} }],
  ])('refuses %j', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(planWrite).not.toHaveBeenCalled();
  });

  it('refuses a confirm that carries no reviewed plan', async () => {
    expect((await post({ ...base, confirm: true })).status).toBe(400);
    expect(applyWrite).not.toHaveBeenCalled();
  });

  it.each([[[null]], [[{ relPath: 5, before: '' }]], [[{ relPath: 'a' }]], ['x']])(
    'refuses a malformed approved plan %j',
    async (bad) => {
      expect((await post({ ...base, confirm: true, approved: bad })).status).toBe(400);
      expect(applyWrite).not.toHaveBeenCalled();
    },
  );

  it('a dry run and a reviewed confirm both proceed', async () => {
    expect((await post({ ...base, confirm: false })).status).toBe(200);
    expect(planWrite).toHaveBeenCalledTimes(1);
    expect((await post({ ...base, confirm: true, approved })).status).toBe(200);
    expect(applyWrite).toHaveBeenCalledTimes(1);
  });
});
