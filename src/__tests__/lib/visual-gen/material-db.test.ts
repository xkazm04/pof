/**
 * material-db + /api/visual-gen/materials — the Material Lab preset persistence
 * seam. Real SQLite (throwaway DB via POF_DB_PATH, set before the import graph
 * opens better-sqlite3), because "a reload keeps the presets" is only a real
 * claim if a real row survives.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-material-db-${process.pid}.db`;
});

import { NextRequest } from 'next/server';
import {
  ensureMaterialTable,
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '@/lib/visual-gen/material-db';
import { GET, POST, PUT, DELETE } from '@/app/api/visual-gen/materials/route';
import { getDb } from '@/lib/db';

const PARAMS = { baseColor: '#ffd700', metallic: 1, roughness: 0.2, normalStrength: 0.5, aoStrength: 1 };

function req(method: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/visual-gen/materials', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function envelope<T>(res: Response) {
  return (await res.json()) as { success: boolean; data?: T; error?: string };
}

describe('material-db', () => {
  it('round-trips a preset through real SQLite', () => {
    const id = `preset-rt-${Date.now()}`;
    const created = createMaterial(id, 'Gold', PARAMS);
    expect(created.name).toBe('Gold');
    expect(created.params).toEqual(PARAMS);

    // A fresh read is what a page reload actually does.
    const reread = getMaterial(id);
    expect(reread?.params).toEqual(PARAMS);
    expect(listMaterials().some((m) => m.id === id)).toBe(true);

    expect(updateMaterial(id, { name: 'Gold v2' })?.name).toBe('Gold v2');
    expect(deleteMaterial(id)).toBe(true);
    expect(getMaterial(id)).toBeNull();
  });

  it('leaves no dead thumbnail column behind', () => {
    ensureMaterialTable();
    const cols = (getDb().prepare('PRAGMA table_info(materials)').all() as { name: string }[]).map((c) => c.name);
    // The original schema declared `thumbnail` and no code path could write it —
    // a column that is null forever reads as "no thumbnail yet" rather than
    // "this app never makes one". Dropped, not faked.
    expect(cols).not.toContain('thumbnail');
    expect(cols).toEqual(expect.arrayContaining(['id', 'name', 'params', 'created_at', 'updated_at']));
  });

  it('reports the real reason a duplicate id fails instead of a blanket message', async () => {
    const id = `preset-dup-${Date.now()}`;
    createMaterial(id, 'First', PARAMS);
    const res = await POST(req('POST', { id, name: 'Second', params: PARAMS }));
    const json = await envelope(res);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/UNIQUE|constraint/i);
    deleteMaterial(id);
  });
});

describe('/api/visual-gen/materials', () => {
  it('serves the full preset CRUD the lab needs', async () => {
    const id = `preset-route-${Date.now()}`;

    const created = await envelope<{ id: string }>(await POST(req('POST', { id, name: 'Rough Stone', params: PARAMS })));
    expect(created.success).toBe(true);

    const listed = await envelope<Array<{ id: string; params: Record<string, unknown> }>>(await GET());
    expect(listed.success).toBe(true);
    const row = listed.data!.find((m) => m.id === id);
    expect(row?.params).toEqual(PARAMS);

    const updated = await envelope<{ name: string }>(
      await PUT(req('PUT', { id, name: 'Rough Stone v2' })),
    );
    expect(updated.data?.name).toBe('Rough Stone v2');

    expect((await envelope(await DELETE(req('DELETE', { id })))).success).toBe(true);
    expect((await envelope(await DELETE(req('DELETE', { id })))).success).toBe(false);
  });

  it('rejects a params payload that is not an object', async () => {
    const res = await POST(req('POST', { id: 'preset-bad', name: 'x', params: 'not-an-object' }));
    expect((await envelope(res)).success).toBe(false);
  });
});
