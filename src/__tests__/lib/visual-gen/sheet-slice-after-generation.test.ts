import { describe, it, expect, vi } from 'vitest';
import { runContactSheet, type SheetRunDeps } from '@/lib/visual-gen/sheet-slice';

const deps = (over: Partial<SheetRunDeps> = {}): SheetRunDeps => ({
  generate: vi.fn(async () => ({ ok: true, path: '/tmp/s.png', url: '/s.png' })),
  image: {
    dimensions: vi.fn(async () => ({ width: 100, height: 100 })),
    stats: vi.fn(async () => ({ cellStdev: [20, 20], seams: [1], interior: 2 })),
    cut: vi.fn(async () => {}),
  },
  commit: vi.fn(async (n: string, w: (p: string) => Promise<void>) => { await w(n); }),
  ...over,
});
const run = (d: SheetRunDeps) =>
  runContactSheet({
    catalogId: 'c', step: 'Icon',
    spec: { cols: 2, rows: 1, cellSubject: 'icon', style: 's', background: 'b', cast: [{ id: 'a', brief: 'x' }, { id: 'b', brief: 'y' }] },
  }, d);

describe('a failure after the generation was paid for keeps the sheet', () => {
  it('measuring throws: the sheet url comes back with the reason', async () => {
    const base = deps();
    const d = deps({ image: { ...base.image, stats: vi.fn(async () => { throw new Error('sharp died'); }) } });
    const r = await run(d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.sheetUrl).toBe('/s.png');
    expect(r.error).toContain('sharp died');
  });
  it('a cut throws midway: the sheet url, the verdict and the count come back', async () => {
    let n = 0;
    const d = deps({
      commit: vi.fn(async () => { if (++n === 2) throw new Error('disk full'); }),
    });
    const r = await run(d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.sheetUrl).toBe('/s.png');
    expect(r.verdict?.sliceable).toBe(true);
    expect(r.error).toContain('disk full');
    expect(r.error).toContain('1 of 2');
  });
});
