import { useEffect, type RefObject } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useDamageNumberPhysicsSimulator } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/useDamageNumberPhysicsSimulator';

/** The sandbox canvas is 100% wide; mob layout must follow its measured width, not a fixed 520. */

type Sim = ReturnType<typeof useDamageNumberPhysicsSimulator>;
let observerCb: ResizeObserverCallback | null = null;
const holder: { sim: Sim | null } = { sim: null };
const cur = () => holder.sim as Sim;

function Canvas({ canvasRef }: { canvasRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={canvasRef} />;
}

function Harness() {
  const s = useDamageNumberPhysicsSimulator();
  useEffect(() => { holder.sim = s; });
  return <Canvas canvasRef={s.canvasRef} />;
}

beforeEach(() => {
  observerCb = null;
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: ResizeObserverCallback) { observerCb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function reportWidth(width: number) {
  act(() => {
    observerCb?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  });
}

describe('damage number sandbox canvas width', () => {
  it('centres a single mob at half of the reported canvas width', () => {
    render(<Harness />);
    reportWidth(900);
    expect(cur().mobMarkers[0].x).toBe(450);
  });

  it('spreads three mobs across the measured width', () => {
    render(<Harness />);
    act(() => cur().updateCombat({ mobCount: 3 }));
    reportWidth(800);
    expect(cur().mobMarkers.map(m => m.x)).toEqual([200, 400, 600]);
  });
});
