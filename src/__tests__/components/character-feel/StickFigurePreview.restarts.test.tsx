import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StickFigurePreview } from '@/components/modules/core-engine/sub_character/playground/StickFigurePreview';
import { decodeCurves, encodeCurves } from '@/lib/character/feel-curve-codec';
import { FEEL_PRESETS } from '@/lib/character-feel-optimizer';

const noop = () => {};
const ctxStub = new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub);
  vi.stubGlobal('requestAnimationFrame', () => 1);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* The loop's effect listed the whole `values` object, which PlaygroundTab re-memoises on every
 * store write — so dragging the camera curve (never read by the preview) tore down and restarted
 * the rAF loop on every pointermove. */
describe('StickFigurePreview — rAF loop restarts', () => {
  it('10 camera-curve edits (values re-created, preview inputs unchanged) cause 0 restarts', () => {
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const base = encodeCurves(FEEL_PRESETS[0].profile);
    const { rerender } = render(<StickFigurePreview values={decodeCurves(base)} isPlaying />);
    for (let i = 1; i <= 10; i++) {
      const camera = base.camera.map((p, k) => (k === 1 ? { ...p, y: 0.1 + i * 0.05 } : p));
      rerender(<StickFigurePreview values={decodeCurves({ ...base, camera })} isPlaying />);
    }
    expect(cancel).toHaveBeenCalledTimes(0);
  });

  it('an edit to a curve the preview reads (walk speed) still restarts the run', () => {
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const base = encodeCurves(FEEL_PRESETS[0].profile);
    const { rerender } = render(<StickFigurePreview values={decodeCurves(base)} isPlaying />);
    const accel = base.accel.map((p, k) => (k === 2 ? { ...p, y: Math.min(1, p.y + 0.2) } : p));
    rerender(<StickFigurePreview values={decodeCurves({ ...base, accel })} isPlaying />);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
