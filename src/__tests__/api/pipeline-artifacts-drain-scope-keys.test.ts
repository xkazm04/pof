/**
 * POST /api/pipeline-artifacts/drain — a scope key that was SENT but did not parse.
 *
 * f62f5e06 refused an unparseable body so a truncated single-entity request could no longer
 * read as `{}` (= the global drain). The same widening survived one level down: a well-formed
 * object whose scope value is the wrong type or empty (`entityId: 42`, `entityId: ""`,
 * `tier: "l3"`, `entityIds: []`) was silently dropped by `parseDrainFilter`, so the request ran
 * a WIDER drain than it named — a catalog-wide or global drain booting UE for every gate.
 * A named scope key that resolves to nothing is now a 400 naming the key; drainAll never runs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { drainAllMock, collectDeferredMock } = vi.hoisted(() => ({
  collectDeferredMock: vi.fn(() => [] as unknown[]),
  drainAllMock: vi.fn(async () => ({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] })),
}));

vi.mock('@/lib/test-gate-runner', async () => {
  const actual = await vi.importActual<typeof import('@/lib/test-gate-runner')>('@/lib/test-gate-runner');
  return { ...actual, buildExecutors: vi.fn().mockReturnValue([]), drainAll: drainAllMock, collectDeferred: collectDeferredMock };
});

import { GET, POST, __resetDrainInFlight } from '@/app/api/pipeline-artifacts/drain/route';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/pipeline-artifacts/drain', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

beforeEach(() => {
  __resetDrainInFlight();
  drainAllMock.mockClear();
  collectDeferredMock.mockClear();
});

describe('POST /api/pipeline-artifacts/drain — a sent scope key never widens the drain', () => {
  it.each([
    ['entityId', { catalogId: 'items', entityId: 42 }],
    ['entityId', { catalogId: 'items', entityId: '' }],
    ['catalogId', { catalogId: ['items'] }],
    ['tier', { catalogId: 'items', entityId: 'item-1', tier: 'l3' }],
    ['entityIds', { catalogId: 'items', entityIds: [] }],
    ['entityIds', { catalogId: 'items', entityIds: [7, ''] }],
  ])('refuses an unparsed %s with 400 instead of draining wider', async (key, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(key);
    expect(drainAllMock).not.toHaveBeenCalled();
  });

  it('still runs a well-formed single-entity drain with exactly that scope', async () => {
    const res = await post({ catalogId: 'items', entityId: 'item-1', tier: 'L3' });
    expect(res.status).toBe(200);
    expect(drainAllMock).toHaveBeenCalledTimes(1);
    expect((drainAllMock.mock.calls[0] as unknown[])[1]).toEqual({ catalogId: 'items', entityId: 'item-1', tier: 'L3' });
  });

  it('treats an explicit null scope key as absent (no widening claim was made)', async () => {
    const res = await post({ catalogId: 'items', entityId: null });
    expect(res.status).toBe(200);
    expect((drainAllMock.mock.calls[0] as unknown[])[1]).toEqual({ catalogId: 'items' });
  });

  // autoCapture is the L4 opt-in to RENDER a frame; without projectPath the route dropped it and
  // the visual gates stayed deferred under a 200, so the caller believed a capture had run.
  it('refuses autoCapture without projectPath instead of silently not capturing', async () => {
    const res = await post({ catalogId: 'items', entityId: 'item-1', tier: 'L4', autoCapture: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('projectPath');
    expect(drainAllMock).not.toHaveBeenCalled();
  });

  it('still treats an empty object as the explicit global drain', async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect((drainAllMock.mock.calls[0] as unknown[])[1]).toEqual({});
  });
});

const get = (query: string) => GET(new NextRequest(`http://localhost/api/pipeline-artifacts/drain${query}`));

describe('GET /api/pipeline-artifacts/drain — the preview refuses what POST refuses', () => {
  it.each([
    ['tier', '?catalogId=items&tier=l3'],
    ['entityId', '?catalogId=items&entityId='],
    ['entityIds', '?catalogId=items&entityIds='],
    ['catalogId', '?catalogId='],
  ])('refuses an unparsed %s with 400 instead of previewing a wider queue', async (key, query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(key);
    expect(collectDeferredMock).not.toHaveBeenCalled();
  });

  it('still previews a well-formed scope, and an unscoped GET', async () => {
    expect((await get('?catalogId=items&entityId=item-1&tier=L3')).status).toBe(200);
    expect(collectDeferredMock).toHaveBeenLastCalledWith({ catalogId: 'items', entityId: 'item-1', tier: 'L3' });
    expect((await get('')).status).toBe(200);
    expect(collectDeferredMock).toHaveBeenLastCalledWith({});
  });
});

describe('POST /api/pipeline-artifacts/drain — a sent numeric option never silently disappears', () => {
  it.each([
    ['limit', { catalogId: 'items', limit: -5 }],
    ['port', { catalogId: 'items', port: -1 }],
  ])('refuses a non-positive %s with 400 instead of draining under a 200', async (key, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(key);
    expect(drainAllMock).not.toHaveBeenCalled();
  });

  it('still honours a valid limit', async () => {
    expect((await post({ catalogId: 'items', limit: 2 })).status).toBe(200);
    expect((drainAllMock.mock.calls[0] as unknown[])[2]).toEqual({ limit: 2 });
  });
});
