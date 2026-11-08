import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useLowHealthPulse } from '@/components/modules/content/ui-hud/LowHealthPulse/useLowHealthPulse';

let queue: FrameRequestCallback[] = [];
function frame(ts: number) {
  const run = queue;
  queue = [];
  act(() => { for (const cb of run) cb(ts); });
}

beforeEach(() => {
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useLowHealthPulse reset', () => {
  it('Reset restarts the pulse at phase 0, not where it was', () => {
    const { result } = renderHook(() => useLowHealthPulse());
    let t = 1000;
    frame(t);
    for (let i = 0; i < 6; i++) frame((t += 50)); // 0.3 s at 2 Hz -> phase 0.6
    expect(result.current.cyclePhase).toBeCloseTo(0.6, 2);

    act(() => result.current.handleReset());
    frame((t += 16));
    // one 16 ms frame after reset at 2 Hz -> phase 0.032
    expect(result.current.cyclePhase).toBeLessThan(0.05);
  });
});
