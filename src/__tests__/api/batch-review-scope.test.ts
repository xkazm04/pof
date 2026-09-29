/**
 * POST /api/feature-matrix/batch-review — the batch SCOPE contract.
 *
 * The body is typed as `BatchReviewStartRequest` (src/types/batch-review.ts): an
 * optional `moduleIds` subset lets the Quality tab review only its stale set (or one
 * module) instead of every module with definitions. Omitted = the Scanner tab's
 * "Review All Modules", unchanged. An unknown id refuses the whole request and names
 * the id — nothing is started.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { BatchReviewStartRequest, BatchReviewState } from '@/types/batch-review';

const startExecution = vi.fn<(...args: unknown[]) => string>(() => 'exec-1');

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: (...args: unknown[]) => startExecution(...args),
  // Every review settles immediately — the background loop never sleeps.
  getExecution: () => ({ status: 'completed', events: [], listeners: new Set(), process: null }),
  subscribeToExecution: () => () => {},
  abortExecution: () => {},
}));

vi.mock('@/lib/cli-task', () => ({
  TaskFactory: { featureReview: () => ({}) },
  buildTaskPrompt: () => 'prompt',
  extractCallbackPayload: () => null,
  resolveCallback: async () => {},
}));

type Route = typeof import('@/app/api/feature-matrix/batch-review/route');
let route: Route;

beforeEach(async () => {
  // The route keeps its batch in module state — load a fresh copy per case.
  vi.resetModules();
  startExecution.mockClear();
  route = await import('@/app/api/feature-matrix/batch-review/route');
});

function post(body: BatchReviewStartRequest): NextRequest {
  return new NextRequest('http://localhost/api/feature-matrix/batch-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function currentBatch(): Promise<BatchReviewState | null> {
  const res = await route.GET();
  const json = await res.json();
  return json.data.batch;
}

describe('batch-review scope (moduleIds)', () => {
  it('scopes the batch to exactly the requested modules', async () => {
    const res = await route.POST(post({ projectPath: '/p', moduleIds: ['arpg-combat', 'arpg-loot'] }));
    expect(res.status).toBe(200);
    const batch = await currentBatch();
    expect(batch?.modules.map((m) => m.moduleId)).toEqual(['arpg-combat', 'arpg-loot']);
  });

  it('refuses an unknown module id with a 400 that names it, and starts nothing', async () => {
    const res = await route.POST(
      post({ projectPath: '/p', moduleIds: ['arpg-combat', 'not-a-module' as never] }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('not-a-module');
    expect(await currentBatch()).toBeNull();
    expect(startExecution).not.toHaveBeenCalled();
  });

  it('[guard] without moduleIds the batch covers every module with definitions', async () => {
    const { MODULE_FEATURE_DEFINITIONS } = await import('@/lib/feature-definitions');
    const withDefs = Object.values(MODULE_FEATURE_DEFINITIONS).filter((d) => (d?.length ?? 0) > 0).length;
    const res = await route.POST(post({ projectPath: '/p' }));
    expect(res.status).toBe(200);
    const batch = await currentBatch();
    expect(batch?.modules.length).toBe(withDefs);
    expect(withDefs).toBeGreaterThan(2);
  });
});
