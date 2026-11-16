/**
 * `jsonUnsafeKeys` must name EVERY value `JSON.stringify` cannot carry, not only the
 * collapse-to-`{}` class. A non-finite number is the quiet one: `NaN` / `±Infinity` are
 * `typeof 'number'`, so they passed as primitives, yet they persist as `null` — a computed
 * stat that divided by zero reads back as "no value" with nothing ever logged. A `bigint`
 * is the loud one: `JSON.stringify` THROWS on it, so the guard reported a clean payload for
 * exactly the write that was about to fail.
 */
import { describe, it, expect } from 'vitest';
import { jsonUnsafeKeys } from '@/lib/catalog/entityPayload';

describe('jsonUnsafeKeys — values JSON rewrites or refuses', () => {
  it('names non-finite numbers, which persist as null', () => {
    const payload = { data: { dps: NaN, cap: Infinity, floor: -Infinity, ok: 3.5 } };
    expect(JSON.parse(JSON.stringify(payload)).data.dps).toBeNull(); // the loss being guarded
    expect(jsonUnsafeKeys(payload)).toEqual(['data.dps', 'data.cap', 'data.floor']);
  });

  it('names a bigint, on which JSON.stringify throws', () => {
    expect(() => JSON.stringify({ n: BigInt(1) })).toThrow();
    expect(jsonUnsafeKeys({ stats: [1, BigInt(2)] })).toEqual(['stats.1']);
  });

  it('still passes finite numbers, strings, booleans and null', () => {
    expect(jsonUnsafeKeys({ a: 0, b: -1.5, c: 'x', d: false, e: null })).toEqual([]);
  });
});
