/**
 * GET /api/game-director?action=trend&limit=… — the health-trend sparkline read.
 *
 * Its sibling /api/feature-matrix/history already folds a non-numeric `limit` to the
 * default and clamps the rest to an integer range. The trend branch did
 * `Math.max(1, Math.min(200, Number(limitParam)))`: `Number('abc')` is NaN, Math.max/min
 * propagate it, and `LIMIT NaN` (or `LIMIT 2.5`) reached SQLite. Parity: a non-numeric
 * limit is the default (30), a fractional one is truncated, the range stays [1, 200].
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gd-trend-limit-${process.pid}.db`;
});

import { GET } from '@/app/api/game-director/route';

const get = (limit: string) =>
  GET(new Request(`http://localhost/api/game-director?action=trend&limit=${encodeURIComponent(limit)}`));

describe('game-director trend limit', () => {
  it.each(['abc', '2.5', '-4', '1e9', ''])('answers limit=%s with 200 and an array', async (limit) => {
    const res = await get(limit);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});
