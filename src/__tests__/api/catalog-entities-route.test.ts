/**
 * `/api/catalog-entities` — a client makes a user-created entity RESOLVABLE by the server
 * through this route, never by writing SQLite itself. The id-collision refusal is the
 * load-bearing case: a code seed always wins the union in `seededEntities`, so a persisted
 * row with a seed's id would be silently inert — it is refused with the collision named.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-catalog-entities-route-${process.pid}.db`;
});

import { GET, POST, DELETE } from '@/app/api/catalog-entities/route';
import { listEntities, deleteEntity } from '@/lib/catalog-db';
import { seededEntities, codeSeededEntities } from '@/lib/catalog/seed';

const CATALOG = 'bestiary';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/catalog-entities', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }));
const get = (qs: string) => GET(new NextRequest(`http://localhost/api/catalog-entities?${qs}`));
const del = (qs: string) =>
  DELETE(new NextRequest(`http://localhost/api/catalog-entities?${qs}`, { method: 'DELETE' }));

beforeEach(() => {
  for (const r of listEntities(CATALOG)) deleteEntity(CATALOG, r.entityId);
});

describe('POST /api/catalog-entities', () => {
  it('persists an entity the server can then resolve', async () => {
    const res = await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'Barrow Wight', source: 'one-shot', data: { stats: {} } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.entityId).toBe('user-wight');
    expect(json.data.source).toBe('one-shot');

    expect(seededEntities(CATALOG).map((e) => e.id)).toContain('user-wight');
  });

  it('is idempotent on (catalogId, entityId)', async () => {
    await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'A' });
    await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'B' });
    const rows = listEntities(CATALOG);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity.name).toBe('B');
  });

  it('refuses an id that a code seed already owns, naming the collision', async () => {
    const seed = codeSeededEntities(CATALOG)[0];
    const res = await post({ catalogId: CATALOG, entityId: seed.id, name: 'IMPOSTOR' });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain(seed.id);
    expect(listEntities(CATALOG)).toHaveLength(0);
  });

  it('requires catalogId, entityId and name', async () => {
    expect((await post({ catalogId: CATALOG, entityId: 'x' })).status).toBe(400);
  });

  it('rejects an unknown source rather than storing it', async () => {
    const res = await post({ catalogId: CATALOG, entityId: 'user-x', name: 'X', source: 'imagination' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/source/i);
  });

  it('is a privileged endpoint — a cross-origin browser POST is refused', async () => {
    const res = await POST(new NextRequest('http://localhost/api/catalog-entities', {
      method: 'POST',
      body: JSON.stringify({ catalogId: CATALOG, entityId: 'user-evil', name: 'E' }),
      headers: { 'Content-Type': 'application/json', origin: 'https://evil.example' },
    }));
    expect(res.status).toBe(403);
    expect(listEntities(CATALOG)).toHaveLength(0);
  });
});

describe('GET /api/catalog-entities', () => {
  it('lists persisted rows for a catalog', async () => {
    await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'Barrow Wight' });
    const json = await (await get(`catalogId=${CATALOG}`)).json();
    expect(json.data.entities.map((e: { entityId: string }) => e.entityId)).toEqual(['user-wight']);
    expect(json.data.collisions).toEqual([]);
  });

  it('404s a single entity that was never persisted', async () => {
    expect((await get(`catalogId=${CATALOG}&entityId=nope`)).status).toBe(404);
  });
});

describe('DELETE /api/catalog-entities', () => {
  it('reports the REAL deleted count — a second delete is 0', async () => {
    await post({ catalogId: CATALOG, entityId: 'user-wight', name: 'Barrow Wight' });
    expect((await (await del(`catalogId=${CATALOG}&entityId=user-wight`)).json()).data.deleted).toBe(1);
    expect((await (await del(`catalogId=${CATALOG}&entityId=user-wight`)).json()).data.deleted).toBe(0);
  });

  it('requires both ids — there is no whole-catalog wipe surface', async () => {
    expect((await del(`catalogId=${CATALOG}`)).status).toBe(400);
  });
});
