/**
 * minCount counted every array element, so a list whose only item is the declared-gap marker
 * ("not in the reference") met a ≥1 floor — while fieldsPopulated and entriesHaveFields both read
 * the same marker as unpopulated.
 */
import { describe, it, expect } from 'vitest';
import { minCount } from '@/lib/catalog/acceptance/dataCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = minCount('voLines', '≥1 VO line', 1);

describe('minCount over declared gaps', () => {
  it('does not count a declared-gap item toward the floor', () => {
    const res = check({ voLines: [REFERENCE_GAP] });
    expect(res.status).toBe('pending');
    expect(res.reason).toContain('declared gap');
    expect(check({ voLines: [{ value: 'Not in the reference' }] }).status).toBe('pending');
  });

  it('counts real items exactly as before', () => {
    expect(check({ voLines: ['VO_HI: "Hello."'] })).toMatchObject({ status: 'pass', detail: '1 / 1' });
    expect(minCount('xs', 'xs', 2)({ xs: [1, REFERENCE_GAP, 3] })).toMatchObject({ status: 'pass', detail: '2 / 2' });
    expect(check({})).toMatchObject({ status: 'pending', detail: '0 / 1' });
    // A real row carrying a gap note beside its fields is still a row.
    expect(check({ voLines: [{ name: 'Vael', sourceStatus: REFERENCE_GAP }] }).status).toBe('pass');
  });
});
