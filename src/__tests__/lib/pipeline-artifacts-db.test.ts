import { describe, it, expect } from 'vitest';
import { rowToArtifact } from '@/lib/pipeline-artifacts-db';

describe('rowToArtifact', () => {
  it('maps a full row + parses JSON columns', () => {
    expect(rowToArtifact({
      catalog_id: 'items', entity_id: 'item-1', step: 'Attributes',
      data: '{"stats":{"Damage":34}}', ue_assets: '["/Game/Items/X"]',
      status: 'pass', tier: 'L0', reason: null, updated_at: '2026-05-26T00:00:00.000Z',
    })).toEqual({
      catalogId: 'items', entityId: 'item-1', step: 'Attributes',
      data: { stats: { Damage: 34 } }, ueAssets: ['/Game/Items/X'],
      status: 'pass', tier: 'L0', updatedAt: '2026-05-26T00:00:00.000Z',
    });
  });
  it('defaults empty JSON + omits null optionals', () => {
    const r = rowToArtifact({ catalog_id: 'items', entity_id: 'i', step: 'Economy', data: null, ue_assets: null, status: 'pending', tier: null, reason: null, updated_at: null });
    expect(r.data).toEqual({});
    expect(r.ueAssets).toEqual([]);
    expect(r.tier).toBeUndefined();
    expect(r.reason).toBeUndefined();
  });
});
