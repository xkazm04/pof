/**
 * Defect: the "Playable Vertical Slice" milestone was reported as a fraction of
 * the ALL-MODULE checklist total (`completionPct / 30`), so "100% vertical
 * slice" was reachable with no playable path anywhere in the game.
 *
 * A vertical slice is a DEPTH property — one complete path through every layer
 * ending in something a player experiences — and the governing standard
 * (game-production ▸ production-work-prioritization ▸
 * vertical-slice-as-the-first-milestone) states the rule literally: "when the
 * only available completion metric is a percentage across systems, do not
 * report the slice on it at all."
 *
 * So the slice reports `currentProgress: null` — not measured — until an actual
 * slice is declared to measure against. The other three milestones ARE
 * legitimately breadth percentages and must keep reporting numbers.
 */
import { describe, it, expect } from 'vitest';
import { computeProjectHealth } from '@/lib/health-engine';
import { ALL_MODULE_DEFS } from '@/lib/module-registry';

/** Build a checklist-progress map with `n` completed items spread over modules. */
function progressWith(n: number): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  let left = n;
  for (const mod of ALL_MODULE_DEFS) {
    if (left <= 0) break;
    const take = Math.min(left, mod.checklistCount);
    const items: Record<string, boolean> = {};
    for (let i = 0; i < take; i++) items[`${mod.id}-item-${i}`] = true;
    out[mod.id] = items;
    left -= take;
  }
  return out;
}

const BREADTH_IDS = ['feature-complete', 'beta-ready', 'release'] as const;

describe('health-engine — vertical slice is not a breadth fraction', () => {
  it('reports the slice as not measured on an empty project', () => {
    const health = computeProjectHealth({}, [], null);
    const slice = health.milestones.find((m) => m.id === 'vertical-slice')!;
    expect(slice).toBeDefined();
    expect(slice.currentProgress).toBeNull();
  });

  it('still reports the slice as not measured at the 30% breadth mark', () => {
    // 30% of the all-module checklist used to render the slice as "100%
    // complete" — the exact reading the standard forbids.
    const total = ALL_MODULE_DEFS.reduce((s, m) => s + m.checklistCount, 0);
    const health = computeProjectHealth(progressWith(Math.round(total * 0.3)), [], null);
    const slice = health.milestones.find((m) => m.id === 'vertical-slice')!;
    expect(slice.currentProgress).toBeNull();
  });

  it('never reports a number for the slice at any breadth level', () => {
    const total = ALL_MODULE_DEFS.reduce((s, m) => s + m.checklistCount, 0);
    for (const frac of [0, 0.1, 0.3, 0.5, 0.75, 1]) {
      const health = computeProjectHealth(progressWith(Math.round(total * frac)), [], null);
      const slice = health.milestones.find((m) => m.id === 'vertical-slice')!;
      expect(slice.currentProgress, `frac=${frac}`).toBeNull();
    }
  });

  it('names WHY the slice is unmeasured instead of dropping the reason', () => {
    const health = computeProjectHealth({}, [], null);
    const slice = health.milestones.find((m) => m.id === 'vertical-slice')!;
    expect(typeof slice.progressNote).toBe('string');
    expect(slice.progressNote!.length).toBeGreaterThan(0);
  });

  it('leaves the three breadth milestones as real percentages', () => {
    const total = ALL_MODULE_DEFS.reduce((s, m) => s + m.checklistCount, 0);
    const health = computeProjectHealth(progressWith(Math.round(total * 0.75)), [], null);
    for (const id of BREADTH_IDS) {
      const ms = health.milestones.find((m) => m.id === id)!;
      expect(typeof ms.currentProgress, id).toBe('number');
    }
    // feature-complete target is 75 → 75/75 = 100
    expect(health.milestones.find((m) => m.id === 'feature-complete')!.currentProgress).toBe(100);
    // release target is 100 → equals overall completion
    expect(health.milestones.find((m) => m.id === 'release')!.currentProgress)
      .toBe(health.overallCompletion);
  });

  it('keeps predicting the slice date from velocity — only progress is unmeasured', () => {
    const total = ALL_MODULE_DEFS.reduce((s, m) => s + m.checklistCount, 0);
    const health = computeProjectHealth(progressWith(Math.round(total * 0.2)), [], null);
    const slice = health.milestones.find((m) => m.id === 'vertical-slice')!;
    // The velocity-derived prediction is a separate (breadth) claim and is untouched.
    expect(slice.targetCompletion).toBe(30);
  });
});
