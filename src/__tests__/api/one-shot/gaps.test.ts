// @vitest-environment node
/**
 * catalog-gap-analysis/B — GET /api/one-shot/gaps ranks every catalog's measured gaps, scoped
 * to the `pof` profile, and lists the catalogs with no basis as unmeasured. No LLM is involved.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/catalog/sections', () => ({
  CATALOG_SECTIONS: [
    { catalogId: 'items', label: 'Items', seed: () => [] },
    { catalogId: 'quests', label: 'Quests', seed: () => [] },
  ],
}));

const item = (id: string, rarity: string, profile?: string) => ({
  id, catalogId: 'items', name: id, categoryPath: [], tags: [], lifecycle: 'planned',
  data: { type: 'Weapon', rarity },
  ...(profile ? { provenance: { kind: 'ingest', canonProfile: profile } } : {}),
});

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn((catalogId: string) => catalogId === 'items'
    ? [
        ...Array.from({ length: 10 }, (_, i) => item(`r${i}`, 'Rare')),
        // Another world's rows never create or hide a PoF gap.
        ...Array.from({ length: 30 }, (_, i) => item(`d1-${i}`, 'Common', 'diablo1')),
      ]
    : [{ id: 'q1', catalogId: 'quests', name: 'q1', categoryPath: [], tags: [], lifecycle: 'planned', data: {} }]),
}));

import { GET } from '@/app/api/one-shot/gaps/route';

describe('GET /api/one-shot/gaps', () => {
  it('ranks the pof-scoped gaps and lists no-basis catalogs as unmeasured', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const common = body.data.targets.find((t: { attribute: string; value: string }) => t.attribute === 'rarity' && t.value === 'Common');
    expect(common).toMatchObject({ catalogId: 'items', count: 0 });
    expect(common.deficit).toBe(common.expected - common.count);
    expect(body.data.unmeasured).toEqual(['quests']);
  });
});
