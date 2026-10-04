import { describe, it, expect } from 'vitest';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { displayRoot } from '@/components/story/orrery/render/derive';
import {
  hitTest,
  inWindow,
  nodeAnchor,
  placeOf,
  visibleRep,
  type StageView,
} from '@/components/story/orrery/render/hitTest';
import { ringInner, viewStateFor, wheelOuter } from '@/components/story/orrery/render/geometry';
import { detailBands } from '@/components/story/orrery/render/lod';
import { laneIdOf, resolveKey, siblingsOf } from '@/components/story/orrery/render/keyboard';
import { FIXTURES_AVAILABLE, loadGraph } from '@/__tests__/lib/story/orrery/_fixtures';
import type { StoryEdge, StoryGraph, StoryNode } from '@/lib/story/types';

/** A three-level story: acts, quests, lines. Deep enough that rings and folds both exist. */
function tree(acts = 3, quests = 3, lines = 4): StoryGraph {
  const nodes: StoryNode[] = [{ id: 'root', kind: 'container', class: 'arc', title: 'The Arc' }];
  const edges: StoryEdge[] = [];
  let prev: string | null = null;
  for (let a = 0; a < acts; a++) {
    nodes.push({ id: `a${a}`, kind: 'container', class: 'act', title: `Act ${a + 1}`, parent: 'root' });
    for (let q = 0; q < quests; q++) {
      const qid = `a${a}.q${q}`;
      nodes.push({ id: qid, kind: 'container', class: 'quest', title: `Quest ${a + 1}.${q + 1}`, parent: `a${a}` });
      for (let l = 0; l < lines; l++) {
        const lid = `${qid}.l${l}`;
        nodes.push({
          id: lid,
          kind: l === 1 ? 'choice' : 'event',
          title: `Line ${a + 1}.${q + 1}.${l + 1}`,
          parent: qid,
          text: 'A line of prose that is long enough to need measuring before it is drawn.',
          options: l === 1 ? [{ id: 'o1' }, { id: 'o2' }] : undefined,
        });
        if (prev) edges.push({ id: `e${edges.length}`, from: prev, to: lid, kind: 'then' });
        prev = lid;
      }
    }
  }
  nodes.push({ id: 'entry', kind: 'entry', title: 'Start', parent: 'root' });
  nodes.push({ id: 'end', kind: 'ending', title: 'The End', parent: 'root' });
  nodes.push({ id: 'end2', kind: 'ending', title: 'The Other End', parent: 'root' });
  if (prev) edges.push({ id: `e${edges.length}`, from: prev, to: 'end', kind: 'then' });
  edges.push({ id: `e${edges.length}`, from: 'entry', to: 'a0.q0.l0', kind: 'then' });
  edges.push({ id: `e${edges.length}`, from: 'a0.q0.l1', to: 'a0.q0.l2', kind: 'option', optionId: 'o1', writes: [{ var: 'trust', op: 'add', value: 1 }] });
  edges.push({ id: `e${edges.length}`, from: 'a0.q0.l1', to: 'end2', kind: 'option', optionId: 'o2', writes: [{ var: 'trust', op: 'sub', value: 1 }] });
  return {
    format: 'pof.storygraph/1',
    project: 'Tree',
    graphId: 't',
    revision: 1,
    profile: { nodeClasses: [{ id: 'act', coreKind: 'container', label: 'Act' }] },
    variables: [
      {
        name: 'trust',
        type: 'int',
        domain: { min: 0, max: 10 },
        initial: 0,
        writers: ['a0.q0.l1'],
        scope: 'playthrough',
        external: false,
      },
    ],
    entries: ['entry'],
    nodes,
    edges,
    endings: [{ node: 'end' }, { node: 'end2' }],
    budgets: { unit: 'words', basis: 'none', perClass: {} },
  } as StoryGraph;
}

function viewFor(graph: StoryGraph, scale: number, focus?: number): StageView {
  const model = buildOrreryModel(graph, 'test');
  const root = displayRoot(model);
  const at = focus ?? root;
  const vs = viewStateFor(model, at);
  const bands = detailBands(model, at, vs, scale);
  return { model, vs, focus: at, scale, rimDepth: bands.rimDepth, root };
}

describe('hit testing finds what was drawn', () => {
  const view = viewFor(tree(), 40);
  const { model } = view;
  const centreOf = (i: number) => {
    const place = placeOf(view, i);
    if (!place) return null;
    const a = (place.a0 + place.a1) / 2;
    const r = (place.r0 + place.r1) / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };

  it('finds every sector that has a place, by its own midpoint', () => {
    let checked = 0;
    for (let i = 0; i < model.R.length; i++) {
      const n = model.R[i];
      if (n.dock || n.virtual || i === view.focus) continue;
      const p = centreOf(i);
      if (!p) continue;
      const hit = hitTest(view, p.x, p.y);
      expect(hit, `node ${n.id}`).not.toBeNull();
      // Either the node itself, or the fold standing for it — never something unrelated.
      expect([i, visibleRep(view, i)], `node ${n.id}`).toContain(hit?.i);
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('answers the hub inside the hub radius, and a docked ending on its dot', () => {
    expect(hitTest(view, 0, 0)?.zone).toBe('hub');
    const ending = model.dockEnds[0];
    const pos = model.dockPos.get(ending);
    expect(pos).toBeDefined();
    if (!pos) return;
    const x = Math.cos(pos.a) * pos.rad * 118;
    const y = Math.sin(pos.a) * pos.rad * 118;
    expect(hitTest(view, x, y)).toEqual({ i: ending, zone: 'dock' });
  });

  it('answers nothing well outside the rim', () => {
    const far = wheelOuter(view.vs) + 400;
    expect(hitTest(view, far, far)).toBeNull();
  });

  it('answers the rim band between the outermost ring and the furniture edge', () => {
    const outer = wheelOuter(view.vs);
    const place = placeOf(view, model.idx.get('a0.q0.l0') as number);
    expect(place).not.toBeNull();
    if (!place) return;
    const a = (place.a0 + place.a1) / 2;
    const hit = hitTest(view, Math.cos(a) * (outer + 30), Math.sin(a) * (outer + 30));
    expect(hit?.zone).toBe('rim');
  });

  it('reports a fold as aggregated, and resolves what it stands for', () => {
    // A scale so small that a quest's four lines are sub-pixel.
    const tiny = viewFor(tree(), 0.004);
    const line = tiny.model.idx.get('a0.q0.l0') as number;
    const rep = visibleRep(tiny, line);
    expect(rep).not.toBe(line);
    expect(rep).toBeGreaterThanOrEqual(0);
    // And a node outside the focus has no representative at all.
    const deep = viewFor(tree(), 40, tiny.model.idx.get('a1') as number);
    expect(visibleRep(deep, deep.model.idx.get('a0.q0.l0') as number)).toBe(-1);
  });

  it('places nothing for a docked node and nothing outside the window', () => {
    expect(placeOf(view, model.dockEnds[0])).toBeNull();
    expect(inWindow(view, model.dockEnds[0])).toBe(false);
    const deep = viewFor(tree(), 40, model.idx.get('a1') as number);
    expect(placeOf(deep, model.idx.get('a0') as number)).toBeNull();
  });

  it('anchors a node for the chord layer, inside its own ring', () => {
    const i = model.idx.get('a0.q0') as number;
    const anchor = nodeAnchor(view, i);
    expect(anchor).not.toBeNull();
    if (!anchor) return;
    const r = Math.hypot(anchor.x, anchor.y);
    const ring = model.R[i].depth - view.vs.base;
    expect(r).toBeGreaterThanOrEqual(ringInner(ring, view.vs));
    expect(r).toBeLessThanOrEqual(ringInner(ring + 1, view.vs));
  });
});

describe('keyboard navigation walks the graph, not the geometry', () => {
  const view = viewFor(tree(), 40);
  const { model } = view;
  const ix = (id: string) => model.idx.get(id) as number;

  it('starts on the focus first child when nothing is selected', () => {
    expect(resolveKey(view, -1, 'ArrowRight')).toEqual({ kind: 'select', i: model.R[view.focus].kids[0] });
  });

  it('steps between siblings and stops at both ends', () => {
    const sibs = siblingsOf(view, ix('a0.q1'));
    expect(sibs).toEqual(model.R[ix('a0')].kids);
    expect(resolveKey(view, ix('a0.q1'), 'ArrowRight')).toEqual({ kind: 'select', i: ix('a0.q2') });
    expect(resolveKey(view, ix('a0.q1'), 'ArrowLeft')).toEqual({ kind: 'select', i: ix('a0.q0') });
    expect(resolveKey(view, sibs[sibs.length - 1], 'ArrowRight')).toEqual({ kind: 'none' });
    expect(resolveKey(view, sibs[0], 'ArrowLeft')).toEqual({ kind: 'none' });
  });

  it('descends into the first child and does nothing from a leaf', () => {
    expect(resolveKey(view, ix('a0.q0'), 'ArrowDown')).toEqual({ kind: 'select', i: ix('a0.q0.l0') });
    expect(resolveKey(view, ix('a0.q0.l0'), 'ArrowDown')).toEqual({ kind: 'none' });
  });

  it('climbs to the parent, and asks to go up once it reaches the focus own children', () => {
    expect(resolveKey(view, ix('a0.q0.l0'), 'ArrowUp')).toEqual({ kind: 'select', i: ix('a0.q0') });
    expect(resolveKey(view, ix('a0'), 'ArrowUp')).toEqual({ kind: 'up' });
    expect(resolveKey(view, -1, 'ArrowUp')).toEqual({ kind: 'up' });
  });

  it('sends a docked ending back to the root rather than nowhere', () => {
    expect(resolveKey(view, model.dockEnds[0], 'ArrowUp')).toEqual({ kind: 'select', i: view.root });
    expect(siblingsOf(view, model.dockEnds[0])).toEqual(model.dockEnds);
  });

  it('activates, ascends, zooms and fits', () => {
    expect(resolveKey(view, ix('a0'), 'Enter')).toEqual({ kind: 'activate', i: ix('a0') });
    expect(resolveKey(view, ix('a0'), ' ')).toEqual({ kind: 'activate', i: ix('a0') });
    expect(resolveKey(view, -1, 'Enter')).toEqual({ kind: 'none' });
    expect(resolveKey(view, 0, 'Escape')).toEqual({ kind: 'up' });
    expect(resolveKey(view, 0, 'Backspace')).toEqual({ kind: 'up' });
    const inZoom = resolveKey(view, 0, '+');
    expect(inZoom.kind === 'zoom' && inZoom.factor > 1).toBe(true);
    const outZoom = resolveKey(view, 0, '-');
    expect(outZoom.kind === 'zoom' && outZoom.factor < 1).toBe(true);
    expect(resolveKey(view, 0, '0')).toEqual({ kind: 'fit' });
    expect(resolveKey(view, 0, 'Home')).toEqual({ kind: 'home' });
  });

  it('does not claim a key it has no meaning for', () => {
    for (const key of ['a', 'F5', 'Tab', 'PageDown', '/']) {
      expect(resolveKey(view, 0, key)).toEqual({ kind: 'none' });
    }
  });

  it('tolerates an out-of-range selection', () => {
    expect(resolveKey(view, 99999, 'ArrowRight')).toEqual({
      kind: 'select',
      i: model.R[view.focus].kids[0],
    });
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('the dial, on the staged season document', () => {
  it('hits an item on its own arc and reads its lane', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    const flat = model.flat;
    expect(flat).not.toBeNull();
    if (!flat) return;
    const root = displayRoot(model);
    const view: StageView = {
      model,
      vs: viewStateFor(model, root),
      focus: root,
      scale: 1,
      rimDepth: 99,
      root,
    };
    let found = 0;
    for (const [i] of flat.items) {
      const place = placeOf(view, i);
      expect(place).not.toBeNull();
      if (!place) continue;
      const a = (place.a0 + place.a1) / 2;
      const r = (place.r0 + place.r1) / 2;
      const hit = hitTest(view, Math.cos(a) * r, Math.sin(a) * r);
      expect(hit, model.R[i].id).not.toBeNull();
      if (hit?.i === i) found++;
      expect(laneIdOf(model, i)).not.toBeNull();
    }
    expect(found).toBeGreaterThan(0);
    // The hub answers an ending, and nothing beyond the furniture.
    expect(hitTest(view, flat.outer + 400, 0)).toBeNull();
  });

  it('keeps the dial keyboard inside one lane, in axis order', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    const root = displayRoot(model);
    const view: StageView = {
      model,
      vs: viewStateFor(model, root),
      focus: root,
      scale: 1,
      rimDepth: 99,
      root,
    };
    const first = resolveKey(view, -1, 'ArrowRight');
    expect(first.kind).toBe('select');
    if (first.kind !== 'select') return;
    const lane = laneIdOf(model, first.i);
    const sibs = siblingsOf(view, first.i);
    for (const j of sibs) expect(laneIdOf(model, j)).toBe(lane);
    for (let q = 1; q < sibs.length; q++) {
      expect(model.R[sibs[q]].axis ?? 0).toBeGreaterThanOrEqual(model.R[sibs[q - 1]].axis ?? 0);
    }
  });
});
