import { describe, it, expect } from 'vitest';
import { CRASH_TAXONOMY, CRASH_TAXONOMY_IDS } from '@/lib/crash-analyzer/crash-taxonomy';
import { emptyCrashTypeCounts } from '@/types/crash-analyzer';
import { CRASH_TYPE_PLAIN } from '@/lib/crash-glossary';

const EXPECTED = [
  'nullptr_deref', 'access_violation', 'assertion_failed', 'ensure_failed',
  'gc_reference', 'stack_overflow', 'out_of_memory', 'unhandled_exception',
  'fatal_error', 'gpu_crash', 'unknown',
];

describe('CRASH_TAXONOMY', () => {
  it('holds exactly the 11 CrashType ids with severity, plain text and markers', () => {
    expect([...CRASH_TAXONOMY_IDS].sort()).toEqual([...EXPECTED].sort());
    for (const row of CRASH_TAXONOMY) {
      expect(['critical', 'high', 'medium', 'low']).toContain(row.severity);
      expect(row.plain.label).toBeTruthy();
      expect(row.plain.what).toBeTruthy();
      expect(row.plain.fix).toBeTruthy();
      if (row.id !== 'unknown') expect(row.markers.length).toBeGreaterThan(0);
    }
  });

  it('derives the zero-count factory and plain-English record from the table', () => {
    expect(Object.keys(emptyCrashTypeCounts()).sort()).toEqual([...EXPECTED].sort());
    expect(Object.keys(CRASH_TYPE_PLAIN).sort()).toEqual([...EXPECTED].sort());
    for (const row of CRASH_TAXONOMY) expect(CRASH_TYPE_PLAIN[row.id]).toEqual(row.plain);
  });
});
