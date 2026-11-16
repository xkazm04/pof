/**
 * One source per threshold: every band number the judge PROMPT states comes from `BANDS`.
 *
 * `dimensionBlock` already interpolated `BANDS.shippable` for the pass rule, but the strictness
 * contract above it spelled the same bands as literals ("90-100", "70-89", "Below 70"). Moving a
 * band would then hand the judge a prompt that contradicts itself — the pass rule at the new
 * number, the scoring guidance at the old one — while `admission`, `statusModel` and
 * `calibration.bandOf` all followed BANDS.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { BANDS, buildRubricPrompt } from '@/lib/judge/rubrics';

const mutable = BANDS as unknown as { shippable: number; placeholder: number };
const ORIGINAL = { ...mutable };
afterEach(() => { mutable.shippable = ORIGINAL.shippable; mutable.placeholder = ORIGINAL.placeholder; });

const prompt = () => buildRubricPrompt('text-config', { subject: 's', payload: 'x' });

describe('judge prompt bands follow BANDS', () => {
  it('states the bands in force today', () => {
    const p = prompt();
    expect(p).toContain(`Reserve ${BANDS.shippable}-100`);
    expect(p).toContain(`${BANDS.placeholder}-${BANDS.shippable - 1} = a solid`);
    expect(p).toContain(`Below ${BANDS.placeholder} = not yet usable`);
  });

  it('moving a band moves every number the prompt states, leaving no stale literal', () => {
    mutable.shippable = 92;
    mutable.placeholder = 75;
    const p = prompt();
    expect(p).toContain('Reserve 92-100');
    expect(p).toContain('75-91 = a solid');
    expect(p).toContain('Below 75 = not yet usable');
    expect(p).toContain('roughly 40-75');
    expect(p).not.toMatch(/\b90-100\b|\b70-89\b|Below 70\b|40-70\b/);
  });
});
