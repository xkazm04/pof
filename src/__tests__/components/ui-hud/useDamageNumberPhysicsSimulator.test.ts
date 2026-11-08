import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDamageNumberPhysicsSimulator } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/useDamageNumberPhysicsSimulator';

/**
 * The simulator is a live tuning sandbox: a slider moved while it runs must reach the
 * running loop on the next frame, not only after Pause and Play.
 */

let queue: FrameRequestCallback[] = [];

function frame(ts: number) {
  const run = queue;
  queue = [];
  act(() => { for (const cb of run) cb(ts); });
}

beforeEach(() => {
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useDamageNumberPhysicsSimulator live tuning', () => {
  it('a mob count changed mid-run spawns from every mob on the following frames', () => {
    const { result } = renderHook(() => useDamageNumberPhysicsSimulator());
    act(() => result.current.updateCombat({ mobCount: 1, attacksPerSecond: 10 }));
    act(() => result.current.toggleRunning());

    let t = 1000;
    frame(t);
    for (let i = 0; i < 10; i++) frame((t += 50));
    const before = result.current.totalSpawned;

    act(() => result.current.updateCombat({ mobCount: 4 }));
    for (let i = 0; i < 10; i++) frame((t += 50));
    const spawnedAfterEdit = result.current.totalSpawned - before;

    // 10 frames x 50 ms at 10 attacks/s = 5 attack waves; 4 mobs -> 20 numbers
    expect(spawnedAfterEdit).toBe(20);
  });
});
