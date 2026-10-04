/**
 * Hit testing and "where is this node on screen", in world coordinates. Pure — it takes the camera's
 * output, never the camera, and never the DOM — so the hardest logic in the stage is unit-testable
 * without a canvas.
 *
 * The hierarchical test is a descent, not a scan: it turns the world point into a unit position
 * once and then binary-searches each sibling ring, so a hover at 10,739 nodes costs about the depth
 * of the tree rather than the size of it. It descends with the same fold rule the draw pass used,
 * so what the pointer finds is exactly what was painted — including a folded block, which answers
 * with the container that was actually drawn and marks itself aggregated.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryModel } from '@/lib/story/orrery';
import {
  TAU,
  angleAt,
  dockPoint,
  ringInner,
  unitAt,
  unitSpan,
  wheelOuter,
  type OrreryViewState,
} from '@/components/story/orrery/render/geometry';
import { foldsAtScale } from '@/components/story/orrery/render/lod';
import { flatPlaceOf, flatRimSlice } from '@/components/story/orrery/render/flat';

export type HitZone = 'hub' | 'dock' | 'ring' | 'rim';

export interface Hit {
  i: NodeIx;
  zone: HitZone;
  /** True when the hit landed on a folded block standing for a subtree. */
  aggregated?: boolean;
}

export interface Place {
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  hub?: boolean;
}

/** Everything the pure geometry needs to know about the current view. */
export interface StageView {
  model: OrreryModel;
  vs: OrreryViewState;
  /** The node on the hub. */
  focus: NodeIx;
  /** The scale the bitmap was baked at — detail is read from THAT, not from the live camera. */
  scale: number;
  /** Deepest depth that still gets its own rim unit, from `detailBands`. */
  rimDepth: number;
  /** The display root (`derive.displayRoot`), passed in so this module stays cache-free. */
  root: NodeIx;
}

const HUB = ORRERY_GEOMETRY.hubRadius;
const RIM = ORRERY_GEOMETRY.rimExtent;
const BAR_BASE = ORRERY_GEOMETRY.barBase;

/** Normalise an angle into `[from, from + TAU)`. */
function wrapTo(angle: number, from: number): number {
  let a = angle;
  while (a < from) a += TAU;
  while (a >= from + TAU) a -= TAU;
  return a;
}

/**
 * Is this node drawn in the HUB rather than on the wheel?
 *
 * `OrreryNode.dock` is a property of the containment layout: a leaf entry, template or ending hanging
 * off the root has no sector. On the DIAL, though, only the endings are taken off the tracks — an
 * entry keeps its axis position and is drawn as an ordinary item. So "docked" has to be asked of the
 * layout in force, not of the flag alone, or the entry would be outlined at the hub while it is
 * painted on a lane.
 */
export function isHubDocked(model: OrreryModel, i: NodeIx): boolean {
  const n = model.R[i];
  if (!n?.dock) return false;
  return model.flat ? !model.flat.items.has(i) : true;
}

/** All hub docks in draw order, so the pointer tests endings before the smaller template dots. */
function allDocks(model: OrreryModel): NodeIx[] {
  return [...model.dockEnds, ...model.dockEntry, ...model.dockTmpl];
}

/** Which node did the pointer land on? `null` means empty space. */
export function hitTest(view: StageView, wx: number, wy: number): Hit | null {
  return view.model.flat ? hitFlat(view, wx, wy) : hitHierarchy(view, wx, wy);
}

function hitHierarchy(view: StageView, wx: number, wy: number): Hit | null {
  const { model, vs, focus, scale, root } = view;
  const R = model.R;
  const r = Math.hypot(wx, wy);

  if (r < HUB) {
    if (focus === root) {
      for (const i of allDocks(model)) {
        const pos = model.dockPos.get(i);
        if (!pos) continue;
        const d = dockPoint(pos, HUB);
        if (Math.hypot(wx - d.x, wy - d.y) <= Math.max(d.r, 3 / scale)) return { i, zone: 'dock' };
      }
    }
    return { i: focus, zone: 'hub' };
  }

  const outer = wheelOuter(vs);
  if (r > outer + RIM) return null;
  const u = unitAt(Math.atan2(wy, wx), vs);
  // Ring index, or 99 for "out past the rings, in the rim furniture".
  const ring = r <= outer ? 1 + Math.floor((r - HUB) / vs.T + 1e-9) : 99;

  let n = R[focus];
  let aggregated = false;
  for (;;) {
    const kids = n.kids;
    if (kids.length === 0) break;
    let lo = 0;
    let hi = kids.length - 1;
    let found = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const c = R[kids[m]];
      if (u < c.u0) hi = m - 1;
      else if (u >= c.u1) lo = m + 1;
      else {
        found = m;
        break;
      }
    }
    if (found < 0) return null;
    const child = R[kids[found]];
    const childRing = child.depth - vs.base;
    if (ring !== 99 && childRing > ring) break;
    n = child;
    if (ring === 99 && child.depth >= view.rimDepth) break;
    if (foldsAtScale(child, vs, scale)) {
      aggregated = true;
      break;
    }
    if (ring !== 99 && childRing === ring) break;
  }

  if (n.i === focus) return null;
  if (ring !== 99 && !aggregated && n.depth - vs.base < ring) return null;
  return { i: n.i, zone: ring === 99 ? 'rim' : 'ring', aggregated };
}

function hitFlat(view: StageView, wx: number, wy: number): Hit | null {
  const { model } = view;
  const flat = model.flat;
  if (!flat) return null;
  const r = Math.hypot(wx, wy);
  const raw = Math.atan2(wy, wx);

  if (r < flat.Rh) {
    for (const i of model.dockEnds) {
      const pos = model.dockPos.get(i);
      if (!pos) continue;
      const d = dockPoint(pos, flat.Rh);
      if (Math.hypot(wx - d.x, wy - d.y) <= d.r) return { i, zone: 'dock' };
    }
    return null;
  }

  let best: Hit | null = null;
  for (const [i, item] of flat.items) {
    const place = flatPlaceOf(model, i);
    if (!place || r < place.r0 || r > place.r1) continue;
    const a = wrapTo(raw, place.a0);
    if (a < place.a0 || a > place.a1) continue;
    // A beat drawn inside its container's arc wins the hit; the container is the fallback.
    if (!best || model.R[i].kind !== 'container') best = { i, zone: 'ring' };
    void item;
  }
  if (best) return best;

  if (r > flat.outer + BAR_BASE - 4 && r < flat.outer + RIM) {
    let bestPx = Infinity;
    for (const [i, item] of flat.items) {
      if (!model.R[i].ch) continue;
      const place = flatPlaceOf(model, i);
      if (!place) continue;
      const slice = flatRimSlice(place, item);
      const mid = (slice.a0 + slice.a1) / 2;
      const delta = Math.abs((((raw - mid) % TAU) + TAU + Math.PI) % TAU - Math.PI);
      const px = delta * r * view.scale;
      if (px < 9 && px < bestPx) {
        bestPx = px;
        best = { i, zone: 'rim' };
      }
    }
  }
  return best;
}

/**
 * Where a node is drawn, in world coordinates, or `null` when it is not on screen at all. The hub
 * answers as a full disc so a focused container can be outlined.
 */
export function placeOf(view: StageView, i: NodeIx): Place | null {
  const { model, vs, focus } = view;
  if (model.flat) {
    const p = flatPlaceOf(model, i);
    return p ? { ...p } : null;
  }
  const n = model.R[i];
  if (!n || n.dock) return null;
  if (i === focus) return { a0: 0, a1: TAU, r0: 0, r1: HUB, hub: true };
  if (!inWindow(view, i)) return null;
  const ring = n.depth - vs.base;
  return {
    a0: angleAt(n.u0, vs),
    a1: angleAt(n.u1, vs),
    r0: ringInner(ring, vs),
    r1: ringInner(ring + 1, vs),
  };
}

/** Is this node inside the current unit window and below the hub? */
export function inWindow(view: StageView, i: NodeIx): boolean {
  const n = view.model.R[i];
  if (!n || n.dock) return false;
  const { vs } = view;
  return (
    n.depth > vs.base - 1e-6 && n.u0 >= vs.w0 - 1e-9 && n.u1 <= vs.w1 + 1e-9 && unitSpan(vs) > 0
  );
}

/**
 * Which drawn thing stands for node `i`? Itself when it was drawn; the folded ancestor that swallowed
 * it otherwise; `-1` when it is not under the focus at all. This is what lets a selection made in
 * the panel or by the keyboard be outlined on a wheel that folded it away.
 */
export function visibleRep(view: StageView, i: NodeIx): NodeIx {
  const { model, vs, focus, root, scale } = view;
  if (model.flat) return i;
  const R = model.R;
  const n = R[i];
  if (!n) return -1;
  if (n.dock) return focus === root ? i : -1;
  const path: NodeIx[] = [];
  let p: NodeIx = i;
  while (p >= 0 && p !== focus) {
    path.push(p);
    p = R[p].par;
  }
  if (p !== focus) return -1;
  for (let a = path.length - 1; a >= 0; a--) {
    const c = R[path[a]];
    if (c.i === i) return i;
    if (foldsAtScale(c, vs, scale)) return c.i;
  }
  return i;
}

/**
 * A node's anchor point for chords and relation arcs, in world coordinates, taking the node AS GIVEN
 * — no fold resolution. The chord layer has already aggregated its endpoints to a depth and must not
 * have them moved again underneath it.
 */
export function anchorOfRep(view: StageView, rep: NodeIx): { x: number; y: number } | null {
  const { model, vs, focus, root } = view;
  if (model.flat) return nodeAnchor(view, rep);
  const n = model.R[rep];
  if (!n) return null;
  if (n.dock) {
    if (focus !== root) return null;
    const dock = model.dockPos.get(rep);
    if (!dock) return null;
    const d = dockPoint(dock, HUB);
    return { x: d.x, y: d.y };
  }
  if (!inWindow(view, rep) || n.depth <= vs.base) return null;
  const a = angleAt((n.u0 + n.u1) / 2, vs);
  const r = ringInner(n.depth - vs.base, vs) + 1.5;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/** A node's anchor, resolved through whatever fold is standing for it. */
export function nodeAnchor(view: StageView, i: NodeIx): { x: number; y: number } | null {
  const { model, vs, focus, root } = view;
  if (model.flat) {
    const place = flatPlaceOf(model, i);
    if (place) {
      const a = (place.a0 + place.a1) / 2;
      const r = (place.r0 + place.r1) / 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    const dock = model.dockPos.get(i);
    if (!dock) return null;
    const d = dockPoint(dock, model.flat.Rh);
    return { x: d.x, y: d.y };
  }
  const rep = visibleRep(view, i);
  if (rep < 0) return null;
  const n = model.R[rep];
  if (n.dock) {
    if (focus !== root) return null;
    const dock = model.dockPos.get(rep);
    if (!dock) return null;
    const d = dockPoint(dock, HUB);
    return { x: d.x, y: d.y };
  }
  if (!inWindow(view, rep) || n.depth <= vs.base) return null;
  const a = angleAt((n.u0 + n.u1) / 2, vs);
  const r = ringInner(n.depth - vs.base, vs) + 1.5;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
