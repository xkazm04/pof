/**
 * The screen-space label sweep, shared by both layouts.
 *
 * It runs in SCREEN pixels, not world units, which is the whole reason labels stay crisp and
 * readable at any zoom: the text is never scaled by the camera, it is placed by it. Each slot gets
 * three attempts in the order that reads best — bent along the arc, set radially across the ring,
 * then the short id along the arc — and a slot that fails all three draws nothing at all.
 */

import { worldToScreen } from '@/components/story/orrery/render/camera';
import { arcText } from '@/components/story/orrery/render/ctx';
import { labelCandidates, tailLabel, wrapText } from '@/components/story/orrery/render/labels';
import type { LabelSlot, SceneInput } from '@/components/story/orrery/render/scene';

/** Minimum ring thickness, in screen pixels, before a radial label is even tried. */
const MIN_THICK_PX = 14;
/** Minimum arc length, in screen pixels, before any label is tried. */
const MIN_ARC_PX = 14;

/** Draw every label that fits. Returns how many were actually drawn. */
export function drawLabelSweep(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  slots: readonly LabelSlot[],
): number {
  const { view, cam, palette } = input;
  const model = view.model;
  ctx.font = `${palette.labelPx}px ${palette.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const centre = worldToScreen(cam, 0, 0);
  let drawn = 0;

  for (const slot of slots) {
    const n = model.R[slot.i];
    if (!n) continue;
    const rMid = (slot.r0 + slot.r1) / 2;
    const arcPx = (slot.a1 - slot.a0) * rMid * cam.scale;
    const thickPx = (slot.r1 - slot.r0) * cam.scale;
    const angle = (slot.a0 + slot.a1) / 2 + cam.rot;
    ctx.fillStyle = palette.isLightFill(slot.fill) ? palette.bg : palette.inkHi;

    let done = false;
    if (arcPx >= thickPx * 0.85 && thickPx >= MIN_THICK_PX) {
      const t = fit(ctx, labelCandidates(model, n), arcPx - 10);
      if (t) {
        arcText(ctx, t, centre.x, centre.y, rMid * cam.scale, angle);
        done = true;
      }
    }
    if (!done && arcPx >= 15) {
      const t = fit(ctx, labelCandidates(model, n), thickPx - 8);
      if (t) {
        const p = worldToScreen(cam, Math.cos(angle) * rMid, Math.sin(angle) * rMid);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.cos(angle) < 0 ? angle + Math.PI : angle);
        ctx.fillText(t, 0, 0);
        ctx.restore();
        done = true;
      }
    }
    if (!done && thickPx >= MIN_THICK_PX && arcPx >= MIN_ARC_PX) {
      const t = fit(ctx, [tailLabel(model, n)], arcPx - 6);
      if (t) {
        arcText(ctx, t, centre.x, centre.y, rMid * cam.scale, angle);
        done = true;
      }
    }
    if (done) drawn++;
  }
  return drawn;
}

/** `fitText` against the live context. Split out only so the sweep above stays readable. */
function fit(ctx: CanvasRenderingContext2D, candidates: readonly string[], avail: number): string | null {
  for (const t of candidates) {
    if (!t) continue;
    if (ctx.measureText(t).width <= avail) return t;
  }
  const full = candidates.find(Boolean);
  if (!full || avail < 30) return null;
  let lo = 0;
  let hi = full.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(full.slice(0, mid) + '…').width <= avail) lo = mid;
    else hi = mid - 1;
  }
  return lo >= 3 ? full.slice(0, lo).trimEnd() + '…' : null;
}

/**
 * The hub's own label: what you are looking at, what kind of thing it is, how much story is inside
 * it, and — when you are below the root — that the centre is the way back out.
 */
export function drawHubLabel(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  hubRadius: number,
  hasDocks: boolean,
): void {
  const { view, cam, palette } = input;
  const model = view.model;
  const f = model.R[view.focus];
  if (!f) return;
  const atRoot = view.focus === view.root;
  const rPx = hubRadius * cam.scale;
  if (rPx < 26 || (atRoot && hasDocks && rPx < 84)) return;

  const centre = worldToScreen(cam, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.min(16, Math.max(palette.labelPx, rPx * 0.105));
  const title = f.virtual ? model.raw.project : f.title;
  const width = rPx * (atRoot && hasDocks ? 0.8 : 1.5);

  ctx.fillStyle = palette.inkHi;
  ctx.font = `600 ${size}px ${palette.fontFamily}`;
  const lines = wrapText(ctx, title, width, 3);
  const lh = size * 1.2;
  let y = centre.y - (lines.length * lh) / 2 + lh / 2 - (atRoot && hasDocks ? size * 0.1 : size * 0.6);
  for (const line of lines) {
    ctx.fillText(line, centre.x, y);
    y += lh;
  }

  ctx.font = `${Math.max(palette.labelPx, size * 0.82)}px ${palette.fontFamily}`;
  ctx.fillStyle = palette.mut;
  const nodes = f.w.toLocaleString('en-US');
  if (atRoot && hasDocks) {
    ctx.fillText(`${nodes} nodes`, centre.x, centre.y + size * 0.9);
    return;
  }
  const kind = f.kind === 'container' ? f.cls || 'container' : f.kind;
  ctx.fillText(`${kind} · ${nodes} nodes`, centre.x, y + 2);
  if (!atRoot) {
    ctx.fillStyle = palette.dim;
    ctx.fillText('click centre to go up', centre.x, y + 2 + size);
  }
}
