/**
 * The render engine: the two regimes, and the only mutable state in the stage.
 *
 * ── The two regimes, which are the whole performance story ───────────────────────────────────────
 * **At rest** the surface is declarative: props change, the scene is baked once into an offscreen
 * bitmap wider than the stage, and that is that. Nothing animates, no timer runs, no frame is
 * requested — an idle wheel does not keep the machine warm.
 *
 * **During a gesture** the fast path is imperative. A pointer move mutates `cam` in place and asks
 * for one frame; that frame does not re-bake anything, it blits the existing bitmap through the
 * delta transform and repaints the cheap overlay. React is not told. The scene is re-baked exactly
 * once, {@link SETTLE_MS} after the gesture stops, and the stats are published then.
 *
 * That is why `bakes` is a number worth reporting: a 100-step drag must add 1 to it, not 100, and
 * `data-bakes` on the stage element is how a test proves it without a frame counter.
 *
 * The imperative path touches the TRANSFORM only. It never reads or writes the model.
 */

import { ORRERY_GEOMETRY } from '@/lib/story/orrery/layout';
import type { NodeIx, OrreryCamera, OrreryModel } from '@/lib/story/orrery';
import {
  clampCameraScale,
  drawFrameRect,
  ease,
  fitCamera,
  lerpCamera,
  screenToWorld,
  zoomAtScreenPoint,
  zoomLimits,
  type ZoomLimits,
} from '@/components/story/orrery/render/camera';
import {
  lerpViewState,
  sceneExtent,
  viewStateFor,
  type OrreryViewState,
} from '@/components/story/orrery/render/geometry';
import { displayRoot } from '@/components/story/orrery/render/derive';
import { detailBands, lensModeOf } from '@/components/story/orrery/render/lod';
import { emptyStats, makeHatchPattern, type DrawStats } from '@/components/story/orrery/render/ctx';
import { drawHierarchy } from '@/components/story/orrery/render/drawHier';
import { drawFlatDial } from '@/components/story/orrery/render/drawFlat';
import { drawOverlay } from '@/components/story/orrery/render/overlay';
import { hitTest, placeOf, type Hit, type StageView } from '@/components/story/orrery/render/hitTest';
import type { OrreryPalette } from '@/components/story/orrery/render/palette';
import type { SceneInput, ShowFlags } from '@/components/story/orrery/render/scene';

/** How long after the last gesture event the crisp re-bake happens. The winner's 130 ms. */
export const SETTLE_MS = 130;
/** Pointer travel, in pixels, past which a press is a drag and not a click. */
export const DRAG_THRESHOLD = 4;
/** Cap on the baked bitmap, in device pixels, so the overscan cannot eat memory on a 4K display. */
const MAX_BAKE_PX = 14e6;
/** How much larger than the stage the bitmap is baked, so a pan has something to blit from. */
const OVERSCAN = 1.5;

export interface EngineProps {
  model: OrreryModel;
  focus: NodeIx;
  selected: NodeIx;
  lens: string | null;
  show: ShowFlags;
}

export interface EngineCallbacks {
  /** Published once per bake, never during a gesture. */
  onStats: (stats: DrawStats & { bakes: number }) => void;
  /** The hover target changed; the host moves the tooltip. `null` means nothing is hovered. */
  onHover: (hit: Hit | null) => void;
}

export interface OrreryEngine {
  attach(main: HTMLCanvasElement, overlay: HTMLCanvasElement): void;
  resize(width: number, height: number, dpr: number): void;
  setPalette(palette: OrreryPalette): void;
  setProps(props: EngineProps): void;
  /** Schedule a frame. Idempotent. */
  schedule(): void;
  /** Force a full re-bake on the next frame. */
  invalidate(): void;
  /** Repaint only the overlay on the next frame. */
  invalidateOverlay(): void;
  beginDrag(x: number, y: number): void;
  dragTo(x: number, y: number): boolean;
  endDrag(): boolean;
  wheelZoom(x: number, y: number, deltaY: number, deltaMode: number): void;
  zoomBy(factor: number): void;
  fit(): void;
  hitAt(x: number, y: number): Hit | null;
  setHover(hit: Hit | null): void;
  /** Glide the camera so one node fills a comfortable share of the stage (the dial's dive). */
  frameNode(i: NodeIx): void;
  view(): StageView;
  camera(): OrreryCamera;
  stats(): DrawStats & { bakes: number };
  setReducedMotion(reduced: boolean): void;
  pause(): void;
  dispose(): void;
}

interface Animation {
  kind: 'camera' | 'focus';
  from: OrreryCamera;
  to: OrreryCamera;
  fromVs?: OrreryViewState;
  toVs?: OrreryViewState;
  focus?: NodeIx;
  duration: number;
  start: number;
}

export function createOrreryEngine(
  initial: EngineProps,
  callbacks: EngineCallbacks,
): OrreryEngine {
  let props = initial;
  let root = displayRoot(props.model);
  let vs = viewStateFor(props.model, props.focus >= 0 ? props.focus : root);
  let focus = props.focus >= 0 ? props.focus : root;

  let main: HTMLCanvasElement | null = null;
  let overlay: HTMLCanvasElement | null = null;
  let mainCtx: CanvasRenderingContext2D | null = null;
  let overlayCtx: CanvasRenderingContext2D | null = null;
  const bake = typeof document === 'undefined' ? null : document.createElement('canvas');
  const bakeCtx = bake ? bake.getContext('2d') : null;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let overscanX = 0;
  let overscanY = 0;

  let palette: OrreryPalette | null = null;
  let hatch: CanvasPattern | null = null;
  let hatchKey = '';

  let cam: OrreryCamera = { cx: 0, cy: 0, scale: 1, focus, rot: 0 };
  let fitScale = 1;
  let atFit = true;
  let bakeCam: OrreryCamera | null = null;
  let bakeVs: OrreryViewState = vs;
  let bakeOffsetX = 0;
  let bakeOffsetY = 0;
  let bakeBands = { rimDepth: 0, chordDepth: 0 };

  let raf = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let gesture = false;
  let anim: Animation | null = null;
  let reduced = false;
  let paused = false;

  let needBake = true;
  let needOverlay = true;
  let drag: { x: number; y: number; cx: number; cy: number; moved: number } | null = null;
  let hover: Hit | null = null;
  let stats: DrawStats & { bakes: number } = { ...emptyStats(), bakes: 0 };

  const limits = (): ZoomLimits => zoomLimits(fitScale, Boolean(props.model.flat));

  const currentView = (): StageView => {
    const scale = bakeCam ? bakeCam.scale : cam.scale;
    return {
      model: props.model,
      vs: bakeCam ? bakeVs : vs,
      focus,
      scale,
      rimDepth: bakeBands.rimDepth,
      root,
    };
  };

  const sceneInput = (overscan: boolean): SceneInput | null => {
    if (!palette) return null;
    const ox = overscan ? overscanX : 0;
    const oy = overscan ? overscanY : 0;
    const bands = detailBands(props.model, focus, vs, cam.scale);
    return {
      view: { model: props.model, vs, focus, scale: cam.scale, rimDepth: bands.rimDepth, root },
      cam: { ...cam },
      palette,
      lens: lensModeOf(props.model, props.lens),
      show: props.show,
      rect: drawFrameRect(cam, width, height, ox, oy),
      width,
      height,
      dpr,
      offsetX: ox,
      offsetY: oy,
      hatch,
      chordDepth: bands.chordDepth,
    };
  };

  function renderBake(overscan: boolean): void {
    if (!bake || !bakeCtx || !palette || width === 0) return;
    const input = sceneInput(overscan);
    if (!input) return;
    bakeCtx.setTransform(1, 0, 0, 1, 0, 0);
    bakeCtx.clearRect(0, 0, bake.width, bake.height);
    bakeCam = input.cam;
    bakeVs = vs;
    bakeOffsetX = input.offsetX;
    bakeOffsetY = input.offsetY;
    bakeBands = { rimDepth: input.view.rimDepth, chordDepth: input.chordDepth };
    const result = props.model.flat ? drawFlatDial(bakeCtx, input) : drawHierarchy(bakeCtx, input);
    stats = { ...result, bakes: stats.bakes + 1 };
    callbacks.onStats(stats);
  }

  /** Blit the baked bitmap through the delta between the bake camera and the live one. */
  function present(): void {
    if (!main || !mainCtx || !bake || !bakeCam) return;
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.clearRect(0, 0, main.width, main.height);
    const s = cam.scale / bakeCam.scale;
    const e = dpr * ((-bakeOffsetX - bakeCam.cx) * s + cam.cx);
    const f = dpr * ((-bakeOffsetY - bakeCam.cy) * s + cam.cy);
    mainCtx.setTransform(s, 0, 0, s, e, f);
    mainCtx.drawImage(bake, 0, 0);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function paintOverlay(): void {
    if (!overlayCtx || !palette) return;
    drawOverlay(overlayCtx, {
      view: currentView(),
      cam,
      palette,
      show: props.show,
      dpr,
      hover: hover && hover.zone !== 'hub' ? hover.i : -1,
      hoverHub: hover?.zone === 'hub',
      selected: props.selected,
    });
  }

  function frame(): void {
    raf = 0;
    if (paused) return;
    if (anim) {
      stepAnim();
      return;
    }
    if (gesture) {
      present();
      paintOverlay();
      return;
    }
    if (needBake) {
      needBake = false;
      needOverlay = false;
      renderBake(true);
      present();
      paintOverlay();
      return;
    }
    if (needOverlay) {
      needOverlay = false;
      paintOverlay();
    }
  }

  function schedule(): void {
    if (paused || raf !== 0 || typeof requestAnimationFrame === 'undefined') return;
    raf = requestAnimationFrame(frame);
  }

  function startAnim(a: Omit<Animation, 'start'>): void {
    anim = { ...a, duration: reduced ? 0 : a.duration, start: now() };
    schedule();
  }

  function stepAnim(): void {
    const a = anim;
    if (!a) return;
    const t = a.duration > 0 ? Math.min(1, Math.max(0, (now() - a.start) / a.duration)) : 1;
    const e = ease(t);
    cam = lerpCamera(a.from, a.to, e, a.kind === 'focus');
    if (a.kind === 'focus' && a.fromVs && a.toVs) {
      vs = lerpViewState(a.fromVs, a.toVs, e);
      // The re-root glide is the one place the scene is re-baked per frame: the rings themselves
      // are changing, so there is no bitmap to blit. No overscan, because nothing is panning.
      renderBake(false);
    }
    present();
    paintOverlay();
    if (t >= 1) {
      if (a.kind === 'focus' && a.toVs) {
        vs = a.toVs;
        if (a.focus !== undefined) focus = a.focus;
      }
      anim = null;
      needBake = true;
      needOverlay = true;
    }
    schedule();
  }

  function gestureTick(): void {
    gesture = true;
    atFit = false;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      gesture = false;
      needBake = true;
      needOverlay = true;
      schedule();
    }, SETTLE_MS);
    schedule();
  }

  function refit(animate: boolean): void {
    const target = fitCamera(sceneExtent(props.model, vs), width, height, focus, cam.rot);
    fitScale = target.scale;
    atFit = true;
    if (!animate || reduced) {
      cam = target;
      needBake = true;
      needOverlay = true;
      schedule();
      return;
    }
    startAnim({ kind: 'camera', from: { ...cam }, to: target, duration: 380 });
  }

  function reroot(next: NodeIx): void {
    if (props.model.flat || next < 0 || next >= props.model.R.length) return;
    const toVs = viewStateFor(props.model, next);
    const target = fitCamera(sceneExtent(props.model, toVs), width, height, next, cam.rot);
    fitScale = target.scale;
    atFit = true;
    const depthDelta = Math.abs(props.model.R[next].depth - props.model.R[focus].depth);
    hover = null;
    startAnim({
      kind: 'focus',
      from: { ...cam },
      to: target,
      fromVs: vs,
      toVs,
      focus: next,
      duration: Math.min(900, 520 + depthDelta * 80),
    });
  }

  function syncHatch(): void {
    if (!bakeCtx || !palette) return;
    const key = `${palette.theme}|${dpr}`;
    if (key === hatchKey && hatch) return;
    hatch = makeHatchPattern(bakeCtx, palette, dpr);
    hatchKey = key;
  }

  return {
    attach(nextMain, nextOverlay) {
      main = nextMain;
      overlay = nextOverlay;
      mainCtx = nextMain.getContext('2d');
      overlayCtx = nextOverlay.getContext('2d');
      needBake = true;
      schedule();
    },
    resize(w, h, ratio) {
      const nextW = Math.max(300, Math.round(w));
      const nextH = Math.max(260, Math.round(h));
      const nextDpr = Math.min(2, ratio || 1);
      if (nextW === width && nextH === height && nextDpr === dpr) return;
      const hadSize = width > 0;
      const wasAtFit = atFit;
      width = nextW;
      height = nextH;
      dpr = nextDpr;
      for (const c of [main, overlay]) {
        if (!c) continue;
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      // Overscan, shrunk until the bitmap fits the memory cap.
      let f = OVERSCAN;
      while (f > 1 && width * f * height * f * dpr * dpr > MAX_BAKE_PX) f -= 0.05;
      overscanX = Math.round((width * (f - 1)) / 2);
      overscanY = Math.round((height * (f - 1)) / 2);
      if (bake) {
        bake.width = Math.round((width + 2 * overscanX) * dpr);
        bake.height = Math.round((height + 2 * overscanY) * dpr);
      }
      hatchKey = '';
      syncHatch();
      if (!hadSize || wasAtFit) refit(false);
      else {
        needBake = true;
        needOverlay = true;
        schedule();
      }
    },
    setPalette(next) {
      palette = next;
      hatchKey = '';
      syncHatch();
      needBake = true;
      needOverlay = true;
      schedule();
    },
    setProps(next) {
      const prev = props;
      props = next;
      if (prev.model !== next.model) {
        root = displayRoot(next.model);
        focus = next.focus >= 0 ? next.focus : root;
        vs = viewStateFor(next.model, focus);
        anim = null;
        // A hover is about a node in the OLD document; carrying it over would outline an index
        // that now means something else.
        hover = null;
        refit(false);
        return;
      }
      if (next.focus !== focus && next.focus >= 0) {
        if (next.model.flat) focus = next.focus;
        else {
          reroot(next.focus);
          return;
        }
      }
      if (
        prev.lens !== next.lens ||
        prev.show.impact !== next.show.impact ||
        prev.show.paths !== next.show.paths ||
        prev.show.influence !== next.show.influence ||
        prev.show.flags !== next.show.flags
      ) {
        needBake = true;
      }
      needOverlay = true;
      schedule();
    },
    schedule,
    invalidate() {
      needBake = true;
      needOverlay = true;
      schedule();
    },
    invalidateOverlay() {
      needOverlay = true;
      schedule();
    },
    beginDrag(x, y) {
      anim = null;
      drag = { x, y, cx: cam.cx, cy: cam.cy, moved: 0 };
    },
    dragTo(x, y) {
      if (!drag) return false;
      const dx = x - drag.x;
      const dy = y - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (drag.moved <= DRAG_THRESHOLD) return false;
      // THE fast path: mutate the transform, ask for one frame, tell React nothing.
      cam = { ...cam, cx: drag.cx + dx, cy: drag.cy + dy };
      gestureTick();
      return true;
    },
    endDrag() {
      const wasDrag = Boolean(drag && drag.moved > DRAG_THRESHOLD);
      drag = null;
      return wasDrag;
    },
    wheelZoom(x, y, deltaY, deltaMode) {
      anim = null;
      let dy = deltaY;
      if (deltaMode === 1) dy *= 16;
      else if (deltaMode === 2) dy *= 400;
      const factor = Math.exp(-Math.min(240, Math.max(-240, dy)) * 0.0017);
      cam = zoomAtScreenPoint(cam, factor, x, y, limits());
      gestureTick();
    },
    zoomBy(factor) {
      const target = zoomAtScreenPoint(cam, factor, width / 2, height / 2, limits());
      atFit = false;
      startAnim({ kind: 'camera', from: { ...cam }, to: target, duration: 220 });
    },
    fit() {
      refit(true);
    },
    hitAt(x, y) {
      if (!bakeCam) return null;
      const w = screenToWorld(cam, x, y);
      return hitTest(currentView(), w.x, w.y);
    },
    setHover(next) {
      const sameNode = (hover?.i ?? -1) === (next?.i ?? -1);
      const sameZone = (hover?.zone ?? '') === (next?.zone ?? '');
      if (sameNode && sameZone) return;
      hover = next;
      needOverlay = true;
      schedule();
      callbacks.onHover(next);
    },
    frameNode(i) {
      const place = placeOf(currentView(), i);
      if (!place) return;
      const a = (place.a0 + place.a1) / 2;
      const rMid = (place.r0 + place.r1) / 2;
      const wx = Math.cos(a) * rMid;
      const wy = Math.sin(a) * rMid;
      const sizeW = Math.max((place.a1 - place.a0) * rMid, place.r1 - place.r0, 40);
      const scale = clampCameraScale((Math.min(width, height) * 0.34) / sizeW, {
        lo: fitScale * 1.6,
        hi: fitScale * 12,
      });
      atFit = false;
      startAnim({
        kind: 'camera',
        from: { ...cam },
        to: { ...cam, scale, cx: width / 2 - wx * scale, cy: height / 2 - wy * scale },
        duration: 520,
      });
    },
    view: currentView,
    camera: () => cam,
    stats: () => stats,
    setReducedMotion(next) {
      reduced = next;
    },
    pause() {
      paused = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = null;
      gesture = false;
      anim = null;
    },
    dispose() {
      paused = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = null;
      main = null;
      overlay = null;
      mainCtx = null;
      overlayCtx = null;
    },
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export { ORRERY_GEOMETRY };
