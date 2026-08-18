import { describe, it, expect } from 'vitest';
import {
  tripoModelFor,
  TRIPO_AUDITED_MODEL,
  TRIPO_AUDITED_TEXTURE_QUALITY,
  SMART_LOW_POLY_VERDICT,
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

  // Guards the honesty rule: smart_low_poly is a flag on the pinned model, never a
  // separate model id, and it was benchmarked and rejected — never silently enabled.
  it('does not pin a separate P-series model id, and records the completed rejection', () => {
    const pins = ['character', 'weapon', 'prop', undefined].map((c) => tripoModelFor(c).modelVersion);
    expect(pins.some((m) => /^P\d/i.test(m))).toBe(false);
    expect(SMART_LOW_POLY_VERDICT.verdict).toBe('rejected');
  });
});
