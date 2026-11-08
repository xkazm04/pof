/**
 * canonStore.remove must report a refused DELETE and keep the law in the cache: the server
 * (which prompts read) still holds it, so dropping it locally reads as done when it is not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanonStore } from '@/components/layout-lab/canonStore';

const RULE = { id: 'r1', category: 'game' as const, scope: 'global' as const, title: 'T', body: 'B' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  useCanonStore.setState({ rules: [RULE], loadDrift: vi.fn(async () => {}) });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('canonStore.remove', () => {
  it('a 500 returns the failure and keeps the rule', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { success: false, error: 'db locked' })));
    const r = await useCanonStore.getState().remove('r1');
    expect(r.ok).toBe(false);
    expect(useCanonStore.getState().rules.map((x) => x.id)).toEqual(['r1']);
  });

  it('a network error returns the failure and keeps the rule', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const r = await useCanonStore.getState().remove('r1');
    expect(r.ok).toBe(false);
    expect(useCanonStore.getState().rules.map((x) => x.id)).toEqual(['r1']);
  });

  it('a 200 removes the rule', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true, data: null })));
    const r = await useCanonStore.getState().remove('r1');
    expect(r.ok).toBe(true);
    expect(useCanonStore.getState().rules).toEqual([]);
  });
});
