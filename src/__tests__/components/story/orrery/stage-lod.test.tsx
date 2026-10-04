import { describe, it, expect } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import {
  DIVERGE_LENS,
  blockFillFor,
  detailBands,
  foldsAtScale,
  isMeasuredZero,
  lensModeOf,
  lensValue,
  fillFor,
} from '@/components/story/orrery/render/lod';
import { viewStateFor } from '@/components/story/orrery/render/geometry';
import { fitText, labelCandidates, shortTitle, tailLabel, wrapText } from '@/components/story/orrery/render/labels';
import { displayRoot } from '@/components/story/orrery/render/derive';
import { spokeStep } from '@/components/story/orrery/render/drawFlat';
import { parseCssColor, sampleRamp, buildRamp, isLight, mixRgb } from '@/components/story/orrery/render/colorMath';
import { FIXTURES_AVAILABLE, loadGraph } from '@/__tests__/lib/story/orrery/_fixtures';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';
import type { StoryGraph } from '@/lib/story/types';

/** A measurer with a known width per character, so a fit decision is arithmetic, not a guess. */
const measurer = (perChar: number) => ({ measureText: (t: string) => ({ width: t.length * perChar }) });

/** Enough of a palette for the fill functions; every entry is a marker string, never a colour. */
const palette = {
  kind: {
    event: 'K-event',
    choice: 'K-choice',
    gate: 'K-gate',
    ending: 'K-ending',
    entry: 'K-entry',
    template: 'K-template',
    container: 'K-container',
  },
  container: [
    ['C0a', 'C0b'],
    ['C1a', 'C1b'],
    ['C2a', 'C2b'],
    ['C3a', 'C3b'],
    ['C4a', 'C4b'],
  ],
  reach: Array.from({ length: 101 }, (_, i) => `R${i}`),
  diverge: Array.from({ length: 101 }, (_, i) => `D${i}`),
  density: Array.from({ length: 17 }, (_, i) => `N${i}`),
} as unknown as OrreryPalette;

/**
 * A three-cohort document with one node measured, one measured at exactly zero, one container whose
 * reach is derived, and one node never measured at all. These four are the states the port must
 * never conflate.
 */
function honestyDoc(): StoryGraph {
  return {
    format: 'pof.storygraph/1',
    project: 'Honesty',
    graphId: 'h',
    revision: 1,
    profile: { nodeClasses: [] },
    variables: [],
    entries: ['a'],
    nodes: [
      { id: 'root', kind: 'container', title: 'Root' },
      { id: 'a', kind: 'event', title: 'Measured', parent: 'root' },
      { id: 'z', kind: 'event', title: 'Measured zero', parent: 'root' },
      { id: 'box', kind: 'container', title: 'Derived box', parent: 'root' },
      { id: 'b', kind: 'event', title: 'Inside the box', parent: 'box' },
      { id: 'u', kind: 'event', title: 'Never measured', parent: 'root' },
      { id: 'end', kind: 'ending', title: 'The end', parent: 'root' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'z', kind: 'then' },
      { id: 'e2', from: 'z', to: 'b', kind: 'then' },
      { id: 'e3', from: 'b', to: 'u', kind: 'then' },
      { id: 'e4', from: 'u', to: 'end', kind: 'then' },
    ],
    endings: [{ node: 'end' }],
    budgets: { unit: 'words', basis: 'none', perClass: {} },
    evidence: {
      runs: [{ runId: 'r1', engine: 'x', n: 100, graphHash: null, cohorts: ['new', 'veteran'] }],
      reach: {
        a: { new: 80, veteran: 20 },
        z: { new: 0, veteran: 0 },
        b: { new: 40, veteran: 60 },
      },
    },
  } as StoryGraph;
}

describe('the lens keeps unmeasured, measured-zero and derived apart', () => {
  const model = buildOrreryModel(honestyDoc(), 'h');
  const at = (id: string) => model.R[model.idx.get(id) as number];
  const cohort = lensModeOf(model, 'new');

  it('resolves a cohort name, the divergence sentinel and an unknown lens', () => {
    expect(cohort).toEqual({ mode: 'cohort', cohort: 'new' });
    expect(lensModeOf(model, DIVERGE_LENS)).toEqual({ mode: 'diverge' });
    expect(lensModeOf(model, null)).toEqual({ mode: 'kind' });
    expect(lensModeOf(model, 'not-a-cohort')).toEqual({ mode: 'kind' });
  });

  it('reads a measured figure as measured', () => {
    expect(lensValue(model, at('a'), cohort)).toEqual({ state: 'measured', value: 80 });
  });

  it('reads a measured ZERO as measured, not as unmeasured', () => {
    expect(lensValue(model, at('z'), cohort)).toEqual({ state: 'measured', value: 0 });
    expect(isMeasuredZero(model, at('z'), cohort)).toBe(true);
    // Drawn dark with an outline, never hatched.
    expect(fillFor(model, at('z'), cohort, palette)).toEqual({ kind: 'solid', css: 'R0' });
  });

  it('reads a container with measured children as DERIVED, and says how many it was derived from', () => {
    const box = at('box');
    expect(box.reach).toBeNull();
    expect(box.reachMeasured).toBeGreaterThan(0);
    const v = lensValue(model, box, cohort);
    expect(v.state).toBe('derived');
    expect(v.state === 'derived' ? v.value : -1).toBeCloseTo(40, 6);
    expect(fillFor(model, box, cohort, palette)).toEqual({ kind: 'solid', css: 'R40' });
  });

  it('reads a node with no row and no measured descendant as UNMEASURED, and hatches it', () => {
    const u = at('u');
    expect(u.reach).toBeNull();
    expect(u.reachMean).toBeNull();
    expect(lensValue(model, u, cohort)).toEqual({ state: 'unmeasured' });
    expect(fillFor(model, u, cohort, palette)).toEqual({ kind: 'hatch' });
    expect(blockFillFor(model, u, cohort, palette)).toEqual({ kind: 'hatch' });
    // And an unmeasured node is NEVER a measured zero.
    expect(isMeasuredZero(model, u, cohort)).toBe(false);
  });

  it('tints by cohort divergence without inventing a figure for an unmeasured node', () => {
    const diverge = lensModeOf(model, DIVERGE_LENS);
    expect(lensValue(model, at('a'), diverge)).toEqual({ state: 'measured', value: 60 });
    expect(lensValue(model, at('u'), diverge)).toEqual({ state: 'unmeasured' });
    expect(fillFor(model, at('a'), diverge, palette)).toEqual({ kind: 'solid', css: 'D60' });
  });

  it('falls back to node kind and container ring when no lens is on', () => {
    const kind = lensModeOf(model, null);
    expect(fillFor(model, at('a'), kind, palette)).toEqual({ kind: 'solid', css: 'K-event' });
    const box = at('box');
    expect(fillFor(model, box, kind, palette)).toEqual({
      kind: 'solid',
      css: palette.container[Math.min(box.depth, 4)][box.sib & 1],
    });
  });
});

describe('detail is a band read at a scale, not per event', () => {
  const model = buildOrreryModel(honestyDoc(), 'h');
  const root = displayRoot(model);
  const vs = viewStateFor(model, root);

  it('opens up as the scale rises and closes as it falls', () => {
    const tiny = detailBands(model, root, vs, 0.01);
    const big = detailBands(model, root, vs, 40);
    expect(big.rimDepth).toBeGreaterThanOrEqual(tiny.rimDepth);
    expect(big.chordDepth).toBeGreaterThanOrEqual(tiny.chordDepth);
    expect(tiny.rimDepth).toBeGreaterThanOrEqual(model.R[root].depth + 1);
  });

  it('returns the same band for the same scale — it is a pure read', () => {
    expect(detailBands(model, root, vs, 3.5)).toEqual(detailBands(model, root, vs, 3.5));
  });

  it('folds a node whose children would be sub-pixel and not one whose children are wide', () => {
    const box = model.R[model.idx.get('box') as number];
    expect(foldsAtScale(box, vs, 0.0005)).toBe(true);
    expect(foldsAtScale(box, vs, 50)).toBe(false);
    // A leaf never folds: there is nothing inside it to fold.
    expect(foldsAtScale(model.R[model.idx.get('a') as number], vs, 0.0001)).toBe(false);
  });
});

describe('text never overflows', () => {
  it('returns a candidate that fits, untouched', () => {
    expect(fitText(measurer(5), ['Act 3: The Drowned Gate'], 1000)).toBe('Act 3: The Drowned Gate');
  });

  it('falls through to a shorter candidate before truncating', () => {
    // 'The Drowned Gate' is 16 chars = 80px; the full title is 23 chars = 115px.
    expect(fitText(measurer(5), ['Act 3: The Drowned Gate', 'The Drowned Gate'], 100)).toBe(
      'The Drowned Gate',
    );
  });

  it('truncates with an ellipsis and never exceeds the room it was given', () => {
    const m = measurer(5);
    const out = fitText(m, ['Act 3: The Drowned Gate'], 60);
    expect(out).not.toBeNull();
    expect(out?.endsWith('…')).toBe(true);
    expect(m.measureText(out as string).width).toBeLessThanOrEqual(60);
  });

  it('drops the label entirely rather than drawing a bare ellipsis', () => {
    expect(fitText(measurer(5), ['Act 3: The Drowned Gate'], 20)).toBeNull();
    expect(fitText(measurer(5), [], 1000)).toBeNull();
    expect(fitText(measurer(5), [null, undefined], 1000)).toBeNull();
  });

  it('wraps to at most the line count asked for and cuts an unbreakable word', () => {
    const m = measurer(5);
    const lines = wrapText(m, 'one two three four five six seven eight nine ten', 50, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(m.measureText(l).width).toBeLessThanOrEqual(50);
    const long = wrapText(m, 'Unbreakablesupercalifragilistic', 40, 1);
    expect(long).toHaveLength(1);
    expect(m.measureText(long[0]).width).toBeLessThanOrEqual(40);
  });

  it('offers three honest candidates, shortest last', () => {
    const model = buildOrreryModel(honestyDoc(), 'h');
    const i = model.idx.get('b') as number;
    const n = model.R[i];
    expect(labelCandidates(model, n)).toEqual([n.title, shortTitle(n), tailLabel(model, n)]);
    expect(shortTitle({ title: 'Act 3: The Gate' } as never)).toBe('The Gate');
    expect(shortTitle({ title: 'No colon here' } as never)).toBe('No colon here');
  });
});

describe('the dial generalises the winner weeks', () => {
  it('picks a whole-unit spoke interval giving at most a dozen divisions', () => {
    expect(spokeStep(42)).toBe(5);
    expect(spokeStep(7)).toBe(1);
    expect(spokeStep(120)).toBe(10);
    expect(spokeStep(10000)).toBeGreaterThan(100);
    for (const units of [1, 3, 42, 365, 10000]) {
      expect(units / spokeStep(units)).toBeLessThanOrEqual(12.0001);
    }
  });
});

describe('colour arithmetic parses what a browser actually serialises', () => {
  it('reads rgb, rgba, hex and color(srgb …)', () => {
    expect(parseCssColor('rgb(16, 32, 48)')).toEqual({ r: 16, g: 32, b: 48 });
    expect(parseCssColor('rgba(16 32 48 / 0.5)')).toEqual({ r: 16, g: 32, b: 48 });
    // A six-digit hex here is PARSER INPUT, not a design colour: `getComputedStyle` can serialise
    // one, so the parser has to read it. The repo's hex rule is about colours chosen in code.
    // eslint-disable-next-line no-restricted-syntax
    expect(parseCssColor('#102030')).toEqual({ r: 16, g: 32, b: 48 });
    expect(parseCssColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    const srgb = parseCssColor('color(srgb 0.5 0.25 0)');
    expect(srgb?.r).toBeCloseTo(127.5, 1);
  });

  it('returns null rather than a guessed colour for anything else', () => {
    for (const s of ['', null, undefined, 'rebeccapurple', 'var(--or-amber)', 'oklab(0.5 0 0)', 'color(display-p3 1 0 0)']) {
      expect(parseCssColor(s)).toBeNull();
    }
  });

  it('degrades a ramp to the nearest stop when a stop could not be parsed', () => {
    const ramp = buildRamp(
      [
        [0, null, 'LOW'],
        [1, { r: 255, g: 255, b: 255 }, 'HIGH'],
      ],
      5,
    );
    expect(ramp[0]).toBe('LOW');
    expect(ramp[4]).toBe('HIGH');
    expect(sampleRamp([[0, null, 'ONLY']], 0.5)).toBe('ONLY');
  });

  it('flips label ink on a light fill and not on a dark one', () => {
    expect(isLight({ r: 240, g: 250, b: 230 })).toBe(true);
    expect(isLight({ r: 14, g: 26, b: 45 })).toBe(false);
    expect(mixRgb({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 0.5)).toEqual({ r: 50, g: 100, b: 25 });
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('the staged documents', () => {
  it('a document that declares no axis has no dial and no lens cohorts to crash on', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    expect(model.flat).toBeNull();
    const root = displayRoot(model);
    const vs = viewStateFor(model, root);
    expect(() => detailBands(model, root, vs, 1)).not.toThrow();
    // An unknown lens on a document with no cohorts simply reads as kind.
    expect(lensModeOf(model, 'cohort-that-does-not-exist')).toEqual({ mode: 'kind' });
  });
});
