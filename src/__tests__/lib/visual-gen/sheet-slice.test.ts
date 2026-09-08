import { describe, it, expect, vi } from 'vitest';
import { runContactSheet, type SheetRunDeps, type SheetRunRequest } from '@/lib/visual-gen/sheet-slice';
import type { ContactSheetSpec } from '@/lib/visual-gen/contact-sheet';

const IDS = ['bestiary-a', 'bestiary-b', 'bestiary-c', 'bestiary-d'];

const spec = (ids: string[] = IDS): ContactSheetSpec => ({
  cols: 2,
  rows: 2,
  cellSubject: 'enemy portrait',
  style: 'painterly dark fantasy',
  background: 'deep charcoal',
  cast: ids.map((id, i) => ({ id, brief: `brief ${i}` })),
});

const req = (over: Partial<SheetRunRequest> = {}): SheetRunRequest => ({
  spec: spec(),
  catalogId: 'bestiary',
  step: 'Icon 2D Art',
  ...over,
});

function deps(over: Partial<SheetRunDeps> = {}): SheetRunDeps {
  return {
    generate: vi.fn(async () => ({ ok: true, path: '/tmp/sheet.png', url: '/api/visual-gen/image/sheet.png', model: 'qwen-image-3.0-pro' })),
    image: {
      dimensions: vi.fn(async () => ({ width: 1328, height: 1328 })),
      // stdevs in the band the real sheet measured (10.66 - 33.6)
      stats: vi.fn(async () => ({ cellStdev: [20.8, 24.1, 25.8, 31.1], seams: [4.254], interior: 4.98 })),
      cut: vi.fn(async () => {}),
    },
    iconDir: '/repo/generated/icons',
    ...over,
  };
}

describe('runContactSheet', () => {
  it('cuts every cell under the entity-scoped icon name the library resolves', async () => {
    const d = deps();
    const r = await runContactSheet(req(), d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.icons.map((i) => i.file)).toEqual([
      'bestiary__bestiary_a__icon_2d_art.png',
      'bestiary__bestiary_b__icon_2d_art.png',
      'bestiary__bestiary_c__icon_2d_art.png',
      'bestiary__bestiary_d__icon_2d_art.png',
    ]);
    expect(d.image.cut).toHaveBeenCalledTimes(4);
    // cut from the DELIVERED size, not the requested one
    expect(vi.mocked(d.image.cut).mock.calls[3][1]).toMatchObject({ x: 664, y: 664, w: 664, h: 664 });
    expect(r.icons[0].url).toBe('/api/visual-gen/icon/bestiary__bestiary_a__icon_2d_art.png');
  });

  it('lays the grid on the DELIVERED dimensions when the provider ignored the request', async () => {
    const d = deps({
      image: { ...deps().image, dimensions: vi.fn(async () => ({ width: 1024, height: 1024 })) },
    });
    const r = await runContactSheet(req(), d);
    expect(r.ok).toBe(true);
    expect(vi.mocked(d.image.cut).mock.calls[0][1]).toMatchObject({ x: 0, y: 0, w: 512, h: 512 });
  });

  it('refuses before spending a generation when the cast does not fill the grid', async () => {
    const d = deps();
    const r = await runContactSheet(req({ spec: spec(['only-one']) }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refused).toBe(true);
    expect(r.error).toMatch(/needs 4 subjects, got 1/);
    expect(d.generate).not.toHaveBeenCalled();
  });

  it('keeps the generated sheet and cuts NOTHING when the grade says it is not sliceable', async () => {
    const d = deps({
      image: { ...deps().image, dimensions: vi.fn(async () => ({ width: 1, height: 1 })) },
    });
    const r = await runContactSheet(req(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.sheetUrl).toBe('/api/visual-gen/image/sheet.png');
    expect(r.verdict?.sliceable).toBe(false);
    expect(d.image.cut).not.toHaveBeenCalled();
    expect(r.error).toMatch(/generated but not cut/);
  });

  it('carries the provider’s own refusal instead of inventing one', async () => {
    const d = deps({ generate: vi.fn(async () => ({ ok: false, refused: true, error: 'QWEN_API_KEY is not set here' })) });
    const r = await runContactSheet(req(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('QWEN_API_KEY is not set here');
    expect(r.refused).toBe(true);
  });
});
