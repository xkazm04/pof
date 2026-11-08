/**
 * POST /api/feature-matrix/batch-review spawns the Claude CLI (with MCP enabled) once
 * per module, in the `projectPath` the BODY names. That is a process launch, so it is
 * operator-guarded like every other spawning route (experiment/run, intake/run, the
 * pipeline drains): `requireOperator` refuses a cross-site browser request (403) and,
 * when POF_OPERATOR_TOKEN is set, any call without the token (401). DELETE clears the
 * batch state and is guarded the same way. GET stays open — it only reads.
 *
 * Without the guard a drive-by page could POST a `text/plain` body (no CORS preflight;
 * the route never checks Content-Type) and launch agent runs in any directory.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const startExecution = vi.fn<(...args: unknown[]) => string>(() => 'exec-1');

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: (...args: unknown[]) => startExecution(...args),
  getExecution: () => ({ status: 'completed', events: [], listeners: new Set(), process: null }),
  subscribeToExecution: () => () => {},
  abortExecution: () => {},
}));

vi.mock('@/lib/cli-task', () => ({
  TaskFactory: { featureReview: () => ({}) },
  buildTaskPrompt: () => 'prompt',
  extractCallbackPayload: () => null,
  resolveCallback: async () => ({ success: true }),
}));

type Route = typeof import('@/app/api/feature-matrix/batch-review/route');
let route: Route;
const savedToken = process.env.POF_OPERATOR_TOKEN;

beforeEach(async () => {
  vi.resetModules();
  startExecution.mockClear();
  delete process.env.POF_OPERATOR_TOKEN;
  route = await import('@/app/api/feature-matrix/batch-review/route');
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.POF_OPERATOR_TOKEN;
  else process.env.POF_OPERATOR_TOKEN = savedToken;
});

function post(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3001/api/feature-matrix/batch-review', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', host: 'localhost:3001', ...headers },
    body: JSON.stringify({ projectPath: '/p', moduleIds: ['arpg-combat'] }),
  });
}

function del(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3001/api/feature-matrix/batch-review', {
    method: 'DELETE',
    headers: { host: 'localhost:3001', ...headers },
  });
}

describe('batch-review operator guard', () => {
  it('refuses a cross-site POST with 403 and spawns nothing', async () => {
    const res = await route.POST(post({ origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(startExecution).not.toHaveBeenCalled();
    const batch = (await (await route.GET()).json()).data.batch;
    expect(batch).toBeNull();
  });

  it('refuses a token-less POST with 401 when POF_OPERATOR_TOKEN is set', async () => {
    process.env.POF_OPERATOR_TOKEN = 'secret';
    const res = await route.POST(post({}));
    expect(res.status).toBe(401);
    expect(startExecution).not.toHaveBeenCalled();
  });

  it('still starts a same-origin POST', async () => {
    const res = await route.POST(post({ origin: 'http://localhost:3001' }));
    expect(res.status).toBe(200);
  });

  it('refuses a cross-site DELETE with 403', async () => {
    const res = await route.DELETE(del({ origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('still clears on a same-origin DELETE', async () => {
    const res = await route.DELETE(del({ origin: 'http://localhost:3001' }));
    expect(res.status).toBe(200);
  });
});
