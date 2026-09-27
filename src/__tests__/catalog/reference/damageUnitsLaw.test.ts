import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { DIABLO1_DAMAGE_UNITS_LAWS } from '@/lib/catalog/reference/damageUnitsLawData';

describe('missile damage units law', () => {
  it('is in the diablo1 canon, scoped to the bestiary, within the length cap, with pinned refs', () => {
    for (const law of DIABLO1_DAMAGE_UNITS_LAWS) {
      expect(DIABLO1_CANON.some((rule) => rule.id === law.id)).toBe(true);
      expect(law.scope).toBe('bestiary');
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect((law.refs ?? []).every((ref) => ref.includes('/blob/4138a82/'))).toBe(true);
    }
  });
});
