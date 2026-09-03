import { describe, it, expect } from 'vitest';
import { ROADMAP_MILESTONES, milestoneProgress } from '@/lib/roadmap/milestones';
import { SLICE_UNMEASURED_NOTE } from '@/lib/roadmap/milestone-progress';

describe('milestoneProgress', () => {
  it('returns the four canonical milestones in order', () => {
    const ms = milestoneProgress(0);
    expect(ms.map((m) => m.id)).toEqual(['vertical-slice', 'feature-complete', 'beta-ready', 'release']);
    expect(ROADMAP_MILESTONES).toHaveLength(4);
  });

  it('scales the breadth milestones relative to each target', () => {
    const ms = milestoneProgress(30);
    // feature-complete (target 75) → 30/75 = 40%
    const fc = ms.find((m) => m.id === 'feature-complete')!;
    expect(fc.progress).toBe(40);
    expect(fc.reached).toBe(false);
  });

  it('never reports the vertical slice on a breadth percentage', () => {
    // A slice is depth, not breadth. At the old target (30% overall) this used
    // to read "100% slice, reached" with no playable path anywhere.
    for (const pct of [0, 10, 30, 50, 75, 100]) {
      const slice = milestoneProgress(pct).find((m) => m.id === 'vertical-slice')!;
      expect(slice.progress).toBeNull();
      expect(slice.reached).toBe(false);
      expect(slice.progressNote).toBe(SLICE_UNMEASURED_NOTE);
    }
  });

  it('caps the breadth milestones at 100 and marks them reached', () => {
    const breadth = milestoneProgress(100).filter((m) => m.id !== 'vertical-slice');
    expect(breadth).toHaveLength(3);
    expect(breadth.every((m) => m.progress === 100 && m.reached)).toBe(true);
  });

  it('clamps a 0% project to 0 progress on every breadth milestone', () => {
    const breadth = milestoneProgress(0).filter((m) => m.id !== 'vertical-slice');
    expect(breadth.every((m) => m.progress === 0 && !m.reached)).toBe(true);
  });
});
