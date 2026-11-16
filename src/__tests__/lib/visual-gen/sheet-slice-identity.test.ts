import { describe, it, expect, vi } from 'vitest';
import { runContactSheet, type SheetRunDeps } from '@/lib/visual-gen/sheet-slice';

const deps = (): SheetRunDeps => ({
  generate: vi.fn(async () => ({ ok: true, path: '/tmp/s.png', url: '/s.png' })),
  image: {
    dimensions: vi.fn(async () => ({ width: 100, height: 100 })),
    stats: vi.fn(async () => ({ cellStdev: [20, 20], seams: [1], interior: 2 })),
    cut: vi.fn(async () => {}),
  },
  commit: vi.fn(async (n: string, w: (p: string) => Promise<void>) => { await w(n); }),
});
const run = (a: string, b: string, d: SheetRunDeps) =>
  runContactSheet({
    catalogId: 'bestiary', step: 'Icon',
    spec: { cols: 2, rows: 1, cellSubject: 'icon', style: 's', background: 'b', cast: [{ id: a, brief: 'x' }, { id: b, brief: 'y' }] },
  }, d);

describe('runContactSheet refuses a cast whose cells cannot each have their own file', () => {
  for (const [label, a, b] of [
    ['the same id twice', 'imp', 'imp'],
    ['ids that normalize alike', 'Fire Imp', 'fire-imp'],
    ['two non-latin ids', '炎', '氷'],
  ] as const) {
    it(`${label}: refused before the provider is paid`, async () => {
      const d = deps();
      const r = await run(a, b, d);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.refused).toBe(true);
      expect(r.error).toContain(a);
      expect(d.generate).not.toHaveBeenCalled();
    });
  }
  it('a single id with nothing addressable in it is refused too', async () => {
    const d = deps();
    const r = await run('***', 'imp', d);
    expect(r.ok).toBe(false);
    expect(d.generate).not.toHaveBeenCalled();
  });
  it('distinct ids still run', async () => {
    const d = deps();
    expect((await run('imp', 'orc', d)).ok).toBe(true);
    expect(d.commit).toHaveBeenCalledTimes(2);
  });
});
