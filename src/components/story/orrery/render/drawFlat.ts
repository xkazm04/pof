/**
 * The lane x axis dial, for a document that declares an ordering dimension and enough lanes to earn
 * a track each.
 *
 * It is the same instrument read a different way: the turn is one pass of the axis instead of one
 * pass of the story's containment, each lane gets a concentric track, and a container spans the arc
 * its children cover rather than re-rooting. Endings still dock in the hub, impact is still a rim
 * track, influences are still dotted arcs outside it — so the two modes are one design, not two.
 *
 * Nothing here assumes a calendar. The spoke interval is derived from how many axis units there are,
 * and the tick labels are written in the axis's OWN declared unit, so a document measured in chapters
 * does not get days.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { NodeIx } from '@/lib/story/orrery';
import {
  chordControl,
  dockPoint,
  impactBarLength,
  sectorTouchesRect,
} from '@/components/story/orrery/render/geometry';
import { axisOf, flatPlace, flatRimSlice, flatTrack } from '@/components/story/orrery/render/flat';
import { chordKindOf, laneLabel } from '@/components/story/orrery/render/derive';
import { fillFor, isMeasuredZero } from '@/components/story/orrery/render/lod';
import {
  applyFill,
  arrowHead,
  circlePath,
  emptyStats,
  rescaleHatch,
  segmentPath,
  type DrawStats,
} from '@/components/story/orrery/render/ctx';
import { worldToScreen } from '@/components/story/orrery/render/camera';
import {
  setScreenTransform,
  setWorldTransform,
  type LabelSlot,
  type SceneInput,
} from '@/components/story/orrery/render/scene';
import { drawLabelSweep } from '@/components/story/orrery/render/drawLabels';
import { impactValueOf } from '@/components/story/orrery/render/drawRim';
import { fitText } from '@/components/story/orrery/render/labels';

const BAR_BASE = ORRERY_GEOMETRY.barBase;
const RIM = ORRERY_GEOMETRY.rimExtent;
/** Candidate spoke intervals, smallest first; the first one giving at most 12 spokes wins. */
const SPOKE_STEPS = [1, 2, 5, 7, 10, 14, 25, 50, 100, 250, 500];

/** Spoke interval for an axis of `units` units: about a dozen divisions, in whole units. */
export function spokeStep(units: number): number {
  for (const s of SPOKE_STEPS) if (units / s <= 12) return s;
  return Math.ceil(units / 12);
}

/** Bake the whole dial. */
export function drawFlatDial(ctx: CanvasRenderingContext2D, input: SceneInput): DrawStats {
  const t0 = performance.now();
  const { view, cam, palette, lens, show, rect, hatch } = input;
  const model = view.model;
  const flat = model.flat;
  const stats = emptyStats();
  stats.scale = cam.scale;
  if (!flat) return stats;
  const axis = axisOf(model);
  const units = axis ? Math.max(1, axis.max - axis.min + 1) : 1;

  setWorldTransform(ctx, input);
  rescaleHatch(hatch, cam.scale, input.dpr);
  ctx.lineJoin = 'round';

  // Lane tracks, alternating, so a row can be followed round the turn.
  flat.lanes.forEach((_, j) => {
    const track = flatTrack(flat, j);
    segmentPath(ctx, flat.a0, flat.dayA, track.r0, track.r1);
    ctx.fillStyle = palette.track[j % palette.track.length];
    ctx.fill();
    ctx.lineWidth = 1 / cam.scale;
    ctx.strokeStyle = palette.trackLine;
    ctx.stroke();
  });

  // Axis spokes.
  const step = spokeStep(units);
  ctx.strokeStyle = palette.spoke;
  ctx.lineWidth = 1 / cam.scale;
  ctx.beginPath();
  for (let d = 0; d <= units; d += step) {
    const a = flat.a0 + d * flat.per;
    ctx.moveTo(Math.cos(a) * (flat.Rh + 14), Math.sin(a) * (flat.Rh + 14));
    ctx.lineTo(Math.cos(a) * (flat.outer + 6), Math.sin(a) * (flat.outer + 6));
  }
  ctx.stroke();

  if (show.paths) stats.chords = drawFlatChords(ctx, input);

  // Items. A container is an outline, not a fill, so a beat drawn inside it stays legible.
  const labels: LabelSlot[] = [];
  for (const [i, item] of flat.items) {
    const n = model.R[i];
    const place = flatPlace(flat, item);
    if (!sectorTouchesRect(place.a0, place.a1, place.r0, place.r1, rect)) continue;
    segmentPath(ctx, place.a0, place.a1, place.r0, place.r1);
    if (n.kind === 'container') {
      ctx.setLineDash([3 / cam.scale, 2 / cam.scale]);
      ctx.lineWidth = 1.2 / cam.scale;
      ctx.strokeStyle = palette.kind.container;
      ctx.stroke();
      ctx.setLineDash([]);
      labels.push({ ...place, i, fill: palette.bg });
      continue;
    }
    const css = applyFill(ctx, fillFor(model, n, lens, palette), hatch, palette.hatch.ground);
    ctx.fill();
    stats.drawn++;
    ctx.lineWidth = show.flags && n.flags ? 1.8 / cam.scale : 1 / cam.scale;
    ctx.strokeStyle =
      show.flags && n.flags
        ? palette.flag
        : isMeasuredZero(model, n, lens)
          ? palette.measuredZero
          : palette.bg;
    ctx.stroke();
    labels.push({ ...place, i, fill: css });
  }

  // Hub, with the endings docked in it.
  circlePath(ctx, 0, 0, flat.Rh);
  ctx.fillStyle = palette.hubOuter;
  ctx.fill();
  ctx.lineWidth = 1.6 / cam.scale;
  ctx.strokeStyle = palette.hubRim;
  ctx.stroke();
  for (const i of model.dockEnds) {
    const pos = model.dockPos.get(i);
    if (!pos) continue;
    const n = model.R[i];
    const d = dockPoint(pos, flat.Rh);
    circlePath(ctx, d.x, d.y, d.r);
    applyFill(ctx, fillFor(model, n, lens, palette), hatch, palette.hatch.ground);
    ctx.fill();
    ctx.lineWidth = 1.3 / cam.scale;
    ctx.strokeStyle = n.flags && show.flags ? palette.flag : palette.endingRing;
    ctx.stroke();
  }

  stats.units = drawFlatRim(ctx, input);

  setScreenTransform(ctx, input);
  stats.labels = drawLabelSweep(ctx, input, labels);
  drawDialScale(ctx, input, units, step);

  stats.ms = performance.now() - t0;
  return stats;
}

/** Direct traversal edges on the dial — few enough at dial scale to draw one at a time, with heads. */
function drawFlatChords(ctx: CanvasRenderingContext2D, input: SceneInput): number {
  const { view, cam, palette } = input;
  const model = view.model;
  const flat = model.flat;
  if (!flat) return 0;
  const paths = {
    then: new Path2D(),
    option: new Path2D(),
    gate: new Path2D(),
  };
  const heads: { cx: number; cy: number; x: number; y: number; kind: 'then' | 'option' | 'gate' }[] = [];
  let drawn = 0;

  const anchor = (i: NodeIx) => {
    const item = flat.items.get(i);
    if (item) {
      const p = flatPlace(flat, item);
      const a = (p.a0 + p.a1) / 2;
      const r = (p.r0 + p.r1) / 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    const dock = model.dockPos.get(i);
    if (!dock) return null;
    const d = dockPoint(dock, flat.Rh);
    return { x: d.x, y: d.y };
  };

  for (const e of model.tr) {
    const p1 = anchor(e.from);
    const p2 = p1 && anchor(e.to);
    if (!p1 || !p2) continue;
    const kind = chordKindOf(e.kind);
    const c = chordControl(p1.x, p1.y, p2.x, p2.y);
    paths[kind].moveTo(p1.x, p1.y);
    paths[kind].quadraticCurveTo(c.cx, c.cy, p2.x, p2.y);
    heads.push({ cx: c.cx, cy: c.cy, x: p2.x, y: p2.y, kind });
    drawn++;
  }

  ctx.lineWidth = 1.1 / cam.scale;
  ctx.strokeStyle = palette.chord.then(0.38);
  ctx.stroke(paths.then);
  ctx.strokeStyle = palette.chord.option(0.42);
  ctx.stroke(paths.option);
  ctx.lineWidth = 1.4 / cam.scale;
  ctx.strokeStyle = palette.chord.gate(0.7);
  ctx.setLineDash([4 / cam.scale, 3 / cam.scale]);
  ctx.stroke(paths.gate);
  ctx.setLineDash([]);

  const size = 6 / cam.scale;
  for (const h of heads) {
    ctx.fillStyle = palette.chord[h.kind](h.kind === 'then' ? 0.8 : 0.88);
    arrowHead(ctx, h.cx, h.cy, h.x, h.y, size);
  }
  return drawn;
}

/** Impact spikes, audit marks and influence arcs on the dial. Returns the units considered. */
function drawFlatRim(ctx: CanvasRenderingContext2D, input: SceneInput): number {
  const { view, cam, palette, show, rect } = input;
  const model = view.model;
  const flat = model.flat;
  if (!flat) return 0;
  const outer = flat.outer;

  ctx.lineWidth = 1 / cam.scale;
  ctx.strokeStyle = palette.rimBase;
  circlePath(ctx, 0, 0, outer + 3);
  ctx.stroke();

  let vmax = 0;
  let vmin = Infinity;
  for (const [i] of flat.items) {
    const n = model.R[i];
    if (!n.ch || n.ch.cls === 'false' || n.ch.cls === 'single') continue;
    if (n.ch.spread > vmax) vmax = n.ch.spread;
    if (n.ch.spread < vmin) vmin = n.ch.spread;
  }
  if (vmin > vmax) vmin = 0;

  const slices = new Map<NodeIx, [number, number]>();
  let units = 0;
  for (const [i, item] of flat.items) {
    const n = model.R[i];
    if (n.kind === 'container') continue;
    const place = flatPlace(flat, item);
    const slice = flatRimSlice(place, item);
    const mid = (slice.a0 + slice.a1) / 2;
    slices.set(i, [slice.a0, slice.a1]);
    if (!sectorTouchesRect(slice.a0, slice.a1, outer, outer + RIM, rect)) continue;

    if (show.flags && n.flags) {
      const hw = Math.min((slice.a1 - slice.a0) / 2, 4 / cam.scale / outer);
      ctx.beginPath();
      ctx.moveTo(Math.cos(mid) * (outer + 1), Math.sin(mid) * (outer + 1));
      ctx.lineTo(Math.cos(mid - hw) * (outer + 8), Math.sin(mid - hw) * (outer + 8));
      ctx.lineTo(Math.cos(mid + hw) * (outer + 8), Math.sin(mid + hw) * (outer + 8));
      ctx.closePath();
      ctx.fillStyle = palette.flag;
      ctx.fill();
    }
    if (!show.impact || !n.ch) continue;
    units++;

    const sliceW = slice.a1 - slice.a0;
    const lw = Math.min(
      Math.max(sliceW * 0.8, 3 / cam.scale / (outer + BAR_BASE)),
      11 / cam.scale / (outer + BAR_BASE),
    );
    const a0 = mid - lw / 2;
    const a1 = mid + lw / 2;
    if (n.ch.cls === 'false' || n.ch.cls === 'single') {
      segmentPath(ctx, a0, a1, outer + BAR_BASE, outer + BAR_BASE + 16);
      ctx.setLineDash([2.6 / cam.scale, 2 / cam.scale]);
      ctx.lineWidth = 1.3 / cam.scale;
      ctx.strokeStyle = palette.hollow;
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const len = impactBarLength(impactValueOf(n), vmin, vmax);
    segmentPath(ctx, a0, a1, outer + BAR_BASE, outer + BAR_BASE + len);
    ctx.fillStyle = n.ch.cls === 'decoration' ? palette.impactCosmetic : palette.impact;
    ctx.fill();
  }

  if (show.influence) {
    ctx.lineWidth = 1.7 / cam.scale;
    ctx.strokeStyle = palette.influence;
    ctx.setLineDash([2.5 / cam.scale, 3 / cam.scale]);
    for (const e of model.infl) {
      const ua = slices.get(e.from);
      const ub = slices.get(e.to);
      if (!ua || !ub) continue;
      let t0 = (ua[0] + ua[1]) / 2;
      let t1 = (ub[0] + ub[1]) / 2;
      if (t0 > t1) [t0, t1] = [t1, t0];
      const sweep = t1 - t0;
      const lane = sweep < 0.12 ? 0 : sweep < 0.6 ? 1 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, outer + 11 + lane * 4, t0, t1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  return units;
}

/** The dial's furniture in screen space: axis ticks, lane names and the hub's ENDINGS caption. */
function drawDialScale(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  units: number,
  step: number,
): void {
  const { view, cam, palette } = input;
  const model = view.model;
  const flat = model.flat;
  if (!flat) return;
  const axis = axisOf(model);
  const centre = worldToScreen(cam, 0, 0);

  ctx.font = `${palette.labelPx}px ${palette.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.dim;
  if (axis) {
    for (let d = 0; d <= units; d += step) {
      const a = flat.a0 + d * flat.per;
      const p = worldToScreen(cam, Math.cos(a) * (flat.outer + 90), Math.sin(a) * (flat.outer + 90));
      ctx.fillText(`${axis.unit} ${d + axis.min}`, p.x, p.y);
    }
  }

  ctx.fillStyle = palette.mut;
  ctx.font = `600 ${palette.labelPx}px ${palette.fontFamily}`;
  flat.lanes.forEach((id, j) => {
    const track = flatTrack(flat, j);
    const rMid = (track.r0 + track.r1) / 2;
    const p = worldToScreen(cam, 0, -rMid);
    const avail = Math.max(10, 2 * (flat.a0 + Math.PI / 2) * rMid * cam.scale - 8);
    const text = fitText(ctx, [laneLabel(model, id).toUpperCase()], avail);
    if (text) ctx.fillText(text, p.x, p.y);
  });

  if (model.dockEnds.length === 0 || flat.Rh * cam.scale <= 30) return;
  ctx.fillStyle = palette.inkHi;
  ctx.font = `600 ${Math.min(15, Math.max(palette.labelPx, flat.Rh * cam.scale * 0.12))}px ${palette.fontFamily}`;
  ctx.fillText('ENDINGS', centre.x, centre.y);
}
