/**
 * POST /api/marketplace {action:'recommend'} — gaps are the project's missing|partial
 * features; features with no review verdict come back as `unreviewed`, grouped by
 * module, instead of being counted as gaps. An explicit statusFilter keeps the old
 * behaviour (unknown counted as a gap) for callers that ask for it.
 *
 * scan-sweep --challenge run challenge-2026-09-28c, card asset-visual-studio/B.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/marketplace/route';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { RecommendationResponse } from '@/types/marketplace';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/marketplace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function recommend(body: Record<string, unknown>): Promise<RecommendationResponse> {
  const res = await POST(post({ action: 'recommend', ...body }));
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data as RecommendationResponse;
}

const LOOT_FEATURE = MODULE_FEATURE_DEFINITIONS['arpg-loot']![0].featureName;

describe('POST /api/marketplace recommend', () => {
  it('one missing feature -> totalGaps 1; the other 239 come back as unreviewed by module', async () => {
    const data = await recommend({ statusMap: { [`arpg-loot::${LOOT_FEATURE}`]: 'missing' } });
    expect(data.totalGaps).toBe(1);
    const unreviewed = data.unreviewed ?? [];
    expect(unreviewed.reduce((n, m) => n + m.featureNames.length, 0)).toBe(239);
    expect(data.totalUnreviewed).toBe(239);
    const loot = unreviewed.find((m) => m.moduleId === 'arpg-loot')!;
    expect(loot.moduleLabel).toBe('Loot System');
    expect(loot.featureNames).not.toContain(LOOT_FEATURE);
    for (const m of unreviewed) expect(typeof m.moduleLabel).toBe('string');
    expect(new Set(unreviewed.map((m) => m.moduleId)).size).toBe(unreviewed.length);
  });

  it('[guard] an explicit statusFilter including unknown still returns unknown features as gaps', async () => {
    const data = await recommend({ statusMap: {}, statusFilter: ['missing', 'partial', 'unknown'] });
    expect(data.totalGaps).toBe(240);
  });
});
