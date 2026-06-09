import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted so the vi.mock factory (also hoisted) can see them.
const { drainAllMock, pendingHolder } = vi.hoisted(() => {
  const holder = { resolve: null as ((v: unknown) => void) | null };
  const mock = vi.fn(() => new Promise((resolve) => { holder.resolve = resolve as (v: unknown) => void; }));
  return { drainAllMock: mock, pendingHolder: holder };
});

vi.mock('@/lib/test-gate-runner', () => ({
  buildExecutors: vi.fn().mockReturnValue([]),
  collectDeferred: vi.fn().mockReturnValue([]),
  drainAll: drainAllMock,
  // Faithful copy of the real helper (pure) so the in-flight scope/key logic still derives.
  parseDrainFilter: (get: (k: 'tier' | 'catalogId' | 'entityId') => string | null | undefined) => {
    const tier = get('tier');
    const catalogId = get('catalogId');
    const entityId = get('entityId');
    return {
      ...(tier === 'L3' || tier === 'L4' ? { tier } : {}),
      ...(catalogId ? { catalogId } : {}),
      ...(entityId ? { entityId } : {}),
    };
  },
}));

import { POST, __resetDrainInFlight } from '@/app/api/pipeline-artifacts/drain/route';

function postReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/pipeline-artifacts/drain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetDrainInFlight();
  drainAllMock.mockClear();
  // Restore the original deferred-promise behavior (overridden via mockImplementationOnce in some cases).
  drainAllMock.mockImplementation(() => new Promise((resolve) => { pendingHolder.resolve = resolve as (v: unknown) => void; }));
  pendingHolder.resolve = null;
});

describe('POST /api/pipeline-artifacts/drain — in-flight lock', () => {
  it('refuses an overlapping drain for the same catalog/entity with 409', async () => {
    const first = POST(postReq({ catalogId: 'items', entityId: 'item-1' }));
    // While the first drain is hanging on the unresolved promise, fire a second one.
    const second = await POST(postReq({ catalogId: 'items', entityId: 'item-1' }));
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/already in flight/i);
    expect(body.error).toContain('items/item-1');

    // Release the held drain so the first request can complete and the lock can free.
    pendingHolder.resolve?.({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] });
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
  });

  it('refuses an overlapping global drain (no filter) with 409', async () => {
    const first = POST(postReq({}));
    const second = await POST(postReq({}));
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toContain('global');

    pendingHolder.resolve?.({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] });
    await first;
  });

  it('allows two drains for different entities to run concurrently', async () => {
    // First drain uses the default deferred-promise implementation and stays hung.
    const first = POST(postReq({ catalogId: 'items', entityId: 'item-a' }));
    // Yield once so the first POST reaches `await drainAll(...)` and the lock is recorded.
    await new Promise((r) => setImmediate(r));
    const firstResolve = pendingHolder.resolve;
    expect(firstResolve).not.toBeNull(); // sanity: the first drain has actually started

    // Override only the next call so the second drain resolves immediately on a different scope.
    drainAllMock.mockImplementationOnce(async () => ({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] }));
    const second = await POST(postReq({ catalogId: 'items', entityId: 'item-b' }));
    expect(second.status).toBe(200);

    firstResolve?.({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] });
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
  });

  it('releases the lock after drainAll throws so subsequent drains can run', async () => {
    drainAllMock.mockImplementationOnce(async () => { throw new Error('executor blew up'); });

    const failing = await POST(postReq({ catalogId: 'items', entityId: 'item-x' }));
    expect(failing.status).toBe(500);

    // Same scope must now be runnable again — confirm we don't get a 409.
    drainAllMock.mockImplementationOnce(async () => ({ ran: 0, passed: 0, failed: 0, skipped: 0, results: [] }));
    const retry = await POST(postReq({ catalogId: 'items', entityId: 'item-x' }));
    expect(retry.status).toBe(200);
  });
});
