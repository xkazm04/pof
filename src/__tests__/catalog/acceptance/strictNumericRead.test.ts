import { describe, it, expect } from 'vitest';
import { budgetWithinCap, componentsSumTo, sumReconciles, valueWithinDeclaredBand } from '@/lib/catalog/acceptance/invariants';
import { withinAbsolute, withinPercent } from '@/lib/catalog/acceptance/dataCheckers';
import { hitRateFromLimiter } from '@/lib/catalog/acceptance/cadenceCheckers';
import { readNumber, REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

// A value nobody measured must never grade as a number. `Number(x)` turns '' / '  ' / [] / false
// into 0 and true / [1] into 1, so a blank measurement passed a budget cap and an empty list
// reconciled a sum (registry law: unmeasured-is-not-a-pass).

describe('readNumber — the one strict numeric read', () => {
  it('accepts finite numbers and numeric strings', () => {
    expect(readNumber(3)).toBe(3);
    expect(readNumber(' 4.5 ')).toBe(4.5);
    expect(readNumber(0)).toBe(0);
  });
  it('rejects blanks, lists, booleans, objects, gaps and non-finite values', () => {
    for (const v of ['', '   ', [], [5], true, false, {}, null, undefined, NaN, Infinity, REFERENCE_GAP, 'fast']) {
      expect(readNumber(v), JSON.stringify(v)).toBeNull();
    }
  });
});

describe('content invariants do not grade a blank as 0', () => {
  it('budgetWithinCap: an empty measured value is pending, not within budget', () => {
    expect(budgetWithinCap('mem', 'used', 'cap', 'L')({ mem: { used: '', cap: 8 } }).status).toBe('pending');
    expect(budgetWithinCap('mem', 'used', 'cap', 'L')({ mem: { used: [], cap: 8 } }).status).toBe('pending');
    expect(budgetWithinCap('mem', 'used', 'cap', 'L')({ mem: { used: false, cap: 8 } }).status).toBe('pending');
  });
  it('componentsSumTo / sumReconciles: a boolean is not a component', () => {
    expect(componentsSumTo('p', ['a', 'b'], 1, 'L')({ p: { a: true, b: 0 } }).status).toBe('pending');
    expect(sumReconciles('t', 'p', ['a'], 'L')({ t: 0, p: { a: '  ' } }).status).toBe('pending');
  });
  it('valueWithinDeclaredBand: an empty list is not 0', () => {
    expect(valueWithinDeclaredBand('b', 'v', 'lo', 'hi', 'L')({ b: { v: [], lo: 0, hi: 1 } }).status).toBe('pending');
  });
  it('hitRateFromLimiter: a boolean damage is not 1', () => {
    expect(hitRateFromLimiter('c', 'L')({ c: { baseDamage: true, hitDPS: 1, cooldown: 1 } }).status).toBe('pending');
  });
  it('real numbers still grade exactly as before', () => {
    expect(budgetWithinCap('mem', 'used', 'cap', 'L')({ mem: { used: 7, cap: 8 } }).status).toBe('pass');
    expect(budgetWithinCap('mem', 'used', 'cap', 'L')({ mem: { used: '9', cap: 8 } }).status).toBe('fail');
  });
});

describe('withinPercent / withinAbsolute read a non-number as unpopulated', () => {
  it('a declared gap is pending, not a NaN fail', () => {
    const r = withinPercent('x', 'L', 100, 10)({ x: REFERENCE_GAP });
    expect(r.status).toBe('pending');
    expect(r.reason ?? '').not.toMatch(/NaN/);
  });
  it('a blank is not 0 for a zero target', () => {
    expect(withinAbsolute('x', 'L', 0, 1)({ x: '' }).status).toBe('pending');
    expect(withinAbsolute('x', 'L', 0, 1)({ x: false }).status).toBe('pending');
  });
  it('real numbers still grade exactly as before', () => {
    expect(withinPercent('x', 'L', 100, 10)({ x: 105 }).status).toBe('pass');
    expect(withinPercent('x', 'L', 100, 10)({ x: 150 }).status).toBe('fail');
    expect(withinAbsolute('x', 'L', -16, 2)({ x: '-15' }).status).toBe('pass');
  });
});
