/**
 * Orrery polar layout — the pure geometry half of the model.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3, "Orrery").
 * Two layouts live here, and a document picks one:
 *
 *  - **the containment sunburst** (`layoutHierarchy`) — clockwise is story time, each ring is one
 *    level of containment, and a node's angular share is its subtree weight. Output is *unit*
 *    space: `u` runs 0..1 around the wheel, `depth` is the ring. Nothing here knows about pixels.
 *  - **the lane x axis dial** (`layoutFlat`) — built only for a document that declares
 *    `profile.axis` with enough lanes to be worth a track each. Output is in world units, because
 *    the dial's radii are a property of the layout (one track per lane), not of the camera.
 *
 * Every function takes its nodes and its options as arguments — there is no module-level state and
 * no DOM, so the same input always gives the same output and the layout can be measured at
 * 10,000 synthetic nodes in a test.
 */

import type { StoryNodeKind, StoryProfileAxis } from '@/lib/story/types';
import type { DockPos, FlatItem, FlatLayout, NodeIx, OrreryNode } from '@/lib/story/orrery/types';

const TAU = Math.PI * 2;
/** Twelve o'clock. The wheel starts here and runs clockwise. */
const TOP_ANGLE = -Math.PI / 2;

/**
 * World-unit geometry, lifted from the prototype's `app.js` so the surface and the flat layout
 * agree on one set of numbers. The containment wheel's radii are the camera's business (it
 * re-roots and so re-scales the rings); only the dial's are baked in here.
 */
export const ORRERY_GEOMETRY = {
  /** Hub radius of the containment wheel (prototype `R0`). */
  hubRadius: 118,
  /** Ring thickness by visible level count, 1..4+ (prototype `tFor`). */
  ringThickness: [136, 112, 92, 78],
  /** Rim furniture extent beyond the outermost ring (prototype `FRIM`). */
  rimExtent: 96,
  /** Impact-bar offset from the rim, and the length of a full-height bar. */
  barBase: 26,
  barMax: 52,
  /** Flat dial: hub radius, one lane track's thickness, and the hub-to-first-track gap. */
  flatHubRadius: 96,
  flatTrackThickness: 58,
  flatHubGap: 18,
  /** Blank axis units left as the dial's seam, so day 1 and day N do not touch. */
  flatAxisGap: 3,
} as const;

/** Ring thickness for a focus that shows `levels` rings. Thinner rings as the wheel deepens. */
export function ringThicknessFor(levels: number): number {
  const t = ORRERY_GEOMETRY.ringThickness;
  return levels >= 4 ? t[3] : levels === 3 ? t[2] : levels === 2 ? t[1] : t[0];
}

/** Inner radius of ring `i` counted from the current focus, given the ring thickness. */
export function innerRadius(ring: number, thickness: number): number {
  const r0 = ORRERY_GEOMETRY.hubRadius;
  if (ring <= 0) return 0;
  if (ring < 1) return r0 * ring;
  return r0 + (ring - 1) * thickness;
}

/** Kinds that dock at the hub instead of taking a sector on the wheel. */
export const DEFAULT_DOCK_KINDS: readonly StoryNodeKind[] = ['ending', 'template', 'entry'];

export interface HierarchyOptions {
  /**
   * Total order over sibling node indices — the one place the document's ordering dimension
   * enters the layout. It MUST be a total order (tie-break on the index) or the layout stops
   * being deterministic.
   */
  compare: (a: NodeIx, b: NodeIx) => number;
  /** Kinds pinned to the hub. Defaults to endings, templates and the entry. */
  dockKinds?: readonly StoryNodeKind[];
}

export interface HierarchyLayout {
  /** Containment pre-order, parents before children. Docked nodes are not in it. */
  order: NodeIx[];
  /** Deepest ring in the whole wheel. */
  maxDepth: number;
  /** The root's hub docks, in document order. */
  docks: NodeIx[];
}

/**
 * The containment sunburst. Mutates the layout fields of the records it is given (`depth`, `w`,
 * `maxd`, `u0`, `u1`, `sib`, `dock`, `docks`) — that is how the prototype works and what
 * `OrreryNode` declares, and the mutation is confined to model construction.
 *
 * `u0`/`u1` are the node's angular span as a fraction of the turn, assigned by subtree weight so
 * a sector is as wide as the story it contains. A docked node gets `u0 = u1 = -1`: it has no
 * sector, and `OrreryModel.can` reads exactly that.
 */
export function layoutHierarchy(
  nodes: OrreryNode[],
  root: NodeIx,
  options: HierarchyOptions,
): HierarchyLayout {
  const R = nodes;
  const dockKinds = options.dockKinds ?? DEFAULT_DOCK_KINDS;

  // Sort every sibling list. Collected first so the sort cannot be disturbed by the walk.
  const subtree: NodeIx[] = [];
  const stack: NodeIx[] = [root];
  while (stack.length) {
    const i = stack.pop() as NodeIx;
    subtree.push(i);
    for (const k of R[i].kids) stack.push(k);
  }
  for (const i of subtree) if (R[i].kids.length > 1) R[i].kids.sort(options.compare);

  // Hub docks: leaf endings, templates and the entry, taken off the root's sibling ring.
  const rr = R[root];
  const docks = rr.kids.filter((k) => R[k].kids.length === 0 && dockKinds.includes(R[k].kind));
  if (docks.length > 0) {
    const docked = new Set(docks);
    rr.kids = rr.kids.filter((k) => !docked.has(k));
  }
  rr.docks = docks;
  for (const k of docks) {
    const n = R[k];
    n.dock = true;
    n.depth = 1;
    n.u0 = -1;
    n.u1 = -1;
  }

  // Pre-order with ring depth. Children are pushed in reverse so `order` reads in sibling order.
  rr.depth = 0;
  const order: NodeIx[] = [];
  const walk: NodeIx[] = [root];
  while (walk.length) {
    const i = walk.pop() as NodeIx;
    order.push(i);
    const kids = R[i].kids;
    for (let q = kids.length - 1; q >= 0; q--) {
      R[kids[q]].depth = R[i].depth + 1;
      walk.push(kids[q]);
    }
  }

  // Subtree weight and deepest descendant ring, in reverse pre-order (children first).
  for (let a = order.length - 1; a >= 0; a--) {
    const n = R[order[a]];
    let w = 1;
    let maxd = n.depth;
    for (const k of n.kids) {
      w += R[k].w;
      if (R[k].maxd > maxd) maxd = R[k].maxd;
    }
    n.w = w;
    n.maxd = maxd;
  }

  // Angular share, parents first: each child takes its weight's slice of the parent's span.
  rr.u0 = 0;
  rr.u1 = 1;
  for (const i of order) {
    const n = R[i];
    if (n.kids.length === 0) continue;
    let total = 0;
    for (const k of n.kids) total += R[k].w;
    const span = n.u1 - n.u0;
    let u = n.u0;
    const last = n.kids.length - 1;
    n.kids.forEach((k, s) => {
      const c = R[k];
      c.sib = s;
      c.u0 = u;
      u += (span * c.w) / total;
      // The last sibling closes on the parent's edge exactly: no float gap at the seam.
      c.u1 = s === last ? n.u1 : u;
    });
  }

  let maxDepth = 0;
  for (const i of order) if (R[i].depth > maxDepth) maxDepth = R[i].depth;

  return { order, maxDepth, docks };
}

export interface DockLayout {
  dockPos: Map<NodeIx, DockPos>;
  dockEnds: NodeIx[];
  dockTmpl: NodeIx[];
  dockEntry: NodeIx[];
}

/**
 * Hub-dock geometry, as fractions of the hub radius, lifted from the prototype.
 *
 * The dial's hub is smaller than the containment wheel's, so its ending dots cap a little tighter;
 * that is the only difference between the two modes.
 */
const DOCK_GEOMETRY = {
  endingRad: 0.6,
  endingSizeCap: { hub: 0.19, dial: 0.17 },
  /** A lone ending is nudged in toward the hub centre, where there is room for a label. */
  loneEndingRad: 0.3,
  loneEndingSize: 0.17,
  templateRad: 0.9,
  templateSize: 0.022,
  entryRad: 0.82,
  entrySize: 0.07,
} as const;

export interface DockOptions {
  /** `hub` = the containment wheel's hub; `dial` = the flat dial's (slightly tighter dots). */
  mode?: 'hub' | 'dial';
}

/**
 * Hub docks: endings around the centre in their declared precedence, templates on a wider ring,
 * the entry at twelve o'clock.
 *
 * Each dock carries its angle, its radius as a share of the hub radius, and its dot size in the
 * same share — the prototype's `{x, y, r}`, in the polar form the rest of this module speaks
 * (`x = cos(a) * rad`, `y = sin(a) * rad`).
 */
export function layoutDocks(
  nodes: readonly OrreryNode[],
  docks: readonly NodeIx[],
  precedence: ReadonlyMap<string, number>,
  options: DockOptions = {},
): DockLayout {
  const R = nodes;
  const G = DOCK_GEOMETRY;
  const cap = G.endingSizeCap[options.mode ?? 'hub'];
  const rank = (i: NodeIx) => {
    const p = precedence.get(R[i].id);
    return p === undefined ? Number.MAX_SAFE_INTEGER : p;
  };
  const dockEnds = docks.filter((i) => R[i].kind === 'ending').sort((a, b) => rank(a) - rank(b) || a - b);
  const dockTmpl = docks.filter((i) => R[i].kind === 'template');
  const dockEntry = docks.filter((i) => R[i].kind === 'entry');

  const dockPos = new Map<NodeIx, DockPos>();
  // A lone ending sits below the hub centre; a ring of them spreads clockwise from twelve, each
  // dot sized to the gap between its neighbours and capped so a pair does not read as two moons.
  if (dockEnds.length === 1 && options.mode !== 'dial') {
    dockPos.set(dockEnds[0], { a: Math.PI / 2, rad: G.loneEndingRad, size: G.loneEndingSize });
  } else {
    const n = dockEnds.length;
    const size = Math.min(cap, ((Math.PI * G.endingRad) / Math.max(n, 1)) * 0.78);
    dockEnds.forEach((i, s) => {
      dockPos.set(i, { a: TOP_ANGLE + (TAU * (s + 0.5)) / n, rad: G.endingRad, size });
    });
  }
  dockTmpl.forEach((i, s) => {
    dockPos.set(i, {
      a: TOP_ANGLE + (TAU * (s + 0.5)) / dockTmpl.length,
      rad: G.templateRad,
      size: G.templateSize,
    });
  });
  dockEntry.forEach((i) => dockPos.set(i, { a: TOP_ANGLE, rad: G.entryRad, size: G.entrySize }));

  return { dockPos, dockEnds, dockTmpl, dockEntry };
}

export interface FlatOptions {
  /** The declared ordering dimension. The dial is one turn of it. */
  axis: StoryProfileAxis;
  /** Lane ids that get a track, outermost first. */
  laneIds: readonly string[];
  /** Nodes kept off the dial because they dock at the hub (the endings). */
  excluded: ReadonlySet<NodeIx>;
  /** Blank axis units left as the dial's seam. */
  axisGap?: number;
}

/**
 * The lane x axis dial. One track per lane, outermost lane first; a node sits at its axis
 * position within its first declared lane, and a container spans its children's axis range.
 *
 * Each item carries its span in unit space and its packing slot:
 * `angle = a0 + u * (dayA - a0)` for the start and the same for `u1`, and `row`/`rows` divide the
 * lane's track thickness so overlapping items do not collide. The prototype's drawing inset
 * (about 6% of one axis unit at each end of an arc) is deliberately NOT baked in: `u`/`u1` are the
 * true span, and insetting is the surface's business.
 */
export function layoutFlat(nodes: readonly OrreryNode[], options: FlatOptions): FlatLayout {
  const { axis, laneIds, excluded } = options;
  const gap = options.axisGap ?? ORRERY_GEOMETRY.flatAxisGap;
  const Rh = ORRERY_GEOMETRY.flatHubRadius;
  const TH = ORRERY_GEOMETRY.flatTrackThickness;

  const units = Math.max(1, axis.max - axis.min + 1);
  const per = (TAU - (gap / (units + gap)) * TAU) / units;
  const a0 = TOP_ANGLE + (gap / (units + gap)) * TAU * 0.5;
  const dayA = a0 + per * units;
  const outer = Rh + ORRERY_GEOMETRY.flatHubGap + laneIds.length * TH;

  const laneOf = (n: OrreryNode): number => {
    for (const l of n.lanes) {
      const j = laneIds.indexOf(l);
      if (j >= 0) return j;
    }
    return 0;
  };

  // Collect each node's axis interval in its lane. A leaf occupies the one axis unit it declares;
  // a container occupies the range its children cover, so a six-day quest is a six-day arc.
  interface Pending {
    i: NodeIx;
    lo: number;
    hi: number;
    container: boolean;
    row: number;
  }
  const byLane: Pending[][] = laneIds.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.virtual || excluded.has(i) || n.axis === null) continue;
    let lo = n.axis - axis.min;
    let hi = lo + 1;
    const container = n.kind === 'container' && n.kids.length > 0;
    if (container) {
      let min: number | null = null;
      let max: number | null = null;
      for (const k of n.kids) {
        const a = nodes[k].axis;
        if (a === null) continue;
        if (min === null || a < min) min = a;
        if (max === null || a > max) max = a;
      }
      if (min !== null && max !== null) {
        lo = min - axis.min;
        hi = max - axis.min + 1;
      }
    }
    const lane = byLane[laneOf(n)];
    if (lane) lane.push({ i, lo, hi, container, row: 0 });
  }

  // Pack each lane into sub-rows by interval overlap: containers first so they take the outer row
  // and the beats they hold sit inside them, then first-come by axis position. `rows` is how many
  // sub-rows the lane ended up needing, which is what divides the track's thickness.
  const items = new Map<NodeIx, FlatItem>();
  for (const lane of byLane) {
    lane.sort(
      (a, b) => Number(b.container) - Number(a.container) || a.lo - b.lo || a.i - b.i,
    );
    const rowEnd: number[] = [];
    for (const it of lane) {
      let r = 0;
      while (rowEnd[r] !== undefined && rowEnd[r] > it.lo + 1e-9) r++;
      rowEnd[r] = it.hi;
      it.row = r;
    }
    const rows = Math.max(1, rowEnd.length);
    for (const it of lane) {
      items.set(it.i, {
        u: it.lo / units,
        u1: it.hi / units,
        lane: laneOf(nodes[it.i]),
        row: it.row,
        rows,
      });
    }
  }

  // Rim slots: choices that share an axis position would stack their impact spikes on one angle,
  // so each gets a slice of it. Keyed off the node's own axis value, as the prototype does.
  const byAxis = new Map<number, NodeIx[]>();
  for (const [i] of items) {
    const n = nodes[i];
    if (!n.ch && n.nChoice === 0) continue;
    if (n.axis === null) continue;
    const key = Math.round(n.axis * 100);
    const bucket = byAxis.get(key);
    if (bucket) bucket.push(i);
    else byAxis.set(key, [i]);
  }
  for (const bucket of byAxis.values()) {
    bucket.forEach((i, s) => {
      const item = items.get(i);
      if (!item) return;
      item.slot = s;
      item.slots = bucket.length;
    });
  }

  return { Rh, TH, outer, a0, per, dayA, lanes: [...laneIds], items, RR: outer };
}

/**
 * Which lanes earn a track on the dial. A lane whose only members are endings is dropped — those
 * nodes dock at the hub, so their track would always be empty.
 *
 * The prototype dropped the lane whose id was literally `'ending'`; this derives the same answer
 * from the document instead of from a magic string.
 */
export function trackLanes(
  nodes: readonly OrreryNode[],
  declared: readonly { id: string }[],
): string[] {
  const members = new Map<string, { total: number; endings: number }>();
  for (const l of declared) members.set(l.id, { total: 0, endings: 0 });
  for (const n of nodes) {
    if (n.virtual) continue;
    for (const l of n.lanes) {
      const rec = members.get(l);
      if (!rec) continue;
      rec.total++;
      if (n.kind === 'ending') rec.endings++;
    }
  }
  return declared
    .filter((l) => {
      const rec = members.get(l.id);
      return !rec || rec.total === 0 || rec.endings < rec.total;
    })
    .map((l) => l.id);
}
