import { describe, it, expect } from 'vitest';
import { computeProjectNBA } from '@/lib/nba-engine';

describe('computeProjectNBA', () => {
  it('returns recommendations aggregated across modules, sorted by score', () => {
    const recs = computeProjectNBA(undefined, 5);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it('every recommendation carries a module + checklist item + reason', () => {
    const recs = computeProjectNBA(undefined, 3);
    for (const r of recs) {
      expect(typeof r.moduleId).toBe('string');
      expect(r.item).toBeTruthy();
      expect(typeof r.reason).toBe('string');
    }
  });

  it('respects the limit', () => {
    expect(computeProjectNBA(undefined, 2).length).toBeLessThanOrEqual(2);
    expect(computeProjectNBA(undefined, 0)).toHaveLength(0);
  });
});
