/**
 * `lookupCrashTerm` must answer only for terms the glossary actually holds.
 *
 * Both dictionaries are plain object literals, so an unguarded `MAP[term]`
 * returns inherited `Object.prototype` members for tokens like `toString` or
 * `__proto__`. Those tokens pass `isRawCrashToken` (a camel hump / an
 * underscore), so `DecoratedCrashText` would wrap them in a tooltip reading
 * "undefined" and `signatureTerms` would add `undefined` to a crash signature.
 */
import { describe, it, expect } from 'vitest';
import { lookupCrashTerm, isRawCrashToken } from '@/lib/crash-glossary';
import { signatureTerms } from '@/lib/crash-analyzer/crash-signature';
import type { CrashReport } from '@/types/crash-analyzer';

const PROTO_KEYS = ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__defineGetter__'];

describe('lookupCrashTerm — no inherited prototype members', () => {
  it.each(PROTO_KEYS)('%s is not a glossary term', (key) => {
    expect(lookupCrashTerm(key)).toBeUndefined();
  });

  it('the decorator would have tried these tokens (precondition)', () => {
    expect(PROTO_KEYS.filter(isRawCrashToken).length).toBeGreaterThan(0);
  });

  it('real terms still resolve from both dictionaries', () => {
    expect(lookupCrashTerm('GAS')?.term).toBe('GAS');
    expect(lookupCrashTerm('EXCEPTION_ACCESS_VIOLATION')?.plain).toBeTypeOf('string');
  });

  it('a callstack mentioning toString yields no undefined signature term', () => {
    const report = {
      errorMessage: 'Assertion failed in toString',
      callstack: [{ functionName: 'FFoo::toString' }, { functionName: '__proto__' }],
    } as unknown as CrashReport;
    expect(signatureTerms(report).every((t) => typeof t === 'string')).toBe(true);
  });
});
