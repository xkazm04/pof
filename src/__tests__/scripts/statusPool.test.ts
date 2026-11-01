import { describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from '@/../scripts/diablo/catalogs/types';
import { resolveStalenessPool } from '@/../scripts/diablo/catalogs/pool';

const db = {} as Database.Database;
const wrapper = (id: string) => ({ catalogId: 'bestiary', entity: { id } }) as unknown as ReferenceWrapper;

function handler(pool: CatalogHandler['pool']): CatalogHandler {
  return { catalogId: 'combat-map', pool };
}

describe('resolveStalenessPool', () => {
  it('passes the handler pool through when there is something promoted to compare', () => {
    const pool = vi.fn(() => [wrapper('d1-descent-warrior')]);
    const resolved = resolveStalenessPool(handler(pool), db, 'diablo1', [], 3);
    expect(resolved.pool?.map((w) => w.entity.id)).toEqual(['d1-descent-warrior']);
    expect(resolved.unavailable).toBeUndefined();
    expect(pool).toHaveBeenCalledWith(db, 'diablo1', []);
  });

  it('does not build a pool when nothing is promoted — the staleness question is vacuous', () => {
    const pool = vi.fn(() => [wrapper('x')]);
    expect(resolveStalenessPool(handler(pool), db, 'diablo1', [], 0)).toEqual({});
    expect(pool).not.toHaveBeenCalled();
  });

  it('reports the reason instead of throwing when an engine-derived pool cannot be built', () => {
    const pool = () => {
      throw new Error('the supplied wrappers have no d1-class-warrior aggregate');
    };
    const resolved = resolveStalenessPool(handler(pool), db, 'diablo1', [], 2);
    expect(resolved.pool).toBeUndefined();
    expect(resolved.unavailable).toBe('the supplied wrappers have no d1-class-warrior aggregate');
  });

  it('is a no-op for a handler that has no pool at all', () => {
    expect(resolveStalenessPool({ catalogId: 'currencies' }, db, 'diablo1', [], 9)).toEqual({});
    expect(resolveStalenessPool(undefined, db, 'diablo1', [], 9)).toEqual({});
  });
});
