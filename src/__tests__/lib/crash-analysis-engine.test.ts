import { describe, it, expect } from 'vitest';
import { analyzeAllCrashes } from '@/lib/crash-analyzer/analysis-engine';
import { SAMPLE_CRASHES, SAMPLE_DIAGNOSES } from '@/lib/crash-analyzer/sample-crashes';

describe('analyzeAllCrashes — memoization', () => {
  it('returns the same cached result reference on repeated calls', () => {
    const a = analyzeAllCrashes();
    const b = analyzeAllCrashes();

    // Module-level memo: identical reference, no recomputation on the hot path.
    expect(b).toBe(a);
    expect(b.reports).toBe(a.reports);
    expect(b.patterns).toBe(a.patterns);
    expect(b.stats).toBe(a.stats);
    expect(b.diagnoses).toBe(a.diagnoses);
  });

  it('produces a behavior-preserving result over the static sample data', () => {
    const result = analyzeAllCrashes();

    // One processed report per sample crash, all flagged analyzed.
    expect(result.reports).toHaveLength(SAMPLE_CRASHES.length);
    expect(result.reports.every((r) => r.analyzed)).toBe(true);

    // Diagnoses are passed through unchanged.
    expect(result.diagnoses).toBe(SAMPLE_DIAGNOSES);

    // Culprit detection maps the null-ASC crashes to the character module.
    const crash001 = result.reports.find((r) => r.id === 'crash-001');
    expect(crash001?.culpritFrame?.isCrashOrigin).toBe(true);
    expect(crash001?.mappedModule).toBe('arpg-character');

    // The two null-ASC ability crashes (crash-001, crash-008) share a signature,
    // so a recurring pattern is detected.
    const ascPattern = result.patterns.find((p) =>
      p.crashIds.includes('crash-001') && p.crashIds.includes('crash-008'),
    );
    expect(ascPattern).toBeDefined();
    expect(ascPattern?.occurrences).toBe(2);

    // Stats agree with the underlying reports.
    expect(result.stats.totalCrashes).toBe(SAMPLE_CRASHES.length);
    expect(result.stats.patternsDetected).toBe(result.patterns.length);
  });
});
