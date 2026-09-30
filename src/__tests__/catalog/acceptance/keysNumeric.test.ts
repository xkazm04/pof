// /diablo W08 (D27): a Stat Block's keys each hold ONE number or a range written exactly {minimum, maximum}. The
// contract named `damage` but not its shape, and five produced Stat Blocks came back with three shapes of it
// (`damage.minimum`, `damage.standard.minimum`, `damage.standardAttack.minimum`) — a consumer guessing the shape
// fell back to a C++ default silently. A range is kept (Diablo rolls HP per spawn — a real design fact).
import { describe, it, expect } from 'vitest';
import { keysNumeric, statNumber } from '@/lib/catalog/acceptance/dataCheckers';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = keysNumeric('stats', 'Stat values are numbers', ['health', 'damage'], { experience: /^(xp|exp\w*|experience\w+)$/i });

describe('keysNumeric', () => {
  it('passes one number, or a {minimum, maximum} range, per key', () => {
    expect(check({ stats: { health: 44, damage: 3.5 } }).status).toBe('pass');
    expect(check({ stats: { health: { minimum: 4, maximum: 7 }, damage: 3 } }).status).toBe('pass');
  });

  it('holds any other object shape, naming the key', () => {
    const r = check({ stats: { health: 44, damage: { standard: { minimum: 2, maximum: 5 } } } });
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/damage.*object/);
    expect(check({ stats: { health: { minimum: 4, maximum: 7, toHit: 3 }, damage: 3 } }).status).toBe('pending');
    expect(check({ stats: { health: { minimum: 7, maximum: 4 }, damage: 3 } }).status).toBe('pending');
  });

  it('holds a numeric STRING (a number the consumer must parse is a guess)', () => {
    expect(check({ stats: { health: '44', damage: 3 } }).status).toBe('pending');
  });

  it('holds a key that means a canonical one but is spelled otherwise', () => {
    const r = check({ stats: { health: 44, damage: 3, experienceReward: 64 } });
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/experienceReward.*experience/);
    expect(check({ stats: { health: 44, damage: 3, experience: 64 } }).status).toBe('pass');
  });

  it('leaves a declared gap and an absent key to the presence checker (no double verdict)', () => {
    expect(check({ stats: { health: 44, damage: REFERENCE_GAP } }).status).toBe('pass');
    expect(check({ stats: { health: 44 } }).status).toBe('pass');
  });

  it('states the shape to the producer through the required-fields channel', () => {
    const req = requiredFieldsOf(check).find((r) => r.field === 'stats');
    expect(req?.shape).toMatch(/ONE number/);
    expect(req?.shape).toMatch(/\{minimum, maximum\}/);
    expect(req?.shape).toMatch(/experience/);
  });
});

describe('statNumber — the one reader for a stat value', () => {
  it('reads a number, the mean of a range, and nothing else', () => {
    expect(statNumber(5)).toBe(5);
    expect(statNumber({ minimum: 2, maximum: 5 })).toBe(3.5);
    expect(statNumber({ standard: { minimum: 2, maximum: 5 } })).toBeUndefined();
    expect(statNumber(REFERENCE_GAP)).toBeUndefined();
  });
});
