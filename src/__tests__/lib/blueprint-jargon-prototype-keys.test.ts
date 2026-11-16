/**
 * `lookupJargon` must answer only for terms the dictionary actually holds.
 * ALL_JARGON is a plain object literal, so an unguarded index returns inherited
 * Object.prototype members for tokens like `toString` or `__proto__`
 * (pair of crash-glossary-prototype-keys.test.ts, which covers the crash layer).
 */
import { describe, it, expect } from 'vitest';
import { lookupJargon } from '@/lib/blueprint-jargon';

const PROTO_KEYS = ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__'];

describe('lookupJargon - no inherited prototype members', () => {
  it.each(PROTO_KEYS)('%s is not a jargon term', (key) => {
    expect(lookupJargon(key)).toBeUndefined();
  });

  it('real terms still resolve', () => {
    expect(lookupJargon('UPROPERTY')?.term).toBeTypeOf('string');
  });
});
