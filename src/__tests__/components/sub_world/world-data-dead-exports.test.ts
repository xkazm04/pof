import { describe, it, expect } from 'vitest';
import * as data from '@/components/modules/core-engine/sub_world/_shared/data';

describe('sub_world data exports', () => {
  it('computes no module-load tables that nothing reads', () => {
    for (const name of ['ZONE_PLAYTIME', 'CRITICAL_PATH', 'ALL_PATHS', 'ZONE_METADATA']) {
      expect(name in data, name).toBe(false);
    }
  });
  it('[control] the world model the panels read is still exported', () => {
    expect(data.STATIC_WORLD.zones.length).toBe(data.ZONES.length);
  });
});
