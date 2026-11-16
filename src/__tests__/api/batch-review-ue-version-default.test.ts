/**
 * POST /api/feature-matrix/batch-review defaulted a missing `ueVersion` to a hardcoded
 * '5.5' while the project is on UE 5.8, steering every review prompt toward the wrong
 * engine. It now falls back to the shared DEFAULT_UE_VERSION (engine-facts), and an
 * explicit value still wins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_UE_VERSION } from '@/lib/engine-facts';

const buildTaskPrompt = vi.fn<(...args: unknown[]) => string>(() => 'prompt');

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: () => 'exec-1',
  getExecution: () => ({ status: 'completed', events: [], listeners: new Set(), process: null }),
  subscribeToExecution: () => () => {},
  abortExecution: () => {},
}));
vi.mock('@/lib/claude-terminal/run-settle', () => ({
  settleExecution: () => new Promise(() => {}),
}));
vi.mock('@/lib/cli-task', () => ({
  TaskFactory: { featureReview: () => ({}) },
  buildTaskPrompt: (...args: unknown[]) => buildTaskPrompt(...args),
  extractCallbackPayload: () => null,
  resolveCallback: async () => ({ success: true }),
}));

type Route = typeof import('@/app/api/feature-matrix/batch-review/route');
let route: Route;

beforeEach(async () => {
  vi.resetModules();
  buildTaskPrompt.mockClear();
  route = await import('@/app/api/feature-matrix/batch-review/route');
});

function post(extra: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3001/api/feature-matrix/batch-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001' },
    body: JSON.stringify({ projectPath: '/p', projectName: 'P', moduleIds: ['arpg-combat'], ...extra }),
  });
}

describe('batch-review ueVersion default', () => {
  it('uses the shared engine default (not 5.5) when the body omits ueVersion', async () => {
    const res = await route.POST(post({}));
    expect(res.status).toBe(200);
    expect(buildTaskPrompt).toHaveBeenCalledTimes(1);
    const ctx = buildTaskPrompt.mock.calls[0][1] as { ueVersion: string };
    expect(ctx.ueVersion).toBe(DEFAULT_UE_VERSION);
    expect(ctx.ueVersion).not.toBe('5.5');
  });

  it('keeps an explicit ueVersion', async () => {
    await route.POST(post({ ueVersion: '5.7.1' }));
    const ctx = buildTaskPrompt.mock.calls[0][1] as { ueVersion: string };
    expect(ctx.ueVersion).toBe('5.7.1');
  });
});
