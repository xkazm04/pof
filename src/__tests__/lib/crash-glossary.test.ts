import { describe, it, expect } from 'vitest';
import {
  lookupCrashTerm,
  crashTermTooltip,
  isRawCrashToken,
  plainCrashType,
  plainSeverity,
  CRASH_TYPE_PLAIN,
  CRASH_SEVERITY_PLAIN,
} from '@/lib/crash-glossary';
import type { CrashType, CrashSeverity } from '@/types/crash-analyzer';

const ALL_TYPES: CrashType[] = [
  'nullptr_deref', 'access_violation', 'assertion_failed', 'ensure_failed',
  'gc_reference', 'stack_overflow', 'out_of_memory', 'unhandled_exception',
  'fatal_error', 'gpu_crash', 'unknown',
];

const ALL_SEVERITIES: CrashSeverity[] = ['critical', 'high', 'medium', 'low'];

describe('crash glossary — lookupCrashTerm', () => {
  it('resolves crash-specific jargon', () => {
    expect(lookupCrashTerm('GAS')?.plain).toMatch(/Gameplay Ability System/i);
    expect(lookupCrashTerm('GC')?.plain).toMatch(/garbage collection/i);
    expect(lookupCrashTerm('ASC')?.plain).toMatch(/ability system component/i);
  });

  it('falls back to the base UE5 jargon dictionary', () => {
    // UPROPERTY lives in blueprint-jargon, not the crash term map.
    expect(lookupCrashTerm('UPROPERTY')).toBeDefined();
  });

  it('returns undefined for unknown terms (fail-soft)', () => {
    expect(lookupCrashTerm('NotARealTerm')).toBeUndefined();
  });

  it('builds a tooltip with the why-it-matters hook when present', () => {
    const entry = lookupCrashTerm('GAS')!;
    expect(crashTermTooltip(entry)).toContain(' — ');
    const noHook = { term: 'x', plain: 'just plain' };
    expect(crashTermTooltip(noHook)).toBe('just plain');
  });
});

describe('crash glossary — isRawCrashToken', () => {
  it('accepts engine identifiers and acronyms', () => {
    expect(isRawCrashToken('EXCEPTION_ACCESS_VIOLATION')).toBe(true);
    expect(isRawCrashToken('GAS')).toBe(true);
    expect(isRawCrashToken('GC')).toBe(true);
    expect(isRawCrashToken('AbilitySystemComponent')).toBe(true);
    expect(isRawCrashToken('TWeakObjectPtr')).toBe(true);
  });

  it('rejects everyday prose words', () => {
    for (const word of ['the', 'memory', 'game', 'crashed', 'reference']) {
      expect(isRawCrashToken(word)).toBe(false);
    }
  });
});

describe('crash glossary — plain-language maps', () => {
  it('has a what/fix line for every crash type', () => {
    for (const type of ALL_TYPES) {
      const p = CRASH_TYPE_PLAIN[type];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.what.length).toBeGreaterThan(0);
      expect(p.fix.length).toBeGreaterThan(0);
    }
  });

  it('has a meaning for every severity', () => {
    for (const sev of ALL_SEVERITIES) {
      expect(CRASH_SEVERITY_PLAIN[sev].meaning.length).toBeGreaterThan(0);
    }
  });

  it('plainCrashType / plainSeverity never throw and default safely', () => {
    expect(plainCrashType('gc_reference').what).toMatch(/cleaned up/i);
    // Unknown enum values (e.g. legacy DB rows) fall back instead of crashing.
    expect(plainCrashType('totally_made_up' as CrashType)).toBe(CRASH_TYPE_PLAIN.unknown);
    expect(plainSeverity('critical').meaning).toMatch(/fix this first/i);
    expect(plainSeverity('nope' as CrashSeverity)).toBe(CRASH_SEVERITY_PLAIN.medium);
  });
});
