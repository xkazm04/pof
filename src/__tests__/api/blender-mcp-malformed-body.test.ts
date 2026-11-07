/**
 * A malformed request body is the caller's mistake, not a server fault. `/api/blender-mcp`
 * and `/api/blender-mcp/execute` read `await req.json()` straight inside `withRoute`, so a
 * non-JSON body threw a SyntaxError and a JSON `null` threw a TypeError on `body.action` /
 * `body.code`: both surfaced as a 500 carrying the raw engine message, logged as a server
 * error. They answer 400 now, and nothing reaches the bridge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ok } from '@/types/result';

const svc = {
  connect: vi.fn(async () => ok({ host: 'localhost', port: 9876, connected: true })),
  disconnect: vi.fn(),
  getStatus: vi.fn(() => ({ host: 'localhost', port: 9876, connected: false })),
  probe: vi.fn(async () => ({ host: 'localhost', port: 9876, connected: false })),
  executeCode: vi.fn(async () => ok({ output: 'ran', receipts: [] })),
};

vi.mock('@/lib/blender-mcp/service', () => ({ getService: () => svc }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { POST: bridge } = await import('@/app/api/blender-mcp/route');
const { POST: execute } = await import('@/app/api/blender-mcp/execute/route');

function rawReq(path: string, body: string) {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'localhost:3001',
      origin: 'http://localhost:3001',
    },
    body,
  });
}

const MALFORMED = ['{not json', 'null', '"connect"', '[1,2]'];

beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockClear();
});

describe('POST /api/blender-mcp — malformed body', () => {
  it.each(MALFORMED)('answers 400 for body %s and touches no bridge method', async (body) => {
    const res = await bridge(rawReq('/api/blender-mcp', body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(svc.connect).not.toHaveBeenCalled();
    expect(svc.disconnect).not.toHaveBeenCalled();
    expect(svc.probe).not.toHaveBeenCalled();
  });
});

describe('POST /api/blender-mcp/execute — malformed body', () => {
  it.each(MALFORMED)('answers 400 for body %s and runs nothing', async (body) => {
    const res = await execute(rawReq('/api/blender-mcp/execute', body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(svc.executeCode).not.toHaveBeenCalled();
  });
});
