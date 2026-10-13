import { describe, it, expect } from 'vitest';
import { rowToLifecycle } from '@/lib/catalog-db';
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

import { rowToLifecycle, rowToEntity, upsertLifecycle, upsertEntity } from '@/lib/catalog-db';

describe('rowToLifecycle', () => {
  it('maps a full row', () => {
    const rec = rowToLifecycle({
      catalog_id: 'spellbook', entity_id: 'off-fire-01', lifecycle: 'verified',
      ue_assets: '["/Script/PoF.GA_Fireball"]', last_test_result: 'pass',
      last_verified_at: '2026-05-24T00:00:00.000Z',
    });
    expect(rec).toEqual({
      catalogId: 'spellbook', entityId: 'off-fire-01', lifecycle: 'verified',
      ueAssets: ['/Script/PoF.GA_Fireball'], lastTestResult: 'pass',
      lastVerifiedAt: '2026-05-24T00:00:00.000Z',
    });
  });
  it('defaults empty ue_assets and omits null optionals', () => {
    const rec = rowToLifecycle({
      catalog_id: 'spellbook', entity_id: 'x', lifecycle: 'planned',
      ue_assets: '[]', last_test_result: null, last_verified_at: null,
    });
    expect(rec.ueAssets).toEqual([]);
    expect(rec.lastTestResult).toBeUndefined();
    expect(rec.lastVerifiedAt).toBeUndefined();
  });
});

describe('rowToLifecycle - a corrupt ue_assets blob (parity with rowToEntity and the feature-matrix reader)', () => {
  const base = { catalog_id: 'spellbook', entity_id: 'x', lifecycle: 'planned', last_test_result: null, last_verified_at: null };

  it('does not throw on unparseable JSON - one bad row must not fail the whole list', () => {
    expect(() => rowToLifecycle({ ...base, ue_assets: '{not json' })).not.toThrow();
    expect(rowToLifecycle({ ...base, ue_assets: '{not json' }).ueAssets).toEqual([]);
  });

  it('returns an array even when the blob is valid JSON of another shape (callers spread it)', () => {
    expect(rowToLifecycle({ ...base, ue_assets: '{"a":1}' }).ueAssets).toEqual([]);
    expect(rowToLifecycle({ ...base, ue_assets: '"str"' }).ueAssets).toEqual([]);
  });

  it('keeps only string paths from a mixed array', () => {
    expect(rowToLifecycle({ ...base, ue_assets: '["/Game/A", 3, null]' }).ueAssets).toEqual(['/Game/A']);
  });
});

describe('catalog-db table ensure across connection swap', () => {
  it('re-creates catalog_lifecycle and catalog_entities when getDb() returns a new Database instance', () => {
    dbHolder.current = new Database(':memory:');
    upsertLifecycle({ catalogId: 'spellbook', entityId: 'e1', lifecycle: 'planned', ueAssets: [] });
    upsertEntity({
      catalogId: 'spellbook',
      entityId: 'e1',
      source: 'user',
      entity: { id: 'e1', catalogId: 'spellbook', name: 'E1', categoryPath: [], tags: [], lifecycle: 'planned' },
    });

    // Swap to a brand-new connection; subsequent calls must not fail with "no such table"
    dbHolder.current = new Database(':memory:');
    const lc = upsertLifecycle({ catalogId: 'spellbook', entityId: 'e2', lifecycle: 'verified', ueAssets: [] });
    expect(lc.entityId).toBe('e2');
    const ent = upsertEntity({
      catalogId: 'spellbook',
      entityId: 'e2',
      source: 'user',
      entity: { id: 'e2', catalogId: 'spellbook', name: 'E2', categoryPath: [], tags: [], lifecycle: 'verified' },
    });
    expect(ent.entityId).toBe('e2');
  });
});
