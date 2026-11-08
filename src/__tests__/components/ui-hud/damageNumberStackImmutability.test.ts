import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDamageNumberPhysicsSimulator } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/useDamageNumberPhysicsSimulator';

/**
 * Stacking (accumulate / merge) must replace the stacked particle, not edit the object the
 * previous render already holds in `particles`.
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

describe.each(['accumulate', 'merge'] as const)('%s stacking on committed particles', (stackMode) => {
  it('leaves the previously committed particle untouched and shows the stack on a new object', () => {
    const { result } = renderHook(() => useDamageNumberPhysicsSimulator());
    act(() => result.current.updateCombat({
      mobCount: 1, attacksPerSecond: 20, critRate: 0, healPercent: 0,
      elementWeights: { physical: 1, fire: 0, ice: 0, lightning: 0, heal: 0 },
    }));
    act(() => result.current.updatePhysics({ stackMode, stackWindowMs: 500 }));
    act(() => result.current.toggleRunning());

    frame(1000);
    frame(1050);
    const committed = result.current.particles;
    expect(committed).toHaveLength(1);
    const amountBefore = committed[0].amount;
    committed.forEach(p => Object.freeze(p));

    // second wave stacks onto the frozen particle
    expect(() => frame(1100)).not.toThrow();

    expect(committed[0].stackCount).toBe(1);
    expect(committed[0].amount).toBe(amountBefore);
    const next = result.current.particles;
    expect(next).toHaveLength(1);
    expect(next[0].stackCount).toBe(2);
    expect(next[0]).not.toBe(committed[0]);
  });
});
