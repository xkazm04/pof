import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/one-shot/analyze/route';

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    { id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Weapon', rarity: 'Common' } },
    { id: 'e2', catalogId: 'items', name: 'Leather Helm', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Armor', rarity: 'Common' } },
    { id: 'd1-e3', catalogId: 'items', name: 'Short Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Weapon', rarity: 'Rare' }, provenance: { kind: 'ingest', canonProfile: 'diablo1' } },
  ]),
}));

afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/one-shot/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/one-shot/analyze', () => {
  it('returns 400 when catalogId is missing', async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns a CatalogDistribution shape on success', async () => {
    const res = await POST(makePost({ catalogId: 'items' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.catalogId).toBe('items');
    expect(typeof body.data.total).toBe('number');
    expect(typeof body.data.byAttribute).toBe('object');
    expect(Array.isArray(body.data.underrepresented)).toBe(true);
    expect(Array.isArray(body.data.sample)).toBe(true);
  });

  it('scopes the analysis to the pof canon profile (a new one-shot entity is PoF-owned)', async () => {
    const res = await POST(makePost({ catalogId: 'items' }));
    const body = await res.json();
    expect(body.data.profile).toBe('pof');
    expect(body.data.total).toBe(2);
    expect(body.data.sample.map((e: { id: string }) => e.id)).not.toContain('d1-e3');
    expect(body.data.byAttribute.rarity).toEqual({ Common: 2 });
  });
});
