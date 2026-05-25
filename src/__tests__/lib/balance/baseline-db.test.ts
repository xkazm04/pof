import { describe, it, expect } from 'vitest';
import { rowToBaseline } from '@/lib/balance/baseline-db';

describe('rowToBaseline', () => {
  it('maps a full row + parses stats JSON', () => {
    const rec = rowToBaseline({
      catalog_id: 'bestiary', entity_id: 'brute', threat_score: 85,
      stats: '[{"label":"Health","value":200}]', captured_at: '2026-05-25T00:00:00.000Z',
    });
    expect(rec.catalogId).toBe('bestiary');
    expect(rec.threatScore).toBe(85);
    expect(rec.stats).toEqual([{ label: 'Health', value: 200 }]);
    expect(rec.capturedAt).toBe('2026-05-25T00:00:00.000Z');
  });

  it('defaults empty stats + omits null captured_at', () => {
    const rec = rowToBaseline({ catalog_id: 'b', entity_id: 'x', threat_score: 0, stats: '[]', captured_at: null });
    expect(rec.stats).toEqual([]);
    expect(rec.capturedAt).toBeUndefined();
  });
});
