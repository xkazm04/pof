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

/**
 * The preview claims "exactly as UE5 does". ARPGHUDWidget.cpp NativeTick (UE project
 * Source/PoF/UI/ARPGHUDWidget.cpp:178-183) pulses between LowHealthColor * 0.35 and
 * LowHealthColor - a dim-to-bright red - not between LowHealthColor and HealthBarColor.
 */
describe('useLowHealthPulse colour matches ARPGHUDWidget.cpp', () => {
  it('at alpha 0.5 the bar is halfway between dim and bright LowHealthColor', () => {
    const { result } = renderHook(() => useLowHealthPulse());
    expect(result.current.alpha).toBeCloseTo(0.5, 5); // pulseTime 0 -> sin 0
    // (0.9*0.35 + 0.9)/2 = 0.6075 -> 155 ; (0.1*0.35 + 0.1)/2 = 0.0675 -> 17
    expect(result.current.currentCSS).toBe('rgb(155,17,17)');
  });

  it('never shows the healthy green while pulsing, at any phase', () => {
    const { result } = renderHook(() => useLowHealthPulse());
    let t = 1000;
    frame(t);
    const greenish: string[] = [];
    for (let i = 0; i < 20; i++) {
      frame((t += 25));
      const [r, g] = result.current.currentCSS.match(/\d+/g)!.map(Number);
      if (g > r) greenish.push(result.current.currentCSS);
    }
    expect(greenish).toEqual([]);
  });
});

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
