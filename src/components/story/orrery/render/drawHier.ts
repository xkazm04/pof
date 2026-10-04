/**
 * The containment sunburst: clockwise is story time, each ring is one level of containment, and a
 * sector is as wide as the story inside it.
 *
 * Three things in here are what make it hold at 10,739 nodes, and none of them is an optimisation
 * you could add later:
 *
 *  1. **The descent culls subtrees, not nodes.** Each node is bounded by an annulus that reaches to
 *     its DEEPEST descendant ring, so one failed test rejects everything inside it. At fit on the
 *     synthetic document that is the difference between 10,739 tests and a few hundred.
 *  2. **A node whose children would be under ~1px each folds into one block**, tinted by what is in
 *     there. 9,700 dialogue lines become a few hundred honest blocks rather than a grey smear, and
 *     the rim still counts them.
 *  3. **Labels are collected, not drawn, during the world pass** and resolved afterwards in screen
 *     space, so text is placed by the camera and never scaled by it.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryNode } from '@/lib/story/orrery';
import {
  TAU,
  dockPoint,
  ringInner,
  sectorAngles,
  sectorTouchesRect,
  unitSpan,
  wheelOuter,
} from '@/components/story/orrery/render/geometry';
import { AGGREGATE_PX, blockFillFor, fillFor, isMeasuredZero } from '@/components/story/orrery/render/lod';
import {
  applyFill,
  circlePath,
  emptyStats,
  rescaleHatch,
  segmentPath,
  type DrawStats,
} from '@/components/story/orrery/render/ctx';
import {
  setScreenTransform,
  setWorldTransform,
  type LabelSlot,
  type RimUnit,
  type SceneInput,
} from '@/components/story/orrery/render/scene';
import { drawHubLabel, drawLabelSweep } from '@/components/story/orrery/render/drawLabels';
import { drawHierChords, drawHierRim, drawAxisTicks } from '@/components/story/orrery/render/drawRim';

const HUB = ORRERY_GEOMETRY.hubRadius;

/** Bake the whole containment wheel. Returns what it actually drew, for the honest status line. */
export function drawHierarchy(ctx: CanvasRenderingContext2D, input: SceneInput): DrawStats {
  const t0 = performance.now();
  const { view, cam, palette, lens, show, rect, hatch } = input;
  const { model, vs } = view;
  const R = model.R;
  const stats = emptyStats();
  stats.rimDepth = view.rimDepth;
  stats.chordDepth = input.chordDepth;
  stats.scale = cam.scale;

  setWorldTransform(ctx, input);
  rescaleHatch(hatch, cam.scale, input.dpr);
  ctx.lineJoin = 'round';

  // Ring guides, so the levels read even where a ring is empty.
  ctx.lineWidth = 1 / cam.scale;
  ctx.strokeStyle = palette.ringGuide;
  for (let i = 1; i <= vs.L + 0.001; i++) {
    circlePath(ctx, 0, 0, ringInner(i, vs));
    ctx.stroke();
  }

  const labels: LabelSlot[] = [];
  const units: RimUnit[] = [];
  const span = unitSpan(vs);

  const drawSegment = (n: OrreryNode, a0: number, a1: number, r0: number, r1: number, px: number) => {
    const fill = fillFor(model, n, lens, palette);
    segmentPath(ctx, a0, a1, r0, r1);
    const css = applyFill(ctx, fill, hatch, palette.hatch.ground);
    ctx.fill();
    stats.drawn++;
    if (show.flags && n.flags && px >= 2) {
      ctx.lineWidth = 1.6 / cam.scale;
      ctx.strokeStyle = palette.flag;
      ctx.stroke();
    } else if (isMeasuredZero(model, n, lens)) {
      // Measured AND zero: drawn dark with an outline, so it can never be mistaken for unmeasured.
      ctx.lineWidth = 1 / cam.scale;
      ctx.strokeStyle = palette.measuredZero;
      ctx.stroke();
    } else if (px >= 2.6) {
      ctx.lineWidth = 1 / cam.scale;
      ctx.strokeStyle = palette.bg;
      ctx.stroke();
    }
    if (px >= 7 || (r1 - r0) * cam.scale >= 14) {
      labels.push({ i: n.i, a0, a1, r0, r1, fill: css });
    }
  };

  const drawBlock = (n: OrreryNode, a0: number, a1: number, rIn: number, rOut: number) => {
    if (rOut - rIn < 0.5) return;
    segmentPath(ctx, a0, a1, rIn, rOut);
    applyFill(ctx, blockFillFor(model, n, lens, palette), hatch, palette.hatch.ground);
    ctx.fill();
    stats.blocks++;
  };

  const visit = (i: NodeIx): void => {
    const n = R[i];
    if (n.u1 <= vs.w0 + 1e-9 || n.u0 >= vs.w1 - 1e-9) return;
    const ring = n.depth - vs.base;
    const { a0, a1 } = sectorAngles(n, vs);
    const r0 = ringInner(ring, vs);
    const r1 = ringInner(ring + 1, vs);
    const rTop = ringInner(n.maxd - vs.base + 1, vs);

    if (ring >= 1) {
      // One test for the whole subtree: the annulus out to its deepest descendant.
      if (!sectorTouchesRect(a0, a1, r0, rTop, rect)) return;
      const px = (a1 - a0) * (r0 + r1) * 0.5 * cam.scale;
      if (px >= 0.22 || a1 - a0 > 0.002) drawSegment(n, a0, a1, r0, r1, px);
    }

    const nk = n.kids.length;
    if (nk === 0) {
      if (ring >= 1 && n.depth <= view.rimDepth) units.push({ i: n.i, a0, a1 });
      return;
    }
    if (ring >= 1) {
      const avg =
        ((a1 - a0) * (ringInner(ring + 1, vs) + ringInner(ring + 2, vs)) * 0.5 * cam.scale) / nk;
      if (avg < AGGREGATE_PX) {
        drawBlock(n, a0, a1, r1, rTop);
        if (n.depth <= view.rimDepth) units.push({ i: n.i, a0, a1 });
        return;
      }
      if (n.depth === view.rimDepth) units.push({ i: n.i, a0, a1 });
    }
    for (const k of n.kids) visit(k);
  };

  visit(view.focus);
  stats.units = units.length;
  void span;

  if (show.paths) stats.chords = drawHierChords(ctx, input);
  drawHub(ctx, input);
  drawHierRim(ctx, input, wheelOuter(vs), units);

  setScreenTransform(ctx, input);
  stats.labels = drawLabelSweep(ctx, input, labels);
  drawHubLabel(ctx, input, HUB, view.focus === view.root && model.dockEnds.length > 0);
  drawAxisTicks(ctx, input, wheelOuter(vs));

  stats.ms = performance.now() - t0;
  return stats;
}

/**
 * The hub: the thing you are inside, with the story's endings docked in it when you are at the root.
 * Endings are circles, templates small dots, the entry a triangle — three shapes, so the hub reads
 * without colour.
 */
function drawHub(ctx: CanvasRenderingContext2D, input: SceneInput): void {
  const { view, cam, palette, lens, show, hatch } = input;
  const model = view.model;
  circlePath(ctx, 0, 0, HUB);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, HUB);
  grad.addColorStop(0, palette.hubInner);
  grad.addColorStop(1, palette.hubOuter);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.6 / cam.scale;
  ctx.strokeStyle = palette.hubRim;
  ctx.stroke();

  if (view.focus !== view.root) return;

  ctx.lineWidth = 1 / cam.scale;
  for (const i of model.dockTmpl) {
    const pos = model.dockPos.get(i);
    if (!pos) continue;
    const d = dockPoint(pos, HUB);
    circlePath(ctx, d.x, d.y, d.r);
    ctx.fillStyle = palette.kind.template;
    ctx.fill();
  }
  for (const i of model.dockEnds) {
    const pos = model.dockPos.get(i);
    if (!pos) continue;
    const n = model.R[i];
    const d = dockPoint(pos, HUB);
    circlePath(ctx, d.x, d.y, d.r);
    applyFill(ctx, fillFor(model, n, lens, palette), hatch, palette.hatch.ground);
    ctx.fill();
    const bad = Boolean(n.flags) && show.flags;
    ctx.lineWidth = (bad ? 2 : 1.3) / cam.scale;
    ctx.strokeStyle = bad ? palette.flag : palette.endingRing;
    if (bad) ctx.setLineDash([3 / cam.scale, 2.4 / cam.scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const i of model.dockEntry) {
    const pos = model.dockPos.get(i);
    if (!pos) continue;
    const d = dockPoint(pos, HUB);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y + d.r);
    ctx.lineTo(d.x - d.r * 0.9, d.y - d.r * 0.7);
    ctx.lineTo(d.x + d.r * 0.9, d.y - d.r * 0.7);
    ctx.closePath();
    ctx.fillStyle = palette.kind.entry;
    ctx.fill();
  }
}

export { TAU };
