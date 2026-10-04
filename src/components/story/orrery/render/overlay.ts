/**
 * The overlay layer: hover, selection and the selected node's relations.
 *
 * It is a separate canvas for one reason — it is the only thing that changes when the pointer moves,
 * so the expensive scene underneath never has to be touched. It also draws with the LIVE camera
 * rather than the camera the scene was baked at, which is why a selection ring stays glued to its
 * sector through a drag even though the sector itself is a blitted bitmap.
 *
 * A selection that has been folded away still gets an answer: the fold that swallowed it is
 * outlined, and a dashed radial pin marks where the real node sits on the rim. The alternative —
 * outlining nothing — would make the panel and the wheel silently disagree.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryCamera } from '@/lib/story/orrery';
import {
  TAU,
  angleAt,
  chordControl,
  dockPoint,
  ringInner,
  wheelOuter,
} from '@/components/story/orrery/render/geometry';
import {
  anchorOfRep,
  isHubDocked,
  nodeAnchor,
  placeOf,
  visibleRep,
  type StageView,
} from '@/components/story/orrery/render/hitTest';
import { arrowHead, circlePath, segmentPath } from '@/components/story/orrery/render/ctx';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';
import type { ShowFlags } from '@/components/story/orrery/render/scene';

const HUB = ORRERY_GEOMETRY.hubRadius;

export interface OverlayInput {
  view: StageView;
  /** The LIVE camera, so the overlay tracks a gesture the scene bitmap is only blitted through. */
  cam: OrreryCamera;
  palette: OrreryPalette;
  show: ShowFlags;
  dpr: number;
  hover: NodeIx;
  hoverHub: boolean;
  selected: NodeIx;
}

interface OutlineStyle {
  colour: string;
  width: number;
  glow?: boolean;
}

/** Repaint the overlay from scratch. Cheap enough to run every frame of a gesture. */
export function drawOverlay(ctx: CanvasRenderingContext2D, input: OverlayInput): void {
  const { view, cam, palette, dpr } = input;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.cx, dpr * cam.cy);
  if (cam.rot !== 0) ctx.rotate(cam.rot);
  ctx.lineJoin = 'round';

  if (input.selected >= 0) drawRelations(ctx, input, input.selected);
  if (input.hover >= 0 && input.hover !== input.selected) {
    outline(ctx, input, input.hover, { colour: palette.hover, width: 1.6 });
  }
  if (input.selected >= 0) {
    outline(ctx, input, input.selected, { colour: palette.select, width: 2.6, glow: true });
  }
  if (input.hoverHub && view.focus !== view.root && !view.model.flat) {
    circlePath(ctx, 0, 0, HUB);
    ctx.lineWidth = 2 / cam.scale;
    ctx.strokeStyle = palette.hubRim;
    ctx.stroke();
  }
}

function outline(ctx: CanvasRenderingContext2D, input: OverlayInput, i: NodeIx, style: OutlineStyle): void {
  const { view, cam, palette } = input;
  const model = view.model;
  const n = model.R[i];
  if (!n) return;

  if (isHubDocked(model, i)) {
    const pos = model.dockPos.get(i);
    if (!pos) return;
    const hub = model.flat ? model.flat.Rh : HUB;
    const d = dockPoint(pos, hub);
    circlePath(ctx, d.x, d.y, d.r + 2 / cam.scale);
    ctx.lineWidth = style.width / cam.scale;
    ctx.strokeStyle = style.colour;
    ctx.stroke();
    return;
  }

  const rep = visibleRep(view, i);
  if (rep < 0) return;
  const place = placeOf(view, rep);
  if (!place) return;

  if (place.hub) {
    circlePath(ctx, 0, 0, HUB);
    ctx.lineWidth = style.width / cam.scale;
    ctx.strokeStyle = style.colour;
    ctx.stroke();
    return;
  }

  let a0 = place.a0;
  let a1 = place.a1;
  // A sector thinner than 3 screen pixels is widened so the ring is findable at all.
  const minSweep = 3 / cam.scale / ((place.r0 + place.r1) / 2 || 1);
  if (a1 - a0 < minSweep) {
    const mid = (a0 + a1) / 2;
    a0 = mid - minSweep / 2;
    a1 = mid + minSweep / 2;
  }
  let r1 = place.r1;
  if (rep !== i && !model.flat) {
    // The fold's full extent, so the outline covers what was actually painted.
    r1 = ringInner(model.R[rep].maxd - view.vs.base + 1, view.vs);
  }
  segmentPath(ctx, a0, a1, place.r0, r1);
  ctx.lineWidth = style.width / cam.scale;
  ctx.strokeStyle = style.colour;
  if (style.glow) {
    ctx.shadowColor = style.colour;
    ctx.shadowBlur = 10;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (rep !== i && !model.flat) {
    const target = model.R[i];
    const a = angleAt((target.u0 + target.u1) / 2, view.vs);
    const outer = wheelOuter(view.vs);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * place.r0, Math.sin(a) * place.r0);
    ctx.lineTo(Math.cos(a) * (outer + 2), Math.sin(a) * (outer + 2));
    ctx.lineWidth = 1.4 / cam.scale;
    ctx.strokeStyle = palette.dim;
    ctx.setLineDash([3 / cam.scale, 2 / cam.scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** The selected node's own edges: outbound, inbound and every influence that touches it. */
function drawRelations(ctx: CanvasRenderingContext2D, input: OverlayInput, i: NodeIx): void {
  const { view, cam, palette, show } = input;
  const model = view.model;
  const from = nodeAnchor(view, i);
  if (!from) return;

  const arc = (j: NodeIx, colour: string, dashed: boolean, outward: boolean) => {
    const other = anchorOfRep(view, visibleRep(view, j));
    if (!other) return;
    const p1 = outward ? from : other;
    const p2 = outward ? other : from;
    const c = chordControl(p1.x, p1.y, p2.x, p2.y);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(c.cx, c.cy, p2.x, p2.y);
    ctx.lineWidth = 2 / cam.scale;
    ctx.strokeStyle = colour;
    ctx.setLineDash(dashed ? [4 / cam.scale, 3 / cam.scale] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colour;
    arrowHead(ctx, c.cx, c.cy, p2.x, p2.y, 7 / cam.scale);
    circlePath(ctx, other.x, other.y, 3 / cam.scale);
    ctx.fill();
  };

  if (show.paths) {
    for (const e of model.out[i] ?? []) arc(e.to, palette.outbound, false, true);
    for (const e of model.inn[i] ?? []) arc(e.from, palette.inbound, false, false);
  }
  if (show.influence) {
    for (const e of model.infl) {
      if (e.from === i) arc(e.to, palette.influence, true, true);
      else if (e.to === i) arc(e.from, palette.influence, true, false);
    }
  }
}

export { TAU };
