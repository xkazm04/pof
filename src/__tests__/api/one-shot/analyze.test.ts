import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/one-shot/analyze/route';

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    { id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Weapon', rarity: 'Common' } },
    { id: 'e2', catalogId: 'items', name: 'Leather Helm', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Armor', rarity: 'Common' } },
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
});
