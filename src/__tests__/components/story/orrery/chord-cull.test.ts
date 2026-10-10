import { describe, it, expect } from 'vitest';
import { chordControl, chordTouchesRect, type WorldRect } from '@/components/story/orrery/render/geometry';

/** Ink test by sampling: does any point of the stroked curve land in the rect? */
function sampledTouch(x1: number, y1: number, x2: number, y2: number, pad: number, r: WorldRect): boolean {
  const c = chordControl(x1, y1, x2, y2);
  for (let s = 0; s <= 512; s++) {
    const t = s / 512;
    const u = 1 - t;
    const x = u * u * x1 + 2 * u * t * c.cx + t * t * x2;
    const y = u * u * y1 + 2 * u * t * c.cy + t * t * y2;
    if (x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad) return true;
  }
  return false;
}

const polar = (r: number, deg: number) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: r * Math.sin((deg * Math.PI) / 180) });

describe('chords are culled on the curve, not on their ends', () => {
  it('keeps a chord that crosses the rect while both ends sit off one side of it', () => {
    // Two ends on the left of a window near the centre; the chord dives through the window.
    const a = polar(400, 100);
    const b = polar(400, 260);
    const rect = { x0: -45, x1: 45, y0: -20, y1: 20 };
    expect(a.x < rect.x0 && b.x < rect.x0).toBe(true);
    expect(sampledTouch(a.x, a.y, b.x, b.y, 0, rect)).toBe(true);
    const c = chordControl(a.x, a.y, b.x, b.y);
    expect(chordTouchesRect(a.x, a.y, c.cx, c.cy, b.x, b.y, 0, rect)).toBe(true);
  });

  it('rejects a chord whose curve stays clear of the rect', () => {
    const a = polar(400, 10);
    const b = polar(400, 50);
    const rect = { x0: -500, x1: -300, y0: -100, y1: 100 };
    const c = chordControl(a.x, a.y, b.x, b.y);
    expect(chordTouchesRect(a.x, a.y, c.cx, c.cy, b.x, b.y, 1, rect)).toBe(false);
  });

  it('never culls a chord that inks the rect, over 20,000 random chords and windows', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let inked = 0;
    let kept = 0;
    let hullKept = 0;
    for (let k = 0; k < 20000; k++) {
      const a = polar(130 + rnd() * 500, rnd() * 360);
      const b = polar(130 + rnd() * 500, rnd() * 360);
      const cx = (rnd() - 0.5) * 1200;
      const cy = (rnd() - 0.5) * 1200;
      const hw = 10 + rnd() * 200;
      const hh = 10 + rnd() * 120;
      const rect = { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
      const pad = rnd() * 3;
      const c = chordControl(a.x, a.y, b.x, b.y);
      const keep = chordTouchesRect(a.x, a.y, c.cx, c.cy, b.x, b.y, pad, rect);
      if (sampledTouch(a.x, a.y, b.x, b.y, pad, rect)) {
        inked++;
        expect(keep).toBe(true);
      }
      if (keep) kept++;
      const xs = [a.x, b.x, c.cx];
      const ys = [a.y, b.y, c.cy];
      if (
        !(Math.max(...xs) + pad < rect.x0 || Math.min(...xs) - pad > rect.x1 ||
          Math.max(...ys) + pad < rect.y0 || Math.min(...ys) - pad > rect.y1)
      ) {
        hullKept++;
      }
    }
    expect(inked).toBeGreaterThan(1000);
    // The curve's own box is tighter than the box of its control polygon, which is the easy bound.
    expect(kept).toBeLessThan(hullKept);
  });
});
