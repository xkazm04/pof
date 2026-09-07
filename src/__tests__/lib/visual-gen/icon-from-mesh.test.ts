import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HERO_YAW,
  ICON_VIEWS,
  pickHeroView,
  iconSidecarName,
  parseIconSidecar,
  renderIconFromMesh,
} from '@/lib/visual-gen/icon-from-mesh';
import type { MeshViewsResult, RenderedView } from '@/lib/visual-gen/mesh-views';

const view = (index: number, yawDeg: number): RenderedView => ({
  index,
  yawDeg,
  imagePath: `/views/v${index}.png`,
});

/** The yaws `pof_mesh_views.py` actually produces for N views: 360 * i / N. */
const yawsFor = (n: number): RenderedView[] =>
  Array.from({ length: n }, (_, i) => view(i, (360 * i) / n));

describe('pickHeroView', () => {
  it('picks the three-quarter view an item icon is conventionally drawn at', () => {
    const picked = pickHeroView(yawsFor(ICON_VIEWS), DEFAULT_HERO_YAW);
    expect(picked.view?.yawDeg).toBe(45);
  });

  it('the default view count actually CONTAINS the hero yaw', () => {
    // 360 * i / N must land exactly on 45, or the default icon is silently off-angle.
    expect(yawsFor(ICON_VIEWS).some((v) => v.yawDeg === DEFAULT_HERO_YAW)).toBe(true);
  });

  it('measures the yaw circularly, so 350 beats 120 for a hero yaw of 0', () => {
    expect(pickHeroView([view(0, 120), view(1, 350)], 0).view?.yawDeg).toBe(350);
  });

  it('falls back to the nearest available yaw and SAYS it is off-angle', () => {
    const picked = pickHeroView(yawsFor(4), 45); // 4 views = 0/90/180/270, no 45
    expect(picked.view?.yawDeg).toBe(0);
    expect(picked.exact).toBe(false);
    expect(picked.reason).toMatch(/45/);
  });

  it('reports an exact hit as exact', () => {
    expect(pickHeroView(yawsFor(8), 45).exact).toBe(true);
  });

  it('has no view — and says so — for an empty render', () => {
    const picked = pickHeroView([], 45);
    expect(picked.view).toBeUndefined();
    expect(picked.reason).toMatch(/no views/i);
  });
});

describe('the provenance sidecar', () => {
  it('is named off the icon it describes', () => {
    expect(iconSidecarName('crate_hero.png')).toBe('crate_hero.render.json');
  });

  it("is not an image, so the icon library's own allow-list ignores it", () => {
    // generated-icons' NAME_RE only admits jpg/jpeg/png/webp — a sidecar must never
    // surface as a second piece of art for the same step.
    expect(iconSidecarName('crate_hero.png')).not.toMatch(/\.(png|jpe?g|webp)$/i);
  });

  it('reads back the mesh the icon was rendered from', () => {
    const p = parseIconSidecar(JSON.stringify({ renderedFrom: '/gen/crate.glb', yawDeg: 45, at: 1 }));
    expect(p?.renderedFrom).toBe('/gen/crate.glb');
    expect(p?.yawDeg).toBe(45);
  });

  it('refuses malformed provenance rather than inventing it', () => {
    expect(parseIconSidecar('not json')).toBeNull();
    expect(parseIconSidecar(JSON.stringify({ yawDeg: 45 }))).toBeNull();
  });
});

describe('renderIconFromMesh', () => {
  const okRender = async (): Promise<MeshViewsResult> => ({ ok: true, views: yawsFor(8), durationMs: 5 });

  it('writes the icon under the name every consumer already matches on', async () => {
    const copied: Array<{ from: string; to: string }> = [];
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'loot-tables', step: 'Item icon', entityId: 'crate' },
      { render: okRender, copyFile: async (from, to) => { copied.push({ from, to }); }, writeFile: async () => {}, now: () => 7 },
    );
    expect(r.ok).toBe(true);
    // iconFileBase(catalogId, step, entityId) — the entity-scoped `__` form.
    expect(r.name).toBe('loot_tables__crate__item_icon.png');
    expect(copied[0].from).toBe('/views/v1.png'); // the yaw-45 view
    expect(copied[0].to).toMatch(/loot_tables__crate__item_icon\.png$/);
  });

  it('falls back to the per-step name when no entity was given', async () => {
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'loot-tables', step: 'Item icon' },
      { render: okRender, copyFile: async () => {}, writeFile: async () => {}, now: () => 7 },
    );
    expect(r.name).toBe('loot_tables_item_icon.png');
  });

  it('writes provenance beside the icon, naming the mesh and the yaw', async () => {
    const written: Array<{ path: string; body: string }> = [];
    await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      { render: okRender, copyFile: async () => {}, writeFile: async (path, body) => { written.push({ path, body }); }, now: () => 99 },
    );
    expect(written).toHaveLength(1);
    expect(written[0].path).toMatch(/\.render\.json$/);
    const body = JSON.parse(written[0].body);
    expect(body).toMatchObject({ renderedFrom: '/gen/crate.glb', yawDeg: 45, at: 99 });
  });

  it('asks for enough yaws to contain the hero angle', async () => {
    const seen: number[] = [];
    await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      {
        render: async (spec) => { seen.push(spec.views ?? -1); return okRender(); },
        copyFile: async () => {}, writeFile: async () => {}, now: () => 1,
      },
    );
    expect(seen[0]).toBe(ICON_VIEWS);
  });

  it('reports a failed render instead of writing an icon', async () => {
    let copied = false;
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      {
        render: async () => ({ ok: false, error: 'Blender not found', views: [] }),
        copyFile: async () => { copied = true; }, writeFile: async () => {}, now: () => 1,
      },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Blender not found/);
    expect(copied).toBe(false);
  });

  it('reports a render that produced no views rather than shipping a blank icon', async () => {
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      { render: async () => ({ ok: true, views: [], durationMs: 1 }), copyFile: async () => {}, writeFile: async () => {}, now: () => 1 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no views/i);
  });

  it('does not leave a provenance sidecar behind when the copy fails', async () => {
    // A sidecar without its icon is a claim about a file that does not exist.
    const written: string[] = [];
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      {
        render: okRender,
        copyFile: async () => { throw new Error('EACCES'); },
        writeFile: async (p) => { written.push(p); },
        now: () => 1,
      },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/EACCES/);
    expect(written).toEqual([]);
  });

  it('honours an explicit hero yaw', async () => {
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's', heroYaw: 180 },
      { render: okRender, copyFile: async () => {}, writeFile: async () => {}, now: () => 1 },
    );
    expect(r.yawDeg).toBe(180);
  });

  it('serves the icon on the same url the generated art uses', async () => {
    const r = await renderIconFromMesh(
      { meshPath: '/gen/crate.glb', catalogId: 'c', step: 's' },
      { render: okRender, copyFile: async () => {}, writeFile: async () => {}, now: () => 1 },
    );
    expect(r.url).toBe('/api/visual-gen/icon/c_s.png');
  });
});

describe('the icon library surfaces provenance', () => {
  it('marks an icon that has a sidecar as rendered from a mesh', async () => {
    const { buildIconList } = await import('@/lib/visual-gen/generated-icons');
    const [icon] = buildIconList([
      { name: 'c_s.png', mtimeMs: 1, renderedFrom: '/gen/crate.glb' },
    ]);
    expect(icon.renderedFrom).toBe('/gen/crate.glb');
  });

  it('leaves generated art with no provenance field at all', async () => {
    const { buildIconList } = await import('@/lib/visual-gen/generated-icons');
    const [icon] = buildIconList([{ name: 'c_s.png', mtimeMs: 1 }]);
    // Absent, never '' or 'generated' — an empty string would read as a known origin.
    expect('renderedFrom' in icon).toBe(false);
  });
});
