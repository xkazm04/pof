import { describe, it, expect } from 'vitest';
import { dpsConsistent } from '@/lib/catalog/acceptance/dataCheckers';

// Number('') is 0, so an artifact whose damage, speed and DPS were all left blank reconciled
// 0 = avg(0, 0) x 0 and graded pass.
describe('dpsConsistent reads blanks as unset', () => {
  it('all-blank fields are pending, not a 0 = 0 pass', () => {
    const r = dpsConsistent('weapon', 'baseDPS', 'L')({ weapon: { damageMin: '', damageMax: '', attackSpeed: '' }, baseDPS: '' });
    expect(r.status).toBe('pending');
  });
  it('booleans are not numbers', () => {
    expect(dpsConsistent('weapon', 'baseDPS', 'L')({ weapon: { damageMin: false, damageMax: false, attackSpeed: true }, baseDPS: false }).status).toBe('pending');
  });
  it('real numbers grade as before', () => {
    expect(dpsConsistent('weapon', 'baseDPS', 'L')({ weapon: { damageMin: 10, damageMax: 15, attackSpeed: 1 }, baseDPS: 12.5 }).status).toBe('pass');
    expect(dpsConsistent('weapon', 'baseDPS', 'L')({ weapon: { damageMin: 10, damageMax: 15, attackSpeed: 1 }, baseDPS: '40' }).status).toBe('fail');
  });
});
