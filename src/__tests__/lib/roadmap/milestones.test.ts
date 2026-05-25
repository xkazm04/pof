import { describe, it, expect } from 'vitest';
import { ROADMAP_MILESTONES, milestoneProgress } from '@/lib/roadmap/milestones';

describe('milestoneProgress', () => {
  it('returns the four canonical milestones in order', () => {
    const ms = milestoneProgress(0);
    expect(ms.map((m) => m.id)).toEqual(['vertical-slice', 'feature-complete', 'beta-ready', 'release']);
    expect(ROADMAP_MILESTONES).toHaveLength(4);
  });

  it('scales progress relative to each milestone target', () => {
    // 30% overall completion → vertical-slice (target 30) reached at 100%
    const ms = milestoneProgress(30);
    const slice = ms.find((m) => m.id === 'vertical-slice')!;
    expect(slice.progress).toBe(100);
    expect(slice.reached).toBe(true);
    // feature-complete (target 75) → 30/75 = 40%
    const fc = ms.find((m) => m.id === 'feature-complete')!;
    expect(fc.progress).toBe(40);
    expect(fc.reached).toBe(false);
  });

  it('caps progress at 100 and marks reached', () => {
    const ms = milestoneProgress(100);
    expect(ms.every((m) => m.progress === 100 && m.reached)).toBe(true);
  });

  it('clamps a 0% project to 0 progress everywhere', () => {
    const ms = milestoneProgress(0);
    expect(ms.every((m) => m.progress === 0 && !m.reached)).toBe(true);
  });
});
