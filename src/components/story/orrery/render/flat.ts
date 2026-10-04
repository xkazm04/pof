/**
 * The lane x axis dial, from unit space to world space.
 *
 * `layoutFlat` publishes each item as a span in UNIT space plus a packing slot, and says plainly
 * that the drawing inset is the surface's business. This module is that business and the only place
 * it is done: one function turns `{ u, u1, lane, row, rows }` into `{ a0, a1, r0, r1 }`, and the
 * draw pass, the hit test and the overlay all call it, so they cannot disagree about where an item
 * is by a sixth of a day.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { FlatItem, FlatLayout, NodeIx, OrreryModel } from '@/lib/story/orrery';

/** Gap between a lane's track and the next, so the tracks read as separate rails. */
const LANE_GAP = 3;
/** Gap between packing sub-rows inside one lane. */
const ROW_GAP = 1.5;
/**
 * Inset at each end of an arc, as a share of one axis unit — the winner drew a one-day bar slightly
 * short of its neighbours so a run of days reads as ticks rather than a solid ring.
 */
const END_INSET = 0.06;

export interface FlatPlace {
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

/** One item's world-space arc. */
export function flatPlace(flat: FlatLayout, it: FlatItem): FlatPlace {
  const sweep = flat.dayA - flat.a0;
  const inset = Math.min(flat.per * END_INSET, ((it.u1 - it.u) * sweep) / 5);
  const a0 = flat.a0 + it.u * sweep + inset;
  const a1 = flat.a0 + it.u1 * sweep - inset;
  const trackOuter = flat.outer - it.lane * flat.TH;
  const trackInner = trackOuter - flat.TH + LANE_GAP;
  const rows = Math.max(1, it.rows);
  const h = (trackOuter - trackInner) / rows;
  const r1 = trackOuter - it.row * h;
  const r0 = rows > 1 ? r1 - h + ROW_GAP : trackInner;
  return { a0, a1, r0, r1: Math.max(r0 + 1, r1) };
}

/** One lane's whole track, for the striped background. */
export function flatTrack(flat: FlatLayout, lane: number): { r0: number; r1: number } {
  const r1 = flat.outer - lane * flat.TH;
  return { r0: r1 - flat.TH + LANE_GAP, r1 };
}

/** The item's arc, or `null` when the node is not on the dial (an ending docks at the hub). */
export function flatPlaceOf(model: OrreryModel, i: NodeIx): FlatPlace | null {
  const flat = model.flat;
  if (!flat) return null;
  const it = flat.items.get(i);
  return it ? flatPlace(flat, it) : null;
}

/**
 * The slice of an item's arc its impact spike gets. Several decisions on one day in one lane would
 * stack their spikes on a single angle, so `layoutFlat` gave each a slot and this spends it.
 */
export function flatRimSlice(place: FlatPlace, it: FlatItem): { a0: number; a1: number } {
  const slots = Math.max(1, it.slots ?? 1);
  const slot = it.slot ?? 0;
  const w = (place.a1 - place.a0) / slots;
  const a0 = place.a0 + slot * w;
  return { a0, a1: a0 + w };
}

/** Centre of an item's arc in world coordinates — the chord layer's anchor. */
export function flatAnchor(model: OrreryModel, i: NodeIx): { x: number; y: number } | null {
  const flat = model.flat;
  if (!flat) return null;
  const place = flatPlaceOf(model, i);
  if (place) {
    const a = (place.a0 + place.a1) / 2;
    const r = (place.r0 + place.r1) / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  const dock = model.dockPos.get(i);
  if (!dock) return null;
  return { x: Math.cos(dock.a) * dock.rad * flat.Rh, y: Math.sin(dock.a) * dock.rad * flat.Rh };
}

/** How many axis units the dial spans, and where it starts. Absent axis is not a throw. */
export function axisOf(model: OrreryModel): { name: string; unit: string; min: number; max: number } | null {
  const axis = model.raw.profile.axis;
  return axis ? { name: axis.name, unit: axis.unit, min: axis.min, max: axis.max } : null;
}

export { ORRERY_GEOMETRY };
