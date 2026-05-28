import { describe, it, expect, vi } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db (mirrors procgen-db.test.ts).
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { saveZonePin, listZonePins, deleteZonePin } from '@/lib/procgen-db';
import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

const params: ZoneGraphParams = {
  zoneCount: 8, branchiness: 0.5, topology: 'metroidvania', difficulty: 'linear', maxLevel: 30, seed: 42,
};

describe('procgen-db zone pins', () => {
  it('starts empty', () => {
    expect(listZonePins()).toEqual([]);
  });

  it('saves and lists pins newest-first with params parsed', () => {
    saveZonePin({ seed: 42, params, label: 'first', zoneCount: 8, topology: 'metroidvania' });
    saveZonePin({ seed: 99, params: { ...params, seed: 99 }, label: 'second', zoneCount: 8, topology: 'metroidvania' });
    const pins = listZonePins();
    expect(pins).toHaveLength(2);
    expect(pins[0].label).toBe('second');           // newest first
    expect(pins[0].params.seed).toBe(99);           // parsed object, not a string
    expect(pins[1].params.topology).toBe('metroidvania');
  });

  it('deletes a pin', () => {
    const pins = listZonePins();
    deleteZonePin(pins[0].id);
    expect(listZonePins().some((p) => p.id === pins[0].id)).toBe(false);
  });
});
