import { describe, it, expect } from 'vitest';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '@/lib/catalog/acceptance/dataCheckers';

describe('L0 data checkers', () => {
  it('minLength passes at/above threshold, pending below', () => {
    const c = minLength('brief', 'Brief ≥ 300 chars', 300);
    expect(c({ brief: 'x'.repeat(300) }).status).toBe('pass');
    expect(c({ brief: 'short' }).status).toBe('pending');
    expect(c({ brief: 'x'.repeat(300) }).tier).toBe('L0');
  });
  it('fieldsPopulated requires every key present', () => {
    const c = fieldsPopulated('stats', 'All stats', ['Damage', 'Weight']);
    expect(c({ stats: { Damage: 1, Weight: 2 } }).status).toBe('pass');
    expect(c({ stats: { Damage: 1 } }).status).toBe('pending');
  });
  it('withinPercent fails outside the band', () => {
    const c = withinPercent('power', 'Power ±10%', 100, 10);
    expect(c({ power: 105 }).status).toBe('pass');
    expect(c({ power: 130 }).status).toBe('fail');
    expect(c({}).status).toBe('pending');
  });
  it('selected passes when an index ≥ 0 is chosen', () => {
    const c = selected('selected', 'Icon selected');
    expect(c({ selected: 0 }).status).toBe('pass');
    expect(c({ selected: -1 }).status).toBe('pending');
    expect(c({}).status).toBe('pending');
  });
  it('minCount counts array length', () => {
    const c = minCount('cues', 'Cues', 3);
    expect(c({ cues: [1, 2, 3] }).status).toBe('pass');
    expect(c({ cues: [1] }).status).toBe('pending');
  });
});
