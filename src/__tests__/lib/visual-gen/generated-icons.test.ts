import { describe, it, expect } from 'vitest';
import {
  buildIconList,
  iconSlug,
  iconsForStep,
  safeIconName,
  slugOfIconFile,
} from '@/lib/visual-gen/generated-icons';

/**
 * The generated per-step 2D art in `generated/icons/` is named by
 * `scripts/gap-loop/batch-generate.mjs` as `` `${catalogId}__${step}`.replace(/[^a-z0-9]+/gi,'_') ``.
 * These are REAL filenames from that library — matching must be by re-encoding the step,
 * never by guessing where the catalog id ends inside the filename.
 */
describe('iconSlug / slugOfIconFile', () => {
  it('matches real generated filenames back to the step they were generated for', () => {
    const cases: [string, string, string][] = [
      ['achievements', 'Icon 2D Art', 'achievements_Icon_2D_Art.jpg'],
      // hyphenated catalog id — the underscore run is genuinely ambiguous to split
      ['character-pipeline', 'Icon 2D Art', 'character_pipeline_Icon_2D_Art.jpg'],
      ['characters', 'Icon 2D Art (portrait)', 'characters_Icon_2D_Art_portrait_.jpg'],
      ['tutorial-beats', 'Pointer / Highlight 2D', 'tutorial_beats_Pointer_Highlight_2D.jpg'],
      ['vfx', 'Mesh / Sprite', 'vfx_Mesh_Sprite.jpg'],
      ['zone-map', '3D / Biome', 'zone_map_3D_Biome.jpg'],
    ];
    for (const [catalogId, step, file] of cases) {
      expect(slugOfIconFile(file)).toBe(iconSlug(catalogId, step));
    }
  });

  it('does not match a different step of the same catalog', () => {
    expect(slugOfIconFile('vfx_Material.jpg')).not.toBe(iconSlug('vfx', 'Icon 2D Art'));
    expect(slugOfIconFile('hud_elements_Wireframe.jpg')).not.toBe(iconSlug('hud-elements', 'Icon 2D Art'));
  });

  it('leaves entity-scoped ad-hoc files unmatched rather than guessing a step', () => {
    // power-icon.mjs writes `${catalogId}__${entityId}__t${i}.jpg` — no step in the name.
    expect(slugOfIconFile('items__item-1__t0.jpg')).toBe('items_item_1_t0');
    expect(iconsForStep(buildIconList([{ name: 'items__item-1__t0.jpg', mtimeMs: 1 }]), 'items', 'Art')).toEqual([]);
  });
});

describe('safeIconName', () => {
  it('accepts plain image basenames only', () => {
    expect(safeIconName('vfx_Icon_2D_Art.jpg')).toBe('vfx_Icon_2D_Art.jpg');
    expect(safeIconName('a.png')).toBe('a.png');
    expect(safeIconName('a.webp')).toBe('a.webp');
  });

  it('refuses traversal, nested paths and non-image extensions', () => {
    for (const bad of [
      '../../.env', '..\\secret.jpg', 'sub/dir.jpg', 'sub\\dir.jpg', '/etc/passwd',
      'a.glb', 'a.js', 'a.jpg.exe', '.hidden.jpg', '', 'no-extension',
    ]) {
      expect(safeIconName(bad)).toBeNull();
    }
  });
});

describe('buildIconList / iconsForStep', () => {
  const files = [
    { name: 'vfx_Icon_2D_Art.jpg', mtimeMs: 10 },
    { name: 'vfx_Material.jpg', mtimeMs: 30 },
    { name: 'notes.txt', mtimeMs: 40 },
  ];

  it('serves each icon under the whitelisted icon route, newest first, dropping non-images', () => {
    const list = buildIconList(files);
    expect(list.map((i) => i.name)).toEqual(['vfx_Material.jpg', 'vfx_Icon_2D_Art.jpg']);
    expect(list[0].url).toBe('/api/visual-gen/icon/vfx_Material.jpg');
  });

  it('returns only the art generated FOR the requested step', () => {
    const list = buildIconList(files);
    expect(iconsForStep(list, 'vfx', 'Icon 2D Art').map((i) => i.name)).toEqual(['vfx_Icon_2D_Art.jpg']);
    expect(iconsForStep(list, 'vfx', 'Variants')).toEqual([]);
  });
});
