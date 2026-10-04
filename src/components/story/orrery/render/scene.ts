/**
 * What a draw pass is given. One shape for both layouts, so the engine does not branch on the mode
 * until the last moment.
 */

import type { OrreryCamera } from '@/lib/story/orrery';
import type { WorldRect } from '@/components/story/orrery/render/geometry';
import type { StageView } from '@/components/story/orrery/render/hitTest';
import type { LensMode } from '@/components/story/orrery/render/lod';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';

/** Which optional layers are on. Mirrors `OrreryStageProps.show`. */
export interface ShowFlags {
  impact: boolean;
  paths: boolean;
  influence: boolean;
  flags: boolean;
}

export interface SceneInput {
  view: StageView;
  /** The camera this bake is taken at — NOT the live camera during a gesture. */
  cam: OrreryCamera;
  palette: OrreryPalette;
  lens: LensMode;
  show: ShowFlags;
  /** The culling rect, in the draw frame. */
  rect: WorldRect;
  width: number;
  height: number;
  dpr: number;
  /** Overscan, in CSS pixels, baked around the stage so a pan can blit instead of redraw. */
  offsetX: number;
  offsetY: number;
  hatch: CanvasPattern | null;
  /** Depth the chord layer aggregates to, from `detailBands`. */
  chordDepth: number;
}

/** One label the pass decided it had room for, resolved in a second screen-space sweep. */
export interface LabelSlot {
  i: number;
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  /** The fill it sits on, so the ink can be flipped for contrast. */
  fill: string;
}

/** One rim unit: the angular slice its impact spike and flag mark get. */
export interface RimUnit {
  i: number;
  a0: number;
  a1: number;
}

/** Set the world transform for a pass: translate, scale, then the camera's own rotation. */
export function setWorldTransform(ctx: CanvasRenderingContext2D, input: SceneInput): void {
  const { cam, dpr, offsetX, offsetY } = input;
  ctx.setTransform(
    dpr * cam.scale,
    0,
    0,
    dpr * cam.scale,
    dpr * (cam.cx + offsetX),
    dpr * (cam.cy + offsetY),
  );
  if (cam.rot !== 0) ctx.rotate(cam.rot);
}

/** Set the screen transform for the label sweep: device pixels, offset by the overscan. */
export function setScreenTransform(ctx: CanvasRenderingContext2D, input: SceneInput): void {
  const { dpr, offsetX, offsetY } = input;
  ctx.setTransform(dpr, 0, 0, dpr, dpr * offsetX, dpr * offsetY);
}
