/**
 * Section-12 amendments, Orrery side:
 *
 *   1. COHORT UNION — the model reads its cohort list off EVERY run (first-seen, document order),
 *      not the first run only, and one unpinned run badges the lens unverified. `buildMergedModel`
 *      no longer fakes a leading view run to get there.
 *   2. MEASURED ZERO vs UNMEASURED — an explicit `0` in `evidence.reach` (the walker's "covered, never
 *      reached") is a measured row everywhere; an absent node stays unmeasured. Side by side.
 */

import { describe, expect, it } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery';
import { buildMergedModel, cohortStatuses, mergeWalkEvidence, worstCellStatus } from '@/lib/story/orrery/walk';
import { fillFor, isMeasuredZero, lensModeOf, lensValue } from '@/components/story/orrery/render/lod';
import { honestyGraph, ix } from '@/__tests__/components/story/orrery/panelFixture';
import { HASH, walkReport } from '@/__tests__/components/story/walkFixture';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';
import type { StoryGraph, StoryRun } from '@/lib/story/types';

/** Marker strings only, never colours: enough of a palette for the fill functions. */
const palette = {
  kind: { event: 'K-event', container: 'K-container' },
  container: [['C0a', 'C0b']],
  reach: Array.from({ length: 101 }, (_, i) => `R${i}`),
  diverge: Array.from({ length: 101 }, (_, i) => `D${i}`),
  density: ['N0'],
} as unknown as OrreryPalette;

const run = (runId: string, cohorts: string[], graphHash: string | null = HASH, extra: Partial<StoryRun> = {}): StoryRun => ({
  runId,
  engine: 'fixture',
  n: 100,
  graphHash,
  cohorts,
  ...extra,
});

/** The honesty fixture with two runs that name DIFFERENT cohorts. */
function twoRuns(a: StoryRun, b: StoryRun, reach: Record<string, Record<string, number>>): StoryGraph {
  const g = honestyGraph();
  return { ...g, evidence: { runs: [a, b], reach } };
}

describe('cohort union across runs (model.ts step 3)', () => {
  it('two runs with different cohorts -> both cohorts appear, first-seen across runs', () => {
    const g = twoRuns(run('r1', ['b', 'a']), run('r2', ['a', 'c']), { 'l.zero': { a: 10, c: 20 }, 'l.half': { b: 30 } });
    const model = buildOrreryModel(g, 'fx');
    expect(model.cohorts).toEqual(['b', 'a', 'c']);
    // The second run's cohort is a real measured column, not dropped.
    expect(model.R[ix(model, 'l.zero')].reach).toEqual({ a: 10, c: 20 });
    expect(lensModeOf(model, 'c')).toEqual({ mode: 'cohort', cohort: 'c' });
  });

  it('a row cohort no run declares is still a column, appended after the run cohorts', () => {
    const g = twoRuns(run('r1', ['a']), run('r2', ['b']), { 'l.zero': { a: 1, z: 2 } });
    const model = buildOrreryModel(g, 'fx');
    expect(model.cohorts).toEqual(['a', 'b', 'z']);
    expect(model.R[ix(model, 'l.zero')].reach).toEqual({ a: 1, z: 2 });
  });

  it('ONE unpinned run badges the lens unverified; all pinned reads pinned', () => {
    const reach = { 'l.zero': { a: 1, b: 2 } };
    expect(buildOrreryModel(twoRuns(run('r1', ['a']), run('r2', ['b'], null), reach), 'fx').prov.unverified).toBe(true);
    expect(buildOrreryModel(twoRuns(run('r1', ['a'], null), run('r2', ['b']), reach), 'fx').prov.unverified).toBe(true);
    expect(buildOrreryModel(twoRuns(run('r1', ['a']), run('r2', ['b']), reach), 'fx').prov.unverified).toBe(false);
  });

  it('ONE provisional run makes the lens provisional, whichever position it holds', () => {
    const reach = { 'l.zero': { a: 1, b: 2 } };
    const g = twoRuns(run('r1', ['a']), run('r2', ['b'], HASH, { provisional: true }), reach);
    expect(buildOrreryModel(g, 'fx').prov.provisional).toBe(true);
  });

  it('prov.runs is every real run, in order', () => {
    const g = twoRuns(run('r1', ['a']), run('r2', ['b']), {});
    expect(buildOrreryModel(g, 'fx').prov.runs.map((r) => r.runId)).toEqual(['r1', 'r2']);
  });
});

describe('buildMergedModel without the view-run workaround', () => {
  it('imported + sampled cohorts both appear; prov.runs and raw.evidence are the real runs', () => {
    const g = honestyGraph();
    const merged = mergeWalkEvidence(g, HASH, walkReport());
    const model = buildMergedModel(g, 'fx', merged);
    expect(model.cohorts).toEqual(['all', 'uniform']);
    expect(model.prov.runs.map((r) => r.runId)).toEqual(['r1', 'w1']);
    expect(model.raw.evidence?.runs.map((r) => r.runId)).toEqual(['r1', 'w1']);
    // Nothing internal leaks: no run the document did not carry.
    expect(model.prov.runs.some((r) => r.runId.startsWith('__'))).toBe(false);
  });

  it('a cohort cell keeps its own exact status even while the lens is badged unverified', () => {
    const g = honestyGraph();
    const merged = mergeWalkEvidence(g, HASH, walkReport());
    const by = Object.fromEntries(cohortStatuses(merged).map((c) => [c.cohort, c.status]));
    expect(by).toEqual({ all: 'unverified', uniform: 'verified' });
    expect(worstCellStatus(merged)).toBe('unverified');
    expect(buildMergedModel(g, 'fx', merged).prov.unverified).toBe(true);
  });
});

describe('a measured 0 is not "unmeasured"', () => {
  // Sampled side by side: l.none carries an EXPLICIT 0 for `uniform`, l.ghost is ABSENT.
  const g = { ...honestyGraph(), evidence: undefined };
  const model = buildMergedModel(g, 'fx', mergeWalkEvidence(g, HASH, walkReport()));
  const zero = model.R[ix(model, 'l.none')];
  const absent = model.R[ix(model, 'l.ghost')];
  const lens = lensModeOf(model, 'uniform');

  it('model: explicit 0 is a reach row holding 0; absent is null', () => {
    expect(zero.reach).toEqual({ uniform: 0 });
    expect(absent.reach).toBeNull();
    expect(absent.reachMean).toBeNull();
  });

  it('lens: 0 is measured and painted at the low end of the ramp; absent is the hatch', () => {
    expect(lensValue(model, zero, lens)).toEqual({ state: 'measured', value: 0 });
    expect(lensValue(model, absent, lens)).toEqual({ state: 'unmeasured' });
    expect(fillFor(model, zero, lens, palette)).toEqual({ kind: 'solid', css: 'R0' });
    expect(fillFor(model, absent, lens, palette)).toEqual({ kind: 'hatch' });
    expect(isMeasuredZero(model, zero, lens)).toBe(true);
    expect(isMeasuredZero(model, absent, lens)).toBe(false);
  });

  it('a container mean counts a measured 0 as a 0, not as missing', () => {
    // c.conv holds l.zero (100), l.half (100), l.none (0) measured for `uniform`; l.ghost absent.
    const conv = model.R[ix(model, 'c.conv')];
    expect(conv.reachMeasured).toBe(3);
    expect(conv.reachMean?.uniform).toBeCloseTo(200 / 3, 6);
  });

  it('cohortStatuses counts a 0 cell as a displayed cell', () => {
    const merged = mergeWalkEvidence(g, HASH, walkReport());
    const uniform = cohortStatuses(merged).find((c) => c.cohort === 'uniform');
    expect(uniform?.cells).toBe(3); // l.zero, l.half, l.none (the zero) — l.ghost has no cell
  });
});
