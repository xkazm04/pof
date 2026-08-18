import { describe, it, expect } from 'vitest';
import {
  tripoModelFor,
  TRIPO_AUDITED_MODEL,
  TRIPO_AUDITED_TEXTURE_QUALITY,
  UNAUDITED_TOPOLOGY_TIER,
} from '@/lib/visual-gen/tripo-models';

describe('tripoModelFor', () => {
  it('pins the audited model for every known asset class', () => {
    for (const c of ['character', 'weapon', 'prop', 'environment', 'modular-part']) {
      const pin = tripoModelFor(c);
      expect(pin.modelVersion).toBe(TRIPO_AUDITED_MODEL);
      expect(pin.textureQuality).toBe(TRIPO_AUDITED_TEXTURE_QUALITY);
      expect(pin.audited).toBe(true);
    }
  });

  // The whole point of the module: an absent class must not degrade back into the
  // silent account default, which the character-pipeline arena graded FAIL.
  it('still pins a model when no asset class is supplied', () => {
    const pin = tripoModelFor(undefined);
    expect(pin.modelVersion).toBe(TRIPO_AUDITED_MODEL);
    expect(pin.rationale).toContain('account default');
  });

  it('never resolves to an empty model version', () => {
    expect(tripoModelFor('nonsense-class').modelVersion.trim()).not.toBe('');
  });

  // Guards the honesty rule: the P-series is recorded as a candidate, not as a pin.
  it('does not pin the unbenchmarked P-series topology tier', () => {
    const pins = ['character', 'weapon', 'prop', undefined].map((c) => tripoModelFor(c).modelVersion);
    expect(pins.some((m) => /^P\d/i.test(m))).toBe(false);
    expect(UNAUDITED_TOPOLOGY_TIER.blockedOn).toContain('arena run');
  });
});
