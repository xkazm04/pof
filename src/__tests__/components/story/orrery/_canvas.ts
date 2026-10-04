/**
 * A fake 2D context, because jsdom has none.
 *
 * It is deliberately a RECORDING stub rather than a no-op: the draw passes' honesty is measured by
 * what they ask the context to do (how many fills, how many patterns, which colours), so the stub
 * counts. `measureText` returns a plausible width from the current font so the label fitter has
 * something real to reject — a stub that returned 0 would make every label "fit" and the one
 * constraint the owner stated ("without overflowing of text") would go untested.
 */

import { vi } from 'vitest';

export interface FakeCtxLog {
  fills: number;
  strokes: number;
  texts: string[];
  patterns: number;
  gradients: number;
  fillStyles: string[];
  images: number;
}

export interface FakeCtx {
  ctx: CanvasRenderingContext2D;
  /** Live counters — read them AFTER the pass has run. */
  log: FakeCtxLog;
}

/** Average glyph width as a fraction of the font size. Close enough to a real sans-serif. */
const GLYPH_RATIO = 0.55;

export function makeFakeContext(width = 1200, height = 760): FakeCtx {
  const log: FakeCtxLog = {
    fills: 0,
    strokes: 0,
    texts: [],
    patterns: 0,
    gradients: 0,
    fillStyles: [],
    images: 0,
  };
  let font = '12px sans-serif';
  const api: Record<string, unknown> = {
    canvas: { width, height },
    set font(v: string) {
      font = v;
    },
    get font() {
      return font;
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    textAlign: 'center',
    textBaseline: 'middle',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    setTransform: () => undefined,
    resetTransform: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    quadraticCurveTo: () => undefined,
    setLineDash: () => undefined,
    fill: () => {
      log.fills++;
      log.fillStyles.push(String((api as { fillStyle: unknown }).fillStyle));
    },
    stroke: () => {
      log.strokes++;
    },
    drawImage: () => {
      log.images++;
    },
    fillText: (text: string) => {
      log.texts.push(text);
    },
    measureText: (text: string) => {
      const size = parseFloat(font) || 12;
      return { width: String(text).length * size * GLYPH_RATIO };
    },
    createRadialGradient: () => {
      log.gradients++;
      return { addColorStop: () => undefined };
    },
    createPattern: () => {
      log.patterns++;
      return { setTransform: () => undefined };
    },
  };
  return { ctx: api as unknown as CanvasRenderingContext2D, log };
}

/**
 * Install the stub for a whole suite: every `<canvas>` hands out a fake context, `Path2D` exists,
 * and `scrollIntoView` is a no-op. Returns the log of the LAST context handed out, which for the
 * stage is the overlay — use {@link makeFakeContext} directly when a pass is measured in isolation.
 */
export function installCanvasStub(): { contexts: FakeCtxLog[] } {
  const contexts: FakeCtxLog[] = [];
  const fakes = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    const existing = fakes.get(this);
    if (existing) return existing;
    const made = makeFakeContext(this.width || 1200, this.height || 760);
    fakes.set(this, made.ctx);
    contexts.push(made.log);
    return made.ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);

  if (typeof (globalThis as { Path2D?: unknown }).Path2D === 'undefined') {
    class FakePath2D {
      moveTo() {}
      lineTo() {}
      arc() {}
      quadraticCurveTo() {}
      closePath() {}
    }
    (globalThis as { Path2D?: unknown }).Path2D = FakePath2D;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  return { contexts };
}

/** jsdom reports every element as 0x0; give the stage a real box so fit and culling mean something. */
export function stubElementBox(width: number, height: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: height });
}
