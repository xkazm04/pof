/**
 * GET /api/catalog?catalogId= answers an unknown catalog with 404 like its siblings
 * (/entities, /lifecycle); a known catalog with no rows stays 200 [], and an unregistered
 * synthetic catalog that holds rows (loot-filter) stays 200.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-catalog-get-unknown-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/catalog/route';
import { GET as entitiesGET } from '@/app/api/catalog/entities/route';
import { seededEntities } from '@/lib/catalog/seed';
import { upsertLifecycle, listLifecycle } from '@/lib/catalog-db';

const get = (id: string) => GET(new NextRequest(`http://localhost/api/catalog?catalogId=${id}`));

describe('GET /api/catalog — unknown catalog', () => {
  it('404s a typo, agreeing with /api/catalog/entities', async () => {
    expect((await get('itemz')).status).toBe(404);
    expect((await entitiesGET(new NextRequest('http://localhost/api/catalog/entities?catalogId=itemz'))).status).toBe(404);
  });

  it('still 400s a missing catalogId', async () => {
    expect((await GET(new NextRequest('http://localhost/api/catalog'))).status).toBe(400);
  });

  it('keeps 200 [] for a known catalog with no lifecycle rows', async () => {
    expect(seededEntities('spellbook').length).toBeGreaterThan(0);
    expect(listLifecycle('spellbook')).toEqual([]);
    const res = await get('spellbook');
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it('keeps 200 for an unregistered synthetic catalog that holds rows', async () => {
    upsertLifecycle({ catalogId: 'loot-filter', entityId: 'f1', lifecycle: 'planned', ueAssets: [] });
    const res = await get('loot-filter');
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(1);
  });
});
