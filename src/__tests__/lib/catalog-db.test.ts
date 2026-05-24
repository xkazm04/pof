import { describe, it, expect } from 'vitest';
import { rowToLifecycle } from '@/lib/catalog-db';

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
