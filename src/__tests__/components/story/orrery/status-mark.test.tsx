/**
 * The wheel's stale / unverified cue, measured on the draw commands: a non-verified sector gets a
 * dashed (stale) or dotted (unverified) outline IN ADDITION to its fill, in the warn ink; verified
 * and unmeasured sectors get neither; fills are unchanged. Plus the spoken text and the Legend rows.
 *
 * Plain DOM / value asserts only (no jest-dom), own `afterEach(cleanup)`.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { drawHierarchy } from '@/components/story/orrery/render/drawHier';
import { describeNode, describeShort } from '@/components/story/orrery/render/describe';
import { detailBands, lensModeOf } from '@/components/story/orrery/render/lod';
import { ringInner, sectorAngles, viewStateFor } from '@/components/story/orrery/render/geometry';
import { displayRoot } from '@/components/story/orrery/render/derive';
import { STATUS_STROKE, markSector, newStatusMarks, strokeStatusMarks } from '@/components/story/orrery/render/statusMark';
import { OrreryChrome } from '@/components/story/orrery/OrreryChrome';
import { buildMergedModel, mergeWalkEvidence } from '@/lib/story/orrery/walk';
import { HASH, IMPORTED, SAMPLED_REACH, graph, report } from '@/__tests__/lib/story/orrery/_statusFixture';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';
import type { SceneInput } from '@/components/story/orrery/render/scene';
import type { OrreryModel } from '@/lib/story/orrery';

/* ------------------------------------------------------------------ a recording canvas */

type Op = { op: 'moveTo' | 'arc'; args: number[] };
class RecPath {
  ops: Op[] = [];
  moveTo(...args: number[]) {
    this.ops.push({ op: 'moveTo', args });
  }
  arc(...args: number[]) {
    this.ops.push({ op: 'arc', args });
  }
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
}

interface Stroke {
  style: string;
  dash: number[];
  width: number;
  /** The Path2D stroked, or the ctx's own current path (its arcs since `beginPath`). */
  ops: Op[];
}

function recorder() {
  const fills: string[] = [];
  const strokes: Stroke[] = [];
  let dash: number[] = [];
  let current: Op[] = [];
  const api: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '12px sans-serif',
    setTransform: () => undefined,
    rotate: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    beginPath: () => {
      current = [];
    },
    closePath: () => undefined,
    moveTo: (...args: number[]) => current.push({ op: 'moveTo', args }),
    lineTo: () => undefined,
    arc: (...args: number[]) => current.push({ op: 'arc', args }),
    quadraticCurveTo: () => undefined,
    setLineDash: (d: number[]) => {
      dash = [...d];
    },
    fill: () => fills.push(String(api.fillStyle)),
    stroke: (p?: RecPath) => strokes.push({ style: String(api.strokeStyle), dash, width: Number(api.lineWidth), ops: p ? p.ops : current }),
    fillText: () => undefined,
    measureText: (t: string) => ({ width: String(t).length * 6.6 }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  };
  return { ctx: api as unknown as CanvasRenderingContext2D, fills, strokes };
}

/** Every palette entry is its own name, so a recorded style says which token was used. */
const palette = new Proxy(
  {
    kind: { event: 'K-event', choice: 'K-choice', gate: 'K-gate', ending: 'K-ending', entry: 'K-entry', template: 'K-template', container: 'K-container' },
    container: [0, 1, 2, 3, 4].map((d) => [`C${d}a`, `C${d}b`]),
    reach: Array.from({ length: 101 }, (_, i) => `R${i}`),
    diverge: Array.from({ length: 101 }, (_, i) => `D${i}`),
    density: Array.from({ length: 17 }, (_, i) => `N${i}`),
    chord: { then: () => 'chord-then', option: () => 'chord-option', gate: () => 'chord-gate' },
    hatch: { ground: 'hatch-ground', ink: 'hatch-ink' },
    labelPx: 12,
    fontFamily: 'sans-serif',
    isLightFill: () => false,
  } as Record<string, unknown>,
  { get: (t, k: string) => (k in t ? t[k] : k) },
) as unknown as OrreryPalette;

const SCALE = 2;

function scene(model: OrreryModel, lens: string | null): SceneInput {
  const root = displayRoot(model);
  const vs = viewStateFor(model, root);
  const bands = detailBands(model, root, vs, SCALE);
  return {
    view: { model, vs, focus: root, scale: SCALE, rimDepth: bands.rimDepth, root },
    cam: { cx: 600, cy: 380, scale: SCALE, focus: root, rot: 0 },
    palette,
    lens: lensModeOf(model, lens),
    show: { impact: true, paths: true, influence: true, flags: false },
    rect: { x0: -1e6, x1: 1e6, y0: -1e6, y1: 1e6 },
    width: 1200,
    height: 760,
    dpr: 1,
    offsetX: 0,
    offsetY: 0,
    hatch: null,
    chordDepth: bands.chordDepth,
  };
}

function draw(model: OrreryModel, lens: string | null) {
  const rec = recorder();
  drawHierarchy(rec.ctx, scene(model, lens));
  return rec;
}

/** Which node ids a marker stroke's sector subpaths sit inside (by their outer arc). */
function markedIds(model: OrreryModel, stroke: Stroke): string[] {
  const vs = viewStateFor(model, displayRoot(model));
  const ids: string[] = [];
  for (let k = 0; k < stroke.ops.length - 1; k++) {
    const a = stroke.ops[k + 1];
    if (stroke.ops[k].op !== 'moveTo' || a.op !== 'arc' || a.args[0] !== 0 || a.args[1] !== 0) continue;
    const [, , r, b0, b1] = a.args;
    for (const n of model.R) {
      if (n.dock || n.u1 <= n.u0) continue;
      const ring = n.depth - vs.base;
      if (ring < 1) continue;
      const { a0, a1 } = sectorAngles(n, vs);
      if (b0 >= a0 - 1e-9 && b1 <= a1 + 1e-9 && r > ringInner(ring, vs) && r <= ringInner(ring + 1, vs) + 1e-9) ids.push(n.id);
    }
  }
  return ids.sort();
}

const dashOf = (s: 'stale' | 'unverified') => STATUS_STROKE[s].dash.map((d) => d / SCALE);
const markers = (strokes: Stroke[], s: 'stale' | 'unverified') =>
  strokes.filter((x) => x.style === 'statusInk' && JSON.stringify(x.dash) === JSON.stringify(dashOf(s)));

beforeAll(() => {
  vi.stubGlobal('Path2D', RecPath);
});
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(cleanup);

const g = graph(IMPORTED);
const fresh = buildMergedModel(g, 'k', mergeWalkEvidence(g, HASH, report(HASH, SAMPLED_REACH)));
const stale = buildMergedModel(graph(), 'k', mergeWalkEvidence(graph(), HASH, report('sha256:old', SAMPLED_REACH)));
const before = (m: OrreryModel): OrreryModel => ({ ...m, status: undefined });

describe('the status outline on the draw commands', () => {
  it('unverified (imported fighter) sectors carry one dotted warn-ink stroke over exactly the measured sectors', () => {
    const { strokes } = draw(fresh, 'fighter');
    const dotted = markers(strokes, 'unverified');
    expect(dotted.length).toBe(1);
    expect(dotted[0].width).toBeCloseTo(STATUS_STROKE.unverified.width / SCALE);
    // l4, l5 and sc3 are unmeasured for fighter: hatch only, never a marker.
    expect(markedIds(fresh, dotted[0])).toEqual(['l1', 'l2', 'l3', 'sc1', 'sc2']);
    expect(markers(strokes, 'stale').length).toBe(0);
    // Under it, a ground-coloured halo on the SAME path and dashes, so it reads on pale fills too.
    const halo = strokes[strokes.indexOf(dotted[0]) - 1];
    expect(halo.style).toBe('bg');
    expect(halo.dash).toEqual(dotted[0].dash);
    expect(halo.ops).toBe(dotted[0].ops);
  });

  it('verified (sampled uniform) sectors carry no marker at all', () => {
    const { strokes } = draw(fresh, 'uniform');
    expect(strokes.filter((x) => x.style === 'statusInk').length).toBe(0);
  });

  it('stale sectors carry one dashed stroke, never a dotted one', () => {
    const { strokes } = draw(stale, 'uniform');
    // Two dashed strokes: the ring pass and the hub (the stale `end` dot), each ONE batched stroke.
    const dashed = markers(strokes, 'stale');
    expect(dashed.length).toBe(2);
    expect(markedIds(stale, dashed[0])).toEqual(['l1', 'l2', 'l3', 'sc1', 'sc2']);
    expect(dashed[1].ops.filter((o) => o.op === 'arc').length).toBe(1);
    expect(markers(strokes, 'unverified').length).toBe(0);
  });

  it('no lens, no marker', () => {
    expect(draw(fresh, null).strokes.filter((x) => x.style === 'statusInk').length).toBe(0);
  });

  it('a stale measured zero keeps its zero outline AND gets the dashed marker, inset so both read', () => {
    const { strokes } = draw(stale, 'uniform');
    const vs = viewStateFor(stale, displayRoot(stale));
    const l2 = stale.R[stale.idx.get('l2') as number];
    const r1 = ringInner(l2.depth - vs.base + 1, vs);
    const zero = strokes.find((x) => x.style === 'measuredZero');
    expect(zero).toBeDefined();
    expect(zero?.dash).toEqual([]);
    // The zero outline runs ON the sector edge; the marker runs strictly inside it.
    expect(zero?.ops.some((o) => o.op === 'arc' && Math.abs(o.args[2] - r1) < 1e-9)).toBe(true);
    const dashed = markers(strokes, 'stale')[0];
    const { a0, a1 } = sectorAngles(l2, vs);
    const inner = dashed.ops.filter((o) => o.op === 'arc' && o.args[3] > a0 && o.args[4] < a1 && o.args[2] <= r1);
    expect(inner.length).toBeGreaterThan(0);
    for (const o of inner) expect(o.args[2]).toBeLessThan(r1 - 1 / SCALE);
  });

  it('fills are byte-identical to the pre-status draw for stale, unverified, verified and unmeasured', () => {
    for (const [m, lens] of [
      [stale, 'uniform'],
      [fresh, 'fighter'],
      [fresh, 'uniform'],
      [fresh, null],
    ] as const) {
      expect(draw(m, lens).fills).toEqual(draw(before(m), lens).fills);
    }
  });

  it('a hub-docked ending is ringed too (dotted around the dot), so the cue covers every drawn reach figure', () => {
    // `end` is measured only for uniform (verified): nothing. Make it unverified via an imported cohort.
    const imp = { ...IMPORTED, reach: { ...IMPORTED.reach, end: { fighter: 5 } } };
    const gg = graph(imp);
    const m = buildMergedModel(gg, 'k', mergeWalkEvidence(gg, HASH, report(HASH, SAMPLED_REACH)));
    const dotted = draw(m, 'fighter').strokes.filter((x) => x.style === 'statusInk');
    const dots = dotted.flatMap((s) => s.ops.filter((o) => o.op === 'arc' && (o.args[0] !== 0 || o.args[1] !== 0)));
    expect(dots.length).toBe(1);
  });
});

describe('slivers share one outline per run (10k-node density)', () => {
  it('contiguous same-status slivers in one ring are outlined once; a wide sector gets its own; a gap or a status change splits', () => {
    const marks = newStatusMarks();
    const r0 = 100;
    const r1 = 110;
    const w = 0.001; // ~0.1px at scale 1: a sliver
    for (let k = 0; k < 50; k++) markSector(marks, 'unverified', k * w, (k + 1) * w, r0, r1, 1);
    markSector(marks, 'stale', 50 * w, 51 * w, r0, r1, 1); // status change: a new run
    markSector(marks, 'unverified', 60 * w, 61 * w, r0, r1, 1); // gap: a new run
    markSector(marks, 'unverified', 1, 1.5, 200, 240, 1); // wide: its own outline
    markSector(marks, 'verified', 2, 2.001, r0, r1, 1); // verified: nothing
    const rec = recorder();
    strokeStatusMarks(rec.ctx, marks, palette, 1);
    const unver = rec.strokes.find((x) => JSON.stringify(x.dash) === JSON.stringify(STATUS_STROKE.unverified.dash));
    const stale = rec.strokes.find((x) => JSON.stringify(x.dash) === JSON.stringify(STATUS_STROKE.stale.dash));
    const subpaths = (x?: Stroke) => (x?.ops ?? []).filter((o) => o.op === 'moveTo').length;
    expect(subpaths(unver)).toBe(3); // the 50-sliver run, the lone sliver after the gap, the wide one
    expect(subpaths(stale)).toBe(1);
    // The merged run spans all 50 slivers.
    const outer = unver?.ops.find((o) => o.op === 'arc' && o.args[2] === r1);
    expect(outer?.args[3]).toBeCloseTo(0);
    expect(outer?.args[4]).toBeCloseTo(50 * w);
  });
});

describe('the status, spoken', () => {
  const at = (m: OrreryModel, id: string) => m.idx.get(id) as number;

  it('the live-region sentence says figure, source and status', () => {
    expect(describeNode(fresh, at(fresh, 'l1'), 'fighter')).toContain('reach 40% - imported, unverified');
    expect(describeNode(fresh, at(fresh, 'l1'), 'uniform')).toContain('reach 50% - sampled, verified');
    expect(describeNode(stale, at(stale, 'l1'), 'uniform')).toContain('reach 50% - sampled, stale');
    expect(describeNode(stale, at(stale, 'sc1'), 'uniform')).toMatch(/reach 25%, derived from 2 measured descendants - stale/);
  });

  it('an unmeasured node is never given a figure or a status', () => {
    const s = describeNode(fresh, at(fresh, 'l4'), 'fighter');
    expect(s).toContain('never measured, which is not zero');
    expect(s).not.toMatch(/unverified|stale|verified/);
  });

  it('the tooltip line carries it too', () => {
    expect(describeShort(stale, stale.R[at(stale, 'l2')], 'uniform')).toContain('reach 0% - sampled, stale');
    expect(describeShort(stale, stale.R[at(stale, 'l2')], null)).not.toContain('reach');
  });

  it('the chrome live region speaks the lens status for the selection', () => {
    const { container } = render(
      <OrreryChrome
        model={fresh}
        focus={fresh.root}
        selected={at(fresh, 'l1')}
        datasets={[{ key: 'k', label: 'Status' }]}
        activeDataset="k"
        onDataset={vi.fn()}
        lens="fighter"
        onLens={vi.fn()}
        show={{ impact: true, paths: true, influence: true, flags: true }}
        onToggle={vi.fn()}
        onFocus={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-role=orrery-sr]')?.textContent).toContain('reach 40% - imported, unverified');
  });
});

describe('the Legend explains the two outlines', () => {
  function legend(lens: string | null) {
    return render(
      <OrreryChrome
        model={fresh}
        focus={fresh.root}
        datasets={[{ key: 'k', label: 'Status' }]}
        activeDataset="k"
        onDataset={vi.fn()}
        lens={lens}
        onLens={vi.fn()}
        show={{ impact: true, paths: true, influence: true, flags: true }}
        onToggle={vi.fn()}
        onFocus={vi.fn()}
        onSelect={vi.fn()}
      />,
    ).container.querySelector('[data-role=orrery-legend]');
  }

  it('with a lens on: a dashed row for stale and a dotted row for unverified, in words', () => {
    const el = legend('fighter');
    const stale = el?.querySelector('[data-role=orrery-legend-swatch][data-status=stale]') as HTMLElement | null;
    const unver = el?.querySelector('[data-role=orrery-legend-swatch][data-status=unverified]') as HTMLElement | null;
    expect(stale?.style.border).toContain('dashed');
    expect(unver?.style.border).toContain('dotted');
    expect(stale?.nextElementSibling?.textContent).toContain('dashed outline = stale');
    expect(unver?.nextElementSibling?.textContent).toContain('dotted outline = unverified');
  });

  it('with no lens on there is no figure, so no status rows', () => {
    expect(legend(null)?.querySelector('[data-status]')).toBeNull();
  });
});
