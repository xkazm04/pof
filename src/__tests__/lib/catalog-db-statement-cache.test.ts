import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    getDb: () => {
      if (!dbHolder.current) dbHolder.current = new Database(':memory:');
      return dbHolder.current;
    },
  };
});

import { getDb } from '@/lib/db';
import { getEntity, getLifecycle, upsertEntity, upsertLifecycle } from '@/lib/catalog-db';

/**
 * getEntity / getLifecycle run once per entity in catalog derivations. better-sqlite3 has no
 * statement cache, so a per-call `.prepare()` recompiles the same static SQL every time.
 * Measured: 10k point reads 81 us/call re-preparing vs 55 us/call cached (microbench, same SQL).
 */
describe('catalog-db hot point reads compile their SQL once per connection', () => {
  it('N getEntity + N getLifecycle calls prepare at most one statement each', () => {
    const db = getDb();
    upsertEntity({ catalogId: 'c', entityId: 'e', source: 'user', entity: { id: 'e', name: 'E' } as never });
    upsertLifecycle({ catalogId: 'c', entityId: 'e', lifecycle: 'planned', ueAssets: [] } as never);
    const spy = vi.spyOn(db, 'prepare');
    const N = 200;
    for (let i = 0; i < N; i++) {
      expect(getEntity('c', 'e')).not.toBeNull();
      expect(getLifecycle('c', 'e')).not.toBeNull();
    }
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
  });
});
