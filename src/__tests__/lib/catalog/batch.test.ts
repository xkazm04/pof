import { describe, it, expect, vi } from 'vitest';
import { runBatch } from '@/lib/catalog/batch';

describe('runBatch', () => {
  it('dispatches one entity at a time (never concurrent)', async () => {
    let active = 0; let maxActive = 0;
    const dispatch = vi.fn(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--; return { ok: true as const };
    });
    await runBatch(['a', 'b', 'c'], 'scaffold-cpp', dispatch);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it('reports per-entity results and continues past a failure', async () => {
    const dispatch = vi.fn(async (id: string) =>
      id === 'b' ? { ok: false as const, error: 'boom' } : { ok: true as const });
    const res = await runBatch(['a', 'b', 'c'], 'wire', dispatch);
    expect(res).toEqual([
      { entityId: 'a', ok: true },
      { entityId: 'b', ok: false, error: 'boom' },
      { entityId: 'c', ok: true },
    ]);
    expect(dispatch).toHaveBeenCalledTimes(3);
  });

  it('captures a thrown dispatch as a failure without aborting', async () => {
    const dispatch = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('threw');
      return { ok: true as const };
    });
    const res = await runBatch(['a', 'b', 'c'], 'verify', dispatch);
    expect(res[1]).toEqual({ entityId: 'b', ok: false, error: 'threw' });
    expect(res[2]).toEqual({ entityId: 'c', ok: true });
  });
});
