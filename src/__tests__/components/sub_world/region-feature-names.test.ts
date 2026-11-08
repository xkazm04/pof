import { describe, it, expect } from 'vitest';
import { ZONE_TYPE_FEATURES } from '@/components/modules/core-engine/sub_world/_shared/data';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

describe('Region Details feature names', () => {
  it('every name exists in the module whose matrix the panel reads', () => {
    const known = new Set(MODULE_FEATURE_DEFINITIONS['arpg-world']!.map((d) => d.featureName));
    const names = Object.values(ZONE_TYPE_FEATURES).flat();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(known.has(n), n).toBe(true);
  });
});
