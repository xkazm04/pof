/**
 * /api/ue5-bridge/query can run console commands and call any UFUNCTION in the live editor. The
 * connection manager is mocked here, so no test touches a real Remote Control server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const client = {
  getProperty: vi.fn(async () => ({ ok: true, data: 1 })),
  setProperty: vi.fn(async () => ({ ok: true, data: 1 })),
  callFunction: vi.fn(async () => ({ ok: true, data: 1 })),
  searchAssets: vi.fn(async () => ({ ok: true, data: [] })),
  describeObject: vi.fn(async () => ({ ok: true, data: {} })),
  executeConsoleCommand: vi.fn(async () => ({ ok: true, data: 'done' })),
};
const conn = {
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(),
  getClient: vi.fn((): typeof client | null => client),
  getState: vi.fn(() => ({ status: 'connected' })),
};
vi.mock('@/lib/ue5-bridge/connection-manager', () => ({ ue5Connection: conn }));

const { POST } = await import('@/app/api/ue5-bridge/query/route');
const savedToken = process.env.POF_OPERATOR_TOKEN;

function req(raw: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3001/api/ue5-bridge/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body: raw,
  });
}

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  vi.clearAllMocks();
  conn.getClient.mockImplementation(() => client);
  conn.getState.mockImplementation(() => ({ status: 'connected' }));
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('POST /api/ue5-bridge/query', () => {
  it('refuses a foreign Origin before running a console command', async () => {
    const res = await POST(req('{"action":"consoleCommand","command":"quit"}', { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(client.executeConsoleCommand).not.toHaveBeenCalled();
  });

  it.each(['{not json', 'null', '[]', '"x"'])('answers 400 for body %s', async (raw) => {
    expect((await POST(req(raw))).status).toBe(400);
  });

  it('refuses an unknown action as 400 even while disconnected', async () => {
    conn.getClient.mockImplementation(() => null);
    conn.getState.mockImplementation(() => ({ status: 'disconnected' }));
    expect((await POST(req('{"action":"explode"}'))).status).toBe(400);
  });

  it.each([
    ['{"action":"connect","httpPort":"abc"}'],
    ['{"action":"connect","httpPort":70000}'],
    ['{"action":"connect","httpPort":1.5}'],
    ['{"action":"connect","host":5}'],
    ['{"action":"connect","host":"evil.example/x?"}'],
    ['{"action":"connect","host":"http://evil.example"}'],
  ])('refuses %s without connecting', async (raw) => {
    expect((await POST(req(raw))).status).toBe(400);
    expect(conn.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['{"action":"getProperty","objectPath":5,"propertyName":"a"}'],
    ['{"action":"setProperty","objectPath":"a","propertyName":["b"]}'],
    ['{"action":"callFunction","objectPath":"a","functionName":5}'],
    ['{"action":"callFunction","objectPath":"a","functionName":"f","parameters":5}'],
    ['{"action":"searchAssets","query":5}'],
    ['{"action":"describeObject","objectPath":{}}'],
  ])('answers 400 for %s', async (raw) => {
    expect((await POST(req(raw))).status).toBe(400);
    for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the shapes the app sends', async () => {
    expect((await POST(req('{"action":"connect","host":"127.0.0.1","httpPort":30010}'))).status).toBe(200);
    expect(conn.connect).toHaveBeenCalledWith('127.0.0.1', 30010);
    expect((await POST(req('{"action":"connect"}'))).status).toBe(200);
    expect((await POST(req('{"action":"disconnect"}'))).status).toBe(200);
    expect((await POST(req('{"action":"consoleCommand","command":"stat fps"}'))).status).toBe(200);
    expect((await POST(req('{"action":"setProperty","objectPath":"a","propertyName":"b","value":0}'))).status).toBe(200);
  });
});
