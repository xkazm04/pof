/**
 * The wheel's evidence-status cue: a sector whose figure is not `verified` gets a rim outline drawn
 * IN ADDITION to its fill — dashed for `stale`, dotted for `unverified`, in the theme's warn ink.
 *
 * What it never marks: a verified cell (no marker), an unmeasured sector (the hatch alone says that,
 * and an unmeasured cell has no status to show), the kind lens (no figure, so no status).
 *
 * Dashed vs dotted is the non-hue cue (not colour alone). The outline is INSET a couple of screen
 * pixels inside the sector, so it never sits on the edge strokes the wheel already uses (the
 * measured-zero outline, the audit flag, the sibling separator): a stale measured zero reads as both.
 *
 * Batched: every marker of one status goes into one `Path2D` and is stroked ONCE per bake, so a
 * wheel where every drawn sector is unverified costs two strokes, not thousands of dash-state
 * changes. Widths and dash lengths are CSS pixels divided by the bake scale — screen-constant, the
 * way `rescaleHatch` keeps the hatch screen-constant (the device ratio is already in the transform).
 */

import type { EvidenceStatus } from '@/lib/story/evidence';
import { cellStatus, worseStatus } from '@/lib/story/orrery/status';
import type { OrreryModel, OrreryNode } from '@/lib/story/orrery';
import { lensValue, type LensMode } from '@/components/story/orrery/render/lod';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';

/** The two marker styles, in CSS pixels. Exported so tests and the Legend agree with the wheel. */
export const STATUS_STROKE: Record<'stale' | 'unverified', { width: number; dash: readonly number[] }> = {
  stale: { width: 1.4, dash: [5, 3] },
  unverified: { width: 1.6, dash: [1.4, 2.6] },
};
/** Extra width of the dark halo under each marker, in CSS pixels. */
const HALO_PX = 1.6;
/** How far inside the sector edge the marker runs, in CSS pixels. */
const INSET_PX = 2.2;
/** A ring dot's marker sits this far outside the dot, in CSS pixels. */
const DOT_GAP_PX = 2.2;
/**
 * A sector narrower or thinner than this on screen does not get an outline of its own: a dotted
 * outline round a 2px sliver is all ink and no fill, and at 10k nodes that turned the reach ring into
 * a texture. Instead each run of such slivers that sit side by side in one ring with one status gets
 * ONE outline round the whole run — every drawn sector still sits inside its status outline.
 */
const OWN_OUTLINE_PX = 8;

/**
 * What the active lens says about this node's evidence status. Mirrors `lensValue`: a MEASURED figure
 * has its own cell's status, a DERIVED one the worst of the descendants that fed it, an unmeasured
 * one none. The divergence lens reads every cohort, so it takes the worst over all of them.
 */
export function lensStatus(model: OrreryModel, n: OrreryNode, lens: LensMode): EvidenceStatus | null {
  if (lens.mode === 'kind' || !model.status) return null;
  const v = lensValue(model, n, lens);
  if (v.state !== 'measured' && v.state !== 'derived') return null;
  const which = v.state === 'measured' ? 'own' : 'derived';
  if (lens.mode === 'cohort') return cellStatus(model.status, n.i, lens.cohort, which);
  let worst: EvidenceStatus | null = null;
  for (const c of model.cohorts) worst = worseStatus(worst, cellStatus(model.status, n.i, c, which));
  return worst;
}

interface Run {
  status: 'stale' | 'unverified';
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

export interface StatusMarks {
  stale: Path2D | null;
  unverified: Path2D | null;
  /** Outlines queued (a merged run counts once). */
  count: number;
  /** The open run of slivers per ring, keyed by the ring's inner radius. */
  runs: Map<number, Run>;
}

export function newStatusMarks(): StatusMarks {
  return { stale: null, unverified: null, count: 0, runs: new Map() };
}

function pathFor(marks: StatusMarks, status: 'stale' | 'unverified'): Path2D {
  let p = marks[status];
  if (!p) {
    p = new Path2D();
    marks[status] = p;
  }
  marks.count++;
  return p;
}

/**
 * Queue a sector's marker. A sector with room gets its own inset outline; a sliver joins (or opens)
 * the run of same-status slivers it touches in its ring, outlined once when the run closes.
 */
export function markSector(
  marks: StatusMarks,
  status: EvidenceStatus | null,
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  scale: number,
): void {
  if (status !== 'stale' && status !== 'unverified') return;
  const wide = (a1 - a0) * ((r0 + r1) / 2) * scale >= OWN_OUTLINE_PX && (r1 - r0) * scale >= OWN_OUTLINE_PX;
  if (wide) {
    outline(marks, status, a0, a1, r0, r1, scale);
    return;
  }
  const run = marks.runs.get(r0);
  if (run && run.status === status && run.r1 === r1 && Math.abs(a0 - run.a1) < 1e-9) {
    run.a1 = a1;
    return;
  }
  if (run) outline(marks, run.status, run.a0, run.a1, run.r0, run.r1, scale);
  marks.runs.set(r0, { status, a0, a1, r0, r1 });
}

function outline(
  marks: StatusMarks,
  status: 'stale' | 'unverified',
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  scale: number,
): void {
  const p = pathFor(marks, status);
  const inset = INSET_PX / scale;
  const da = inset / Math.max((r0 + r1) / 2, 1e-6);
  // Too small to inset: run on the sector edge itself, so a drawn sector never loses its cue.
  const room = a1 - a0 > da * 3 && r1 - r0 > inset * 3;
  const b0 = room ? a0 + da : a0;
  const b1 = room ? a1 - da : a1;
  const q0 = room ? r0 + inset : r0;
  const q1 = room ? r1 - inset : r1;
  p.moveTo(Math.cos(b0) * q1, Math.sin(b0) * q1);
  p.arc(0, 0, q1, b0, b1);
  p.arc(0, 0, q0, b1, b0, true);
  p.closePath();
}

/** Queue a ring around a hub-docked dot (an ending), just outside the dot's own ring. */
export function markDot(marks: StatusMarks, status: EvidenceStatus | null, x: number, y: number, r: number, scale: number): void {
  if (status !== 'stale' && status !== 'unverified') return;
  const p = pathFor(marks, status);
  const rr = r + DOT_GAP_PX / scale;
  p.moveTo(x + rr, y);
  p.arc(x, y, rr, 0, Math.PI * 2);
}

/** Stroke every queued marker: one dashed path, one dotted path (each haloed). Leaves the dash reset. */
export function strokeStatusMarks(ctx: CanvasRenderingContext2D, marks: StatusMarks, palette: OrreryPalette, scale: number): void {
  for (const run of marks.runs.values()) outline(marks, run.status, run.a0, run.a1, run.r0, run.r1, scale);
  marks.runs.clear();
  for (const status of ['stale', 'unverified'] as const) {
    const p = marks[status];
    if (!p) continue;
    const s = STATUS_STROKE[status];
    ctx.setLineDash(s.dash.map((d) => d / scale));
    // A halo of the stage ground under the same dashes, so the warn ink still reads on a pale
    // (high-reach) fill as well as on a dark one. Same pattern, so it never reads solid.
    ctx.lineWidth = (s.width + HALO_PX) / scale;
    ctx.strokeStyle = palette.bg;
    ctx.stroke(p);
    ctx.lineWidth = s.width / scale;
    ctx.strokeStyle = palette.statusInk;
    ctx.stroke(p);
  }
  ctx.setLineDash([]);
}
