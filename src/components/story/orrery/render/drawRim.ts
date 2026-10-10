/**
 * The three layers outside the rings: bundled traversal chords through the interior, the impact rim,
 * and the influence arcs.
 *
 * The impact rim is the part of this design the owner's brief cared most about, so its honesty rules
 * are literal: a spike's length is how far a decision's options pull the world apart, normalised
 * against the range actually ON SCREEN with the winner's contrast stretch (raw spreads were "a
 * uniform wall"); a choice whose options change nothing, or that has fewer than two wired options,
 * gets a HOLLOW dashed tick rather than a short bar — absence of impact is drawn as a different
 * thing, not as a small amount of it.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { OrreryNode } from '@/lib/story/orrery';
import {
  TAU,
  chordControl,
  chordTouchesRect,
  impactBarLength,
  ringInner,
  sectorTouchesRect,
} from '@/components/story/orrery/render/geometry';
import { aggregatedEdges, ancestorAtDepth } from '@/components/story/orrery/render/derive';
import { anchorOfRep } from '@/components/story/orrery/render/hitTest';
import { circlePath, segmentPath } from '@/components/story/orrery/render/ctx';
import { worldToScreen } from '@/components/story/orrery/render/camera';
import type { RimUnit, SceneInput } from '@/components/story/orrery/render/scene';

const BAR_BASE = ORRERY_GEOMETRY.barBase;
const RIM = ORRERY_GEOMETRY.rimExtent;
/** Hard ceiling on chords per bake. Past it the picture is noise and the frame budget is spent. */
const MAX_CHORDS = 5000;

/** Bundled traversal edges, aggregated to the chord depth. Returns how many lines were drawn. */
export function drawHierChords(ctx: CanvasRenderingContext2D, input: SceneInput): number {
  const { view, cam, palette, rect, chordDepth } = input;
  const list = aggregatedEdges(view.model, chordDepth);
  const buckets = new Map<string, { kind: 'then' | 'option' | 'gate'; weight: number; path: Path2D }>();
  let drawn = 0;

  for (let q = 0; q < list.length && drawn < MAX_CHORDS; q++) {
    const e = list[q];
    const p1 = anchorOfRep(view, e.a);
    if (!p1) continue;
    const p2 = anchorOfRep(view, e.b);
    if (!p2) continue;
    // Weight bands, so a bundle of 20 edges reads heavier than a single hop without 20 strokes.
    const weight = e.n >= 20 ? 3 : e.n >= 4 ? 2 : e.n >= 2 ? 1 : 0;
    const c = chordControl(p1.x, p1.y, p2.x, p2.y);
    // Culled on the curve's own box, not its ends: the chord dives inward past both of them.
    const pad = (0.8 + weight * 0.9) / cam.scale / 2;
    if (!chordTouchesRect(p1.x, p1.y, c.cx, c.cy, p2.x, p2.y, pad, rect)) continue;
    const key = `${e.kind}${weight}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { kind: e.kind, weight, path: new Path2D() };
      buckets.set(key, bucket);
    }
    bucket.path.moveTo(p1.x, p1.y);
    bucket.path.quadraticCurveTo(c.cx, c.cy, p2.x, p2.y);
    drawn++;
  }

  // One stroke per bucket rather than per edge: 242 chords cost a handful of GPU calls.
  const alpha = drawn > 600 ? 0.28 : 0.42;
  for (const b of buckets.values()) {
    ctx.lineWidth = (0.8 + b.weight * 0.9) / cam.scale;
    ctx.strokeStyle = palette.chord[b.kind](b.kind === 'gate' ? 0.7 : alpha);
    ctx.stroke(b.path);
  }
  return drawn;
}

/** The impact rim, the audit marks and the influence arcs, for the containment wheel. */
export function drawHierRim(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  outer: number,
  units: readonly RimUnit[],
): void {
  const { view, cam, palette, show, rect } = input;
  const model = view.model;
  const R = model.R;

  ctx.lineWidth = 1 / cam.scale;
  ctx.strokeStyle = palette.rimBase;
  circlePath(ctx, 0, 0, outer + 3);
  ctx.stroke();

  // Normalise against what is on screen, so the rim always uses its full dynamic range.
  let vmax = 0;
  let vmin = Infinity;
  for (const u of units) {
    const v = impactValueOf(R[u.i]);
    if (v > vmax) vmax = v;
    if (v > 0 && v < vmin) vmin = v;
  }
  if (vmin > vmax) vmin = 0;

  const angles = new Map<number, [number, number]>();
  for (const u of units) {
    const n = R[u.i];
    angles.set(u.i, [u.a0, u.a1]);
    if (!sectorTouchesRect(u.a0, u.a1, outer, outer + RIM, rect)) continue;
    const mid = (u.a0 + u.a1) / 2;
    const widthPx = (u.a1 - u.a0) * (outer + BAR_BASE) * cam.scale;

    if (show.flags && n.nFlag > 0) {
      const hw = Math.max(
        1.8 / cam.scale / (outer + 4),
        Math.min((u.a1 - u.a0) / 2, 4 / cam.scale / (outer + 4)),
      );
      ctx.beginPath();
      ctx.moveTo(Math.cos(mid) * (outer + 1), Math.sin(mid) * (outer + 1));
      ctx.lineTo(Math.cos(mid - hw) * (outer + 8), Math.sin(mid - hw) * (outer + 8));
      ctx.lineTo(Math.cos(mid + hw) * (outer + 8), Math.sin(mid + hw) * (outer + 8));
      ctx.closePath();
      ctx.fillStyle = palette.flag;
      ctx.fill();
    }
    if (!show.impact) continue;

    const hollow = n.ch ? n.ch.cls === 'false' || n.ch.cls === 'single' : false;
    const value = hollow ? 0 : impactValueOf(n);
    const decorative = n.ch?.cls === 'decoration';
    if (!hollow && value <= 0 && !(n.nFalse > 0 && !n.ch)) continue;

    const markPx = Math.max(1.8, Math.min(widthPx * 0.72, 14));
    const hw = markPx / 2 / cam.scale / (outer + BAR_BASE);
    const a0 = mid - hw;
    const a1 = mid + hw;

    if (hollow) {
      segmentPath(ctx, a0, a1, outer + BAR_BASE, outer + BAR_BASE + 16);
      ctx.setLineDash([2.6 / cam.scale, 2 / cam.scale]);
      ctx.lineWidth = 1.3 / cam.scale;
      ctx.strokeStyle = palette.hollow;
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }

    const len = impactBarLength(value, vmin, vmax);
    segmentPath(ctx, a0, a1, outer + BAR_BASE, outer + BAR_BASE + len);
    ctx.fillStyle = decorative ? palette.impactCosmetic : palette.impact;
    ctx.fill();
    // A ring that is itself clean but holds a false choice gets a hollow pip at the bar's tip.
    if (!n.ch && n.nFalse > 0) {
      const tip = outer + BAR_BASE + len + 4;
      circlePath(ctx, Math.cos(mid) * tip, Math.sin(mid) * tip, 2.4 / cam.scale);
      ctx.lineWidth = 1 / cam.scale;
      ctx.strokeStyle = palette.hollow;
      ctx.stroke();
    }
  }

  if (!show.influence || model.infl.length === 0) return;
  const anc = ancestorAtDepth(model, view.rimDepth);
  ctx.lineWidth = 1.7 / cam.scale;
  ctx.strokeStyle = palette.influence;
  ctx.setLineDash([2.5 / cam.scale, 3 / cam.scale]);
  for (const e of model.infl) {
    const ua = angles.get(anc[e.from]);
    const ub = angles.get(anc[e.to]);
    if (!ua || !ub) continue;
    let t0 = anc[e.from] === anc[e.to] ? ua[0] : (ua[0] + ua[1]) / 2;
    let t1 = anc[e.from] === anc[e.to] ? ua[1] : (ub[0] + ub[1]) / 2;
    if (t0 > t1) [t0, t1] = [t1, t0];
    let sweep = t1 - t0;
    if (sweep > Math.PI) {
      const swap = t0;
      t0 = t1;
      t1 = swap + TAU;
      sweep = TAU - sweep;
    }
    // Four lanes by span, so a short influence and a story-wide one do not overlap.
    const lane = sweep < 0.03 ? 0 : sweep < 0.12 ? 1 : sweep < 0.6 ? 2 : 3;
    if (!sectorTouchesRect(t0, Math.min(t1, t0 + TAU), outer, outer + 24, rect)) continue;
    ctx.beginPath();
    ctx.arc(0, 0, outer + 11 + lane * 4, t0, t1);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * What a rim unit's spike measures. A choice contributes its option spread; anything else
 * contributes the largest impact of the decisions it contains, so a folded conversation still shows
 * that something decisive is in there.
 */
export function impactValueOf(n: OrreryNode): number {
  if (!n.ch) return n.impMax;
  return n.ch.cls === 'false' || n.ch.cls === 'single' ? 0 : n.ch.spread;
}

/**
 * Axis tick labels around the containment wheel, for a document that declares an axis. A document
 * that declares none simply gets nothing here — the `pof-exemplars` case, and the reason this reads
 * the profile instead of assuming.
 */
export function drawAxisTicks(ctx: CanvasRenderingContext2D, input: SceneInput, outer: number): void {
  const { view, cam, palette } = input;
  const model = view.model;
  if (!model.raw.profile.axis) return;
  const f = model.R[view.focus];
  const kids = f?.kids ?? [];
  if (kids.length === 0 || kids.length > 64) return;

  ctx.font = `${palette.labelPx}px ${palette.fontFamily}`;
  ctx.fillStyle = palette.dim;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const vs = view.vs;
  const span = Math.max(1e-12, vs.w1 - vs.w0);
  let lastAngle = -Infinity;
  let lastLabel: string | null = null;

  for (const i of kids) {
    const n = model.R[i];
    if (n.axis === null) continue;
    const label = String(Math.round(n.axis * 100) / 100);
    if (label === lastLabel) continue;
    const a = -Math.PI / 2 + (TAU * (n.u0 - vs.w0)) / span;
    const widthPx = ((n.u1 - n.u0) / span) * TAU * (outer + 90) * cam.scale;
    if (widthPx < 16) continue;
    if (Math.abs(a - lastAngle) * (outer + 88) * cam.scale < 22) continue;
    lastAngle = a;
    const inner = worldToScreen(cam, Math.cos(a) * (outer + 80), Math.sin(a) * (outer + 80));
    const tick = worldToScreen(cam, Math.cos(a) * (outer + 88), Math.sin(a) * (outer + 88));
    ctx.strokeStyle = palette.spoke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(tick.x, tick.y);
    ctx.stroke();
    const text = worldToScreen(cam, Math.cos(a) * (outer + 95), Math.sin(a) * (outer + 95));
    ctx.fillText(label, text.x, text.y);
    lastLabel = label;
  }
}

export { ringInner };
