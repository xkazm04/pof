import { describe, it, expect } from 'vitest';
import { lookupStatTerm } from '@/lib/prompt-evolution/stats-glossary';

describe('lookupStatTerm', () => {
  it('explains every jargon term the requirement calls out', () => {
    for (const term of ['epsilon-greedy', 'Jaccard', 'z-test', 'centroid', 'confidence']) {
      const entry = lookupStatTerm(term);
      expect(entry, term).toBeDefined();
      expect(entry!.plain.length).toBeGreaterThan(0);
    }
  });

  it('is case-insensitive', () => {
    expect(lookupStatTerm('Z-TEST')).toEqual(lookupStatTerm('z-test'));
  });

  it('returns undefined for unknown terms (fail-soft)', () => {
    expect(lookupStatTerm('definitely-not-a-stat-term')).toBeUndefined();
  });

  it('phrases "confidence" around the 1-in-20 / luck idea', () => {
    expect(lookupStatTerm('confidence')!.plain.toLowerCase()).toMatch(/luck|sure|certain/);
  });
});
