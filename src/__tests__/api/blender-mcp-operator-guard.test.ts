/**
 * The Blender bridge runs Python with full OS access (`/api/blender-mcp/execute`) and opens a
 * raw TCP socket on `connect`. Both sit behind `requireOperator`, and connect accepts only a
 * loopback host and a valid port, so a cross-site request can neither run code nor turn the
 * server into a probe of an arbitrary address. `status` only probes and stays open.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ok } from '@/types/result';

const svc = {
  connect: vi.fn(async (host?: string, port?: number) => ok({ host: host ?? 'localhost', port: port ?? 9876, connected: true })),
  disconnect: vi.fn(),
  getStatus: vi.fn(() => ({ host: 'localhost', port: 9876, connected: false })),
  probe: vi.fn(async () => ({ host: 'localhost', port: 9876, connected: false })),
  executeCode: vi.fn<(code: string) => Promise<ReturnType<typeof ok<{ result: string }>>>>(async () => ok({ result: 'ran' })),
};

vi.mock('@/lib/blender-mcp/service', () => ({ getService: () => svc }));

const { POST: bridge } = await import('@/app/api/blender-mcp/route');
const { POST: execute } = await import('@/app/api/blender-mcp/execute/route');

function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: JSON.stringify(body),
  });
}

const FOREIGN = { origin: 'https://evil.example' };
const SAME = { origin: 'http://localhost:3001' };
const savedToken = process.env.POF_OPERATOR_TOKEN;

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  for (const fn of Object.values(svc)) fn.mockClear();
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('POST /api/blender-mcp/execute — operator guard', () => {
  it('refuses a foreign Origin with 403 and runs nothing', async () => {
    const res = await execute(req('/api/blender-mcp/execute', { code: 'import os' }, FOREIGN));
    expect(res.status).toBe(403);
    expect(svc.executeCode).not.toHaveBeenCalled();
  });

  it('refuses a call without the operator token when one is configured', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await execute(req('/api/blender-mcp/execute', { code: 'print(1)' }));
    expect(res.status).toBe(401);
    expect(svc.executeCode).not.toHaveBeenCalled();
  });

  it('runs same-origin code', async () => {
    const res = await execute(req('/api/blender-mcp/execute', { code: 'print(1)' }, SAME));
    expect(res.status).toBe(200);
    expect(svc.executeCode).toHaveBeenCalledWith('print(1)');
  });
});

describe('POST /api/blender-mcp — connect is guarded and loopback-only', () => {
  it('refuses a foreign-Origin connect with 403', async () => {
    const res = await bridge(req('/api/blender-mcp', { action: 'connect', host: 'localhost', port: 9876 }, FOREIGN));
    expect(res.status).toBe(403);
    expect(svc.connect).not.toHaveBeenCalled();
  });

  it('refuses a foreign-Origin disconnect with 403', async () => {
    const res = await bridge(req('/api/blender-mcp', { action: 'disconnect' }, FOREIGN));
    expect(res.status).toBe(403);
    expect(svc.disconnect).not.toHaveBeenCalled();
  });

  it.each(['10.0.0.5', '169.254.169.254', 'example.com', 42])('rejects non-loopback host %s with 400', async (host) => {
    const res = await bridge(req('/api/blender-mcp', { action: 'connect', host, port: 9876 }, SAME));
    expect(res.status).toBe(400);
    expect(svc.connect).not.toHaveBeenCalled();
  });

  it.each([0, 70000, 1.5, '9876'])('rejects invalid port %s with 400', async (port) => {
    const res = await bridge(req('/api/blender-mcp', { action: 'connect', host: '127.0.0.1', port }, SAME));
    expect(res.status).toBe(400);
    expect(svc.connect).not.toHaveBeenCalled();
  });

  it('connects same-origin to a loopback host, and to the defaults when none is given', async () => {
    expect((await bridge(req('/api/blender-mcp', { action: 'connect', host: 'localhost', port: 9876 }, SAME))).status).toBe(200);
    expect(svc.connect).toHaveBeenLastCalledWith('localhost', 9876);
    expect((await bridge(req('/api/blender-mcp', { action: 'connect' }, SAME))).status).toBe(200);
    expect(svc.connect).toHaveBeenLastCalledWith(undefined, undefined);
  });

  it('leaves status open to any caller', async () => {
    const res = await bridge(req('/api/blender-mcp', { action: 'status' }, FOREIGN));
    expect(res.status).toBe(200);
    expect(svc.probe).toHaveBeenCalledTimes(1);
  });
});
