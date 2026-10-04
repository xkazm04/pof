import { describe, it, expect } from 'vitest';
import {
  ORRERY_GEOMETRY,
  innerRadius,
  layoutDocks,
  layoutFlat,
  layoutHierarchy,
  ringThicknessFor,
  trackLanes,
} from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryNode } from '@/lib/story/orrery/types';
import type { StoryNode, StoryNodeKind } from '@/lib/story/types';

/**
 * The layout takes its nodes as an argument, so it can be exercised without a document, without
 * a model and without a DOM — including at a scale no fixture reaches.
 */
function node(i: NodeIx, over: Partial<OrreryNode> & { id: string; kind: StoryNodeKind }): OrreryNode {
  const raw: StoryNode = { id: over.id, kind: over.kind };
  return {
    i,
    cls: '',
    title: over.id,
    axis: null,
    par: -1,
    kids: [],
    docks: null,
    depth: 0,
    w: 1,
    u0: 0,
    u1: 0,
    maxd: 0,
    text: '',
    lanes: [],
    reach: null,
    reachMean: null,
    reachMeasured: 0,
    ch: null,
    dock: false,
    raw,
    nChoice: 0,
    nFalse: 0,
    nCos: 0,
    impSum: 0,
    impMax: 0,
    nFlag: 0,
    flags: null,
    sib: 0,
    cnt: null,
    ...over,
  };
}

/** A balanced tree: `branching ** depth` leaves, wired as containment only. */
function syntheticTree(branching: number, depth: number): { nodes: OrreryNode[]; root: NodeIx } {
  const nodes: OrreryNode[] = [node(0, { id: 'root', kind: 'container' })];
  let frontier: NodeIx[] = [0];
  for (let d = 0; d < depth; d++) {
    const next: NodeIx[] = [];
    for (const p of frontier) {
      for (let b = 0; b < branching; b++) {
        const i = nodes.length;
        nodes.push(node(i, { id: `n${i}`, kind: d === depth - 1 ? 'event' : 'container', par: p }));
        nodes[p].kids.push(i);
        next.push(i);
      }
    }
    frontier = next;
  }
  return { nodes, root: 0 };
}

describe('layoutHierarchy', () => {
  it('partitions the turn by subtree weight', () => {
    const { nodes, root } = syntheticTree(3, 2);
    const { order, maxDepth } = layoutHierarchy(nodes, root, { compare: (a, b) => a - b });
    expect(maxDepth).toBe(2);
    expect(order.length).toBe(nodes.length);
    expect(nodes[root].u0).toBe(0);
    expect(nodes[root].u1).toBe(1);
    expect(nodes[root].w).toBe(13); // 1 + 3 * (1 + 3)
    // The children partition the parent's span between themselves: the parent's own weight is
    // not part of the share, so three equal branches take exactly a third of the turn each.
    for (const k of nodes[root].kids) expect(nodes[k].u1 - nodes[k].u0).toBeCloseTo(1 / 3, 12);
    // A leaf's span is its parent's span over its siblings' weights, and seams are exact.
    for (const i of order) {
      const n = nodes[i];
      if (!n.kids.length) continue;
      expect(nodes[n.kids[0]].u0).toBe(n.u0);
      expect(nodes[n.kids[n.kids.length - 1]].u1).toBe(n.u1);
    }
  });

  it('orders siblings by the comparator it is given, and nothing else', () => {
    const nodes = [
      node(0, { id: 'root', kind: 'container' }),
      node(1, { id: 'a', kind: 'event', par: 0, axis: 9 }),
      node(2, { id: 'b', kind: 'event', par: 0, axis: 1 }),
      node(3, { id: 'c', kind: 'event', par: 0, axis: 5 }),
    ];
    nodes[0].kids = [1, 2, 3];
    layoutHierarchy(nodes, 0, { compare: (a, b) => (nodes[a].axis ?? 0) - (nodes[b].axis ?? 0) || a - b });
    expect(nodes[0].kids).toEqual([2, 3, 1]);
    expect(nodes[2].sib).toBe(0);
    expect(nodes[1].sib).toBe(2);
  });

  it('pins leaf endings, templates and the entry to the hub instead of the wheel', () => {
    const nodes = [
      node(0, { id: 'root', kind: 'container' }),
      node(1, { id: 'e1', kind: 'ending', par: 0 }),
      node(2, { id: 't1', kind: 'template', par: 0 }),
      node(3, { id: 'start', kind: 'entry', par: 0 }),
      node(4, { id: 'beat', kind: 'event', par: 0 }),
      node(5, { id: 'act', kind: 'container', par: 0 }),
      node(6, { id: 'inner-ending', kind: 'ending', par: 5 }),
    ];
    nodes[0].kids = [1, 2, 3, 4, 5];
    nodes[5].kids = [6];
    const { docks, order } = layoutHierarchy(nodes, 0, { compare: (a, b) => a - b });
    expect(docks).toEqual([1, 2, 3]);
    expect(nodes[0].kids).toEqual([4, 5]);
    expect(nodes[0].docks).toEqual([1, 2, 3]);
    for (const d of docks) {
      expect(nodes[d].dock).toBe(true);
      expect(nodes[d].u0).toBe(-1);
      expect(nodes[d].u1).toBe(-1);
      expect(order).not.toContain(d);
    }
    // An ending inside a container keeps its sector: only the root's own leaves dock.
    expect(nodes[6].dock).toBe(false);
    expect(nodes[6].u1).toBeGreaterThan(nodes[6].u0);
  });

  it('lays out 10,000 nodes deterministically and fast', () => {
    const build = () => {
      const { nodes, root } = syntheticTree(10, 4); // 11,111 nodes
      const t0 = performance.now();
      const res = layoutHierarchy(nodes, root, { compare: (a, b) => a - b });
      return { nodes, res, ms: performance.now() - t0 };
    };
    const first = build();
    expect(first.nodes.length).toBe(11111);
    const second = build();
    expect(second.nodes.map((n) => [n.u0, n.u1, n.depth, n.w])).toEqual(
      first.nodes.map((n) => [n.u0, n.u1, n.depth, n.w]),
    );
    expect(first.res.maxDepth).toBe(4);
    expect(first.ms).toBeLessThan(200);
  });
});

describe('layoutDocks', () => {
  const nodes = [
    node(0, { id: 'root', kind: 'container' }),
    node(1, { id: 'E.late', kind: 'ending', par: 0 }),
    node(2, { id: 'E.early', kind: 'ending', par: 0 }),
    node(3, { id: 'tmpl', kind: 'template', par: 0 }),
    node(4, { id: 'start', kind: 'entry', par: 0 }),
  ];

  it('orders endings by declared precedence and leaves the rest at known angles', () => {
    const { dockPos, dockEnds, dockTmpl, dockEntry } = layoutDocks(
      nodes,
      [1, 2, 3, 4],
      new Map([['E.early', 1], ['E.late', 2]]),
    );
    expect(dockEnds).toEqual([2, 1]);
    expect(dockTmpl).toEqual([3]);
    expect(dockEntry).toEqual([4]);
    expect(dockPos.get(2)?.a).toBeCloseTo(-Math.PI / 2 + (Math.PI * 2 * 0.5) / 2, 10);
    expect(dockPos.get(4)?.a).toBeCloseTo(-Math.PI / 2, 10);
    expect(dockPos.size).toBe(4);
    // Radii and dot sizes are shares of the hub radius, as the prototype had them: endings on a
    // 0.6 ring, templates further out and tiny, the entry just inside the rim at twelve.
    expect(dockPos.get(1)?.rad).toBe(0.6);
    expect(dockPos.get(1)?.size).toBeCloseTo(Math.min(0.19, ((Math.PI * 0.6) / 2) * 0.78), 10);
    // One template sits half a turn from twelve, like a lone ending on its own ring.
    expect(dockPos.get(3)).toEqual({ a: Math.PI / 2, rad: 0.9, size: 0.022 });
    expect(dockPos.get(4)?.rad).toBe(0.82);
    expect(dockPos.get(4)?.size).toBe(0.07);
  });

  it('puts a lone ending below the hub centre, but not on the dial', () => {
    const { dockPos, dockEnds } = layoutDocks(nodes, [1], new Map());
    expect(dockEnds).toEqual([1]);
    expect(dockPos.get(1)).toEqual({ a: Math.PI / 2, rad: 0.3, size: 0.17 });
    // The dial's hub has no room for that nudge, so a lone ending stays on the ring there.
    const dial = layoutDocks(nodes, [1], new Map(), { mode: 'dial' });
    expect(dial.dockPos.get(1)?.rad).toBe(0.6);
    expect(dial.dockPos.get(1)?.size).toBeLessThanOrEqual(0.17);
  });

  it('sorts an ending with no declared precedence after the ones that have it', () => {
    const { dockEnds } = layoutDocks(nodes, [1, 2], new Map([['E.late', 1]]));
    expect(dockEnds).toEqual([1, 2]);
  });
});

describe('layoutFlat', () => {
  const axis = { name: 'day', unit: 'in-game day', min: 1, max: 10 };
  const nodes = [
    node(0, { id: 'd1', kind: 'event', axis: 1, lanes: ['main'] }),
    node(1, { id: 'd10', kind: 'event', axis: 10, lanes: ['arena'] }),
    node(2, { id: 'noaxis', kind: 'event', lanes: ['main'] }),
    node(3, { id: 'ending', kind: 'ending', axis: 10, lanes: ['ending'] }),
    node(4, { id: 'span', kind: 'container', axis: 7, lanes: ['main'], kids: [5, 6] }),
    node(5, { id: 'k1', kind: 'event', axis: 4, par: 4, lanes: ['main'] }),
    node(6, { id: 'k2', kind: 'event', axis: 6, par: 4, lanes: ['main'] }),
  ];

  it('leaves a seam, spans one turn, and places items by axis and lane', () => {
    const flat = layoutFlat(nodes, { axis, laneIds: ['main', 'arena'], excluded: new Set([3]) });
    expect(flat.lanes).toEqual(['main', 'arena']);
    expect(flat.outer).toBe(ORRERY_GEOMETRY.flatHubRadius + ORRERY_GEOMETRY.flatHubGap + 2 * ORRERY_GEOMETRY.flatTrackThickness);
    // 10 axis units plus a 3-unit seam fill exactly one turn.
    expect(flat.per * 13).toBeCloseTo(Math.PI * 2, 10);
    expect(flat.dayA - flat.a0).toBeCloseTo(flat.per * 10, 10);
    // One axis unit wide, and packed into the lane's second row because the container that spans
    // days 4-6 took the first.
    expect(flat.items.get(0)).toEqual({ u: 0, u1: 0.1, lane: 0, row: 1, rows: 2 });
    expect(flat.items.get(1)).toEqual({ u: 0.9, u1: 1, lane: 1, row: 0, rows: 1 });
    // A node with no axis position cannot sit on the dial; an excluded one docks instead.
    expect(flat.items.has(2)).toBe(false);
    expect(flat.items.has(3)).toBe(false);
    // A container spans its children's whole range: days 4 to 6 inclusive, not its own axis tick.
    expect(flat.items.get(4)?.u).toBeCloseTo(0.3, 10);
    expect(flat.items.get(4)?.u1).toBeCloseTo(0.6, 10);
    expect(flat.items.get(4)?.row).toBe(0);
  });

  it('packs overlapping items in one lane into sub-rows, and leaves the rest alone', () => {
    const lane = [
      node(0, { id: 'a', kind: 'event', axis: 1, lanes: ['main'] }),
      node(1, { id: 'b', kind: 'event', axis: 1, lanes: ['main'] }),
      node(2, { id: 'c', kind: 'event', axis: 1, lanes: ['main'] }),
      node(3, { id: 'far', kind: 'event', axis: 8, lanes: ['main'] }),
      node(4, { id: 'other', kind: 'event', axis: 1, lanes: ['arena'] }),
    ];
    const flat = layoutFlat(lane, { axis, laneIds: ['main', 'arena'], excluded: new Set() });
    // Three items on the same day cannot share a row; the fourth is clear of all of them and
    // reuses the first row. Every item in a lane reports the same `rows`, which is the divisor.
    expect([0, 1, 2].map((i) => flat.items.get(i)?.row)).toEqual([0, 1, 2]);
    expect(flat.items.get(3)?.row).toBe(0);
    for (const i of [0, 1, 2, 3]) expect(flat.items.get(i)?.rows).toBe(3);
    // A quiet lane is not paid for by a busy one.
    expect(flat.items.get(4)).toEqual({ u: 0, u1: 0.1, lane: 1, row: 0, rows: 1 });
  });

  it('gives choices that share an axis position their own rim slot', () => {
    const sharing = [
      node(0, { id: 'c1', kind: 'choice', axis: 3, lanes: ['main'], nChoice: 1 }),
      node(1, { id: 'c2', kind: 'choice', axis: 3, lanes: ['main'], nChoice: 1 }),
      node(2, { id: 'alone', kind: 'choice', axis: 7, lanes: ['main'], nChoice: 1 }),
      node(3, { id: 'beat', kind: 'event', axis: 3, lanes: ['main'] }),
    ];
    const flat = layoutFlat(sharing, { axis, laneIds: ['main'], excluded: new Set() });
    // Two spikes on one day would land on one angle, so the day is split between them.
    expect(flat.items.get(0)?.slot).toBe(0);
    expect(flat.items.get(1)?.slot).toBe(1);
    expect(flat.items.get(0)?.slots).toBe(2);
    expect(flat.items.get(1)?.slots).toBe(2);
    // A choice with the day to itself gets the whole angle. Three items share day 3, so the lane
    // needed three sub-rows and every item in it reports that divisor.
    expect(flat.items.get(2)).toEqual({ u: 0.6, u1: 0.7, lane: 0, row: 0, rows: 3, slot: 0, slots: 1 });
    // A node that carries no impact spike needs no slot at all.
    expect(flat.items.get(3)?.slot).toBeUndefined();
    expect(flat.items.get(3)?.slots).toBeUndefined();
  });

  it('falls back to the first track for a node in no declared lane', () => {
    const flat = layoutFlat(nodes, { axis, laneIds: ['arena', 'main'], excluded: new Set() });
    // 'ending' is not a track in this call, so the node falls back to the first track.
    expect(flat.items.get(3)?.lane).toBe(0);
    expect(flat.items.get(0)?.lane).toBe(1); // 'main' is the second track here
  });
});

describe('trackLanes', () => {
  it('drops a lane whose only members are endings', () => {
    const nodes = [
      node(0, { id: 'a', kind: 'event', lanes: ['main'] }),
      node(1, { id: 'e', kind: 'ending', lanes: ['ending'] }),
      node(2, { id: 'b', kind: 'event', lanes: ['mixed'] }),
      node(3, { id: 'e2', kind: 'ending', lanes: ['mixed'] }),
    ];
    const declared = [{ id: 'main' }, { id: 'ending' }, { id: 'mixed' }, { id: 'empty' }];
    // 'mixed' holds a non-ending too, so it keeps a track; an unused lane keeps its track.
    expect(trackLanes(nodes, declared)).toEqual(['main', 'mixed', 'empty']);
  });
});

describe('ring geometry', () => {
  it('thins the rings as the wheel deepens', () => {
    expect(ringThicknessFor(1)).toBe(136);
    expect(ringThicknessFor(2)).toBe(112);
    expect(ringThicknessFor(3)).toBe(92);
    expect(ringThicknessFor(9)).toBe(78);
  });

  it('puts ring 0 at the centre and stacks the rest on the hub', () => {
    expect(innerRadius(0, 100)).toBe(0);
    expect(innerRadius(0.5, 100)).toBe(ORRERY_GEOMETRY.hubRadius * 0.5);
    expect(innerRadius(1, 100)).toBe(ORRERY_GEOMETRY.hubRadius);
    expect(innerRadius(3, 100)).toBe(ORRERY_GEOMETRY.hubRadius + 200);
  });
});
