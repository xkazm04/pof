/**
 * The compile and hot-patch POSTs start a Live Coding compile in the running editor (hot-patch
 * also writes a source file first). A cross-site request must not reach them, and a body that
 * is not the documented shape must be refused before anything is forwarded to the plugin.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as compile } from '@/app/api/pof-bridge/compile/route';
import { POST as hotPatch } from '@/app/api/pof-bridge/compile/hot-patch/route';

const realFetch = globalThis.fetch;
const savedToken = process.env.POF_OPERATOR_TOKEN;
let spy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  spy = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }) }));
  globalThis.fetch = spy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

function req(path: string, raw: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: raw,
  });
}

const COMPILE = '/api/pof-bridge/compile';
const PATCH = '/api/pof-bridge/compile/hot-patch';
const FOREIGN = { origin: 'https://evil.example' };

describe('POST /api/pof-bridge/compile', () => {
  it('refuses a foreign Origin and starts nothing', async () => {
    const res = await compile(req(COMPILE, '{}', FOREIGN));
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['{not json', 'null', '[]', '"x"'])('answers 400 for body %s', async (raw) => {
    const res = await compile(req(COMPILE, raw));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([['"60"'], ['-1'], ['0'], ['1e12']])('refuses timeoutSeconds %s', async (v) => {
    const res = await compile(req(COMPILE, `{"timeoutSeconds":${v}}`));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses a non-boolean waitForComplete', async () => {
    const res = await compile(req(COMPILE, '{"waitForComplete":"yes"}'));
    expect(res.status).toBe(400);
  });

  it('forwards the shape the app sends', async () => {
    const res = await compile(req(COMPILE, '{"waitForComplete":true,"timeoutSeconds":120}'));
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/compile/live');
  });
});

describe('POST /api/pof-bridge/compile/hot-patch', () => {
  const good = { filePath: 'Source/PoF/Foo.cpp', fileContent: 'int x;' };

  it('refuses a foreign Origin and writes nothing', async () => {
    const res = await hotPatch(req(PATCH, JSON.stringify(good), FOREIGN));
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['{not json', 'null', '[]'])('answers 400 for body %s', async (raw) => {
    const res = await hotPatch(req(PATCH, raw));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [{ filePath: 5, fileContent: 'x' }],
    [{ filePath: 'a.cpp', fileContent: 5 }],
    [{ filePath: '../../Windows/evil.cpp', fileContent: 'x' }],
    [{ filePath: 'Source\\..\\..\\evil.cpp', fileContent: 'x' }],
  ])('refuses %j', async (body) => {
    const res = await hotPatch(req(PATCH, JSON.stringify(body)));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards a well-formed patch', async () => {
    const res = await hotPatch(req(PATCH, JSON.stringify(good)));
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe('http://127.0.0.1:30040/pof/compile/hot-patch');
  });
});
