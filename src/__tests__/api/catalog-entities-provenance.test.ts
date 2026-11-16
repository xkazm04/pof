/**
 * `/api/catalog-entities` as the AUTHORED-provenance door (WP1 criterion 4): an entity authored for
 * another game carries `{ kind: 'authored', canonProfile, authoredVia }`, round-trips through
 * `GET ?all=1`, and `canonProfileOf` / `gameOfEntity` place it in its game. An unregistered profile
 * and `kind: 'ingest'` are refused with 400 — ingest has its own path.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-catalog-entities-provenance-${process.pid}.db`;
});

import { GET, POST } from '@/app/api/catalog-entities/route';
import { listEntities, deleteEntity, type PersistedCatalogEntity } from '@/lib/catalog-db';
import { canonProfileOf } from '@/lib/catalog/canon/profiles';
import { gameOfEntity } from '@/lib/games/registry';

const CATALOG = 'bestiary';
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/catalog-entities', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
const getAll = async (): Promise<PersistedCatalogEntity[]> =>
  (await (await GET(new NextRequest('http://localhost/api/catalog-entities?all=1'))).json()).data.entities;
const authored = (over: Record<string, unknown> = {}) => ({ kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', ...over });

beforeEach(() => {
  for (const r of listEntities(CATALOG)) deleteEntity(CATALOG, r.entityId);
});

describe('POST /api/catalog-entities with provenance', () => {
  it('round-trips an authored canonProfile through GET ?all=1', async () => {
    const res = await post({ catalogId: CATALOG, entityId: 'gtai-beat-cop', name: 'Beat Cop', provenance: authored({ authoredAt: '2026-11-01T10:00:00.000Z' }) });
    expect(res.status).toBe(200);
    const row = (await getAll()).find((e) => e.entityId === 'gtai-beat-cop');
    expect(row?.entity.provenance).toEqual({ kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T10:00:00.000Z' });
    expect(canonProfileOf(row?.entity)).toBe('gtai');
    expect(gameOfEntity(row?.entity)).toBe('gtai');
  });

  it('defaults authoredAt to now', async () => {
    const t0 = Date.now();
    await post({ catalogId: CATALOG, entityId: 'gtai-ganger', name: 'Ganger', provenance: authored() });
    const p = listEntities(CATALOG)[0].entity.provenance;
    expect(p?.kind).toBe('authored');
    expect(Date.parse((p as { authoredAt: string }).authoredAt)).toBeGreaterThanOrEqual(t0 - 1000);
  });

  it('rejects an unregistered canon profile with 400, naming the registered ones', async () => {
    const res = await post({ catalogId: CATALOG, entityId: 'gtai-x', name: 'X', provenance: authored({ canonProfile: 'gta3' }) });
    expect(res.status).toBe(400);
    const err = (await res.json()).error as string;
    expect(err).toContain('gta3');
    expect(err).toMatch(/pof.*diablo1.*gtai/);
    expect(listEntities(CATALOG)).toHaveLength(0);
  });

  it('rejects kind "ingest" with 400 (ingest has its own path)', async () => {
    const res = await post({
      catalogId: CATALOG, entityId: 'gtai-x', name: 'X',
      provenance: { kind: 'ingest', canonProfile: 'diablo1', sourceGame: 'g', sourceProject: 'p', sourceFile: 'f', sourceRow: 'r', licenceNote: 'l', ingestedAt: 'now' },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ingest/);
    expect(listEntities(CATALOG)).toHaveLength(0);
  });

  it('rejects an unknown authoredVia and a malformed authoredAt', async () => {
    expect((await post({ catalogId: CATALOG, entityId: 'gtai-x', name: 'X', provenance: authored({ authoredVia: 'magic' }) })).status).toBe(400);
    expect((await post({ catalogId: CATALOG, entityId: 'gtai-x', name: 'X', provenance: authored({ authoredAt: 'yesterday' }) })).status).toBe(400);
  });

  it('a re-POST without provenance keeps the stored one (an edit does not move the entity to PoF)', async () => {
    await post({ catalogId: CATALOG, entityId: 'gtai-boss', name: 'Boss', provenance: authored() });
    await post({ catalogId: CATALOG, entityId: 'gtai-boss', name: 'Boss v2' });
    const row = listEntities(CATALOG)[0];
    expect(row.entity.name).toBe('Boss v2');
    expect(canonProfileOf(row.entity)).toBe('gtai');
  });

  it('an entity posted without provenance stays PoF’s (unchanged behaviour)', async () => {
    await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'Wight' });
    const row = listEntities(CATALOG)[0];
    expect(row.entity.provenance).toBeUndefined();
    expect(gameOfEntity(row.entity)).toBe('pof');
  });
});
