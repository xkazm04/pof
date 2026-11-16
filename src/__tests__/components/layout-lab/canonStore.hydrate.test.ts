/**
 * canonStore.hydrate must not present the offline seed as the DB: a failed read records why
 * (`hydrateError`), an empty-but-ok table and a good read clear it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanonStore } from '@/components/layout-lab/canonStore';

const RULE = { id: 'r1', category: 'game' as const, scope: 'global' as const, title: 'T', body: 'B' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { useCanonStore.setState({ hydrated: false, hydrateError: null }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('canonStore.hydrate', () => {
  it('a 500 sets hydrateError and keeps the seed rules', async () => {
    const seed = useCanonStore.getState().rules;
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { success: false, error: 'db locked' })));
    await useCanonStore.getState().hydrate();
    expect(useCanonStore.getState().hydrateError).toContain('db locked');
    expect(useCanonStore.getState().rules).toBe(seed);
  });

  it('a later good read clears the error and adopts the DB rules', async () => {
    useCanonStore.setState({ hydrateError: 'stale' });
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true, data: [RULE] })));
    await useCanonStore.getState().hydrate();
    expect(useCanonStore.getState().hydrateError).toBeNull();
    expect(useCanonStore.getState().rules).toEqual([RULE]);
  });
});
