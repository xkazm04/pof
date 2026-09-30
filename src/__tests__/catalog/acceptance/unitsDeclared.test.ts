// /diablo D30 (operator, 2026-09-24): a Stat Block names the UNIT of each value. An ingested monster's moveSpeed is
// 2.22 (tiles/s) and PoF's own is 300 (cm/s) — both bare numbers under one key, so a consumer cannot tell them apart.
import { describe, it, expect } from 'vitest';
import { unitsDeclared } from '@/lib/catalog/acceptance/dataCheckers';
import { requiredFieldsOf } from '@/lib/catalog/acceptance/requiredFields';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = unitsDeclared('stats', 'Stat units declared', { health: ['points'], moveSpeed: ['cm/s', 'tiles/s'] });

describe('unitsDeclared', () => {
  it('passes when every present value names an allowed unit', () => {
    expect(check({ stats: { health: 44, moveSpeed: 2.2, units: { health: 'points', moveSpeed: 'tiles/s' } } }).status).toBe('pass');
  });

  it('holds a value with no unit, naming the key and the allowed units', () => {
    const r = check({ stats: { health: 44, moveSpeed: 300, units: { health: 'points' } } });
    expect(r.status).toBe('pending');
    expect(r.reason).toMatch(/moveSpeed.*cm\/s.*tiles\/s/);
  });

  it('holds a unit outside the vocabulary', () => {
    expect(check({ stats: { health: 44, moveSpeed: 300, units: { health: 'points', moveSpeed: 'm/s' } } }).status).toBe('pending');
  });

  it('asks no unit of an absent value or a declared gap', () => {
    expect(check({ stats: { health: 44, moveSpeed: REFERENCE_GAP, units: { health: 'points' } } }).status).toBe('pass');
    expect(check({ stats: { health: 44, units: { health: 'points' } } }).status).toBe('pass');
  });

  it('states the unit rule to the producer', () => {
    const shape = requiredFieldsOf(check).find((r) => r.field === 'stats')?.shape ?? '';
    expect(shape).toMatch(/units/);
    expect(shape).toMatch(/moveSpeed: cm\/s \| tiles\/s/);
  });
});

describe('two shape rules on one field both reach the prompt', async () => {
  const { allOf } = await import('@/lib/catalog/acceptance/combinators');
  const { keysNumeric } = await import('@/lib/catalog/acceptance/dataCheckers');
  it('concatenates shapes instead of keeping only the first (the units rule was being dropped)', () => {
    const both = allOf(keysNumeric('stats', 'n', ['health']), unitsDeclared('stats', 'u', { health: ['points'] }));
    const shape = requiredFieldsOf(both).find((r) => r.field === 'stats')?.shape ?? '';
    expect(shape).toMatch(/ONE number/);
    expect(shape).toMatch(/units/);
  });
});
