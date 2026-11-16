/**
 * The entry of POST /api/ue5-bridge/build: this route spawns UnrealBuildTool, so what it
 * accepts is what reaches a process. The queue is mocked; nothing here spawns anything.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/db', async () => {
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  return { getDb: () => db };
});

const { enqueueMock } = vi.hoisted(() => ({ enqueueMock: vi.fn() }));
vi.mock('@/lib/ue5-bridge/build-queue', () => ({
  buildQueue: { enqueue: enqueueMock, abort: vi.fn(), getStatus: vi.fn(), getQueue: vi.fn(() => []) },
}));

import { POST } from '@/app/api/ue5-bridge/build/route';

const savedToken = process.env.POF_OPERATOR_TOKEN;
const start = { action: 'start', projectPath: 'C:\\Proj', targetName: 'Did', ueVersion: '5.8.0' };

function raw(body: string, headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost:3001/api/ue5-bridge/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001', ...headers },
    body,
  }) as unknown as NextRequest;
}
const post = (body: unknown, headers?: Record<string, string>) => raw(JSON.stringify(body), headers);

beforeEach(() => {
  delete process.env.POF_OPERATOR_TOKEN;
  enqueueMock.mockReset();
  enqueueMock.mockReturnValue('build-new');
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

describe('operator guard', () => {
  it('refuses a cross-site browser request before anything is enqueued', async () => {
    const res = await POST(post(start, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('requires the operator token when one is configured', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    expect((await POST(post(start))).status).toBe(401);
    expect(enqueueMock).not.toHaveBeenCalled();
    expect((await POST(post(start, { 'x-operator-token': 'secret' }))).status).toBe(200);
  });

  it('still serves the same-origin app and the header-less MCP tool', async () => {
    expect((await POST(post(start, { origin: 'http://localhost:3001' }))).status).toBe(200);
    expect((await POST(post(start))).status).toBe(200);
  });
});

describe('malformed bodies', () => {
  it.each(['not json', 'null', '[1]', '"start"'])('answers %s with 400, not 500', async (body) => {
    const res = await POST(raw(body));
    expect(res.status).toBe(400);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe('start fields reaching the UBT argv', () => {
  it.each([
    ['platform', 'x; rm'],
    ['platform', 7],
    ['configuration', 'Nope'],
    ['targetType', '-Clean'],
    ['additionalArgs', 'abc'],
    ['additionalArgs', ['-ok', 5]],
    ['moduleId', 5],
  ])('refuses %s = %j', async (field, value) => {
    const res = await POST(post({ ...start, [field]: value }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain(field);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('accepts the declared values and still defaults the omitted ones', async () => {
    const res = await POST(post({ ...start, platform: 'Linux', configuration: 'Shipping', targetType: 'Game', additionalArgs: ['-NoHotReload'], moduleId: 'arpg-combat' }));
    expect(res.status).toBe(200);
    expect(enqueueMock.mock.calls[0][0]).toMatchObject({ platform: 'Linux', configuration: 'Shipping', targetType: 'Game', additionalArgs: ['-NoHotReload'] });

    enqueueMock.mockClear();
    await POST(post(start));
    expect(enqueueMock.mock.calls[0][0]).toMatchObject({ platform: 'Win64', configuration: 'Development', targetType: 'Editor' });
  });
});
