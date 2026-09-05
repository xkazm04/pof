import { describe, it, expect } from 'vitest';
import {
  buildIconList,
  iconFileBase,
  iconSlug,
  iconsFor,
  iconsForStep,
  parseIconFileName,
  resolveIconFor,
  safeIconName,
  slugOfIconFile,
} from '@/lib/visual-gen/generated-icons';

/**
 * The generated-icon library was keyed `(catalogId, step)` with NO entity dimension, so art
 * generated FOR ONE ENTITY was structurally unaddressable — which is exactly why
 * `power-icon.mjs` invented `catalog__entity__hero` names and why three real, gated images
 * sit preserved in `generated/icons/_unaddressable/`.
 *
 * The identity of an icon is `(catalog, entity, step)` — never a display slug — and the
 * absence of entity art is a DECLARED state (`scope: 'step'`), never a silent exemption.
 */

/** Today's library, gathered read-only from `generated/icons/` (2026-09-05). */
const LIBRARY_TODAY = [
  'achievements_Icon_2D_Art.jpg', 'ambient_Icon_2D_Art.jpg', 'bestiary_Concept_2D_Art.jpg',
  'character_pipeline_Concept_2D.jpg', 'character_pipeline_Icon_2D_Art.jpg',
  'character_pipeline_face_gate_2d.jpg', 'characters_Concept_2D_Art.jpg',
  'characters_Icon_2D_Art_portrait_.jpg', 'characters_Material_Outfit.jpg',
  'codex_Illustration.jpg', 'combat_map_3D_Terrain.jpg', 'combat_map_Icon_2D_Art.jpg',
  'crafting_recipes_Icon_2D_Art.jpg', 'currencies_Icon_2D_Art.jpg', 'cutscenes_Icon_2D_Art.jpg',
  'dialog_trees_Icon_2D_Art.jpg', 'factions_Heraldry_Icon.jpg', 'hud_elements_Icon_2D_Art.jpg',
  'hud_elements_Wireframe.jpg', 'icon_sets_Icon_2D_Art.jpg', 'input_schemes_Input_Glyphs.jpg',
  'items_icon_2d_art.jpg', 'loot_tables_Icon_2D_Art.jpg', 'materials_Icon_2D_Art.jpg',
  'materials_Maps.jpg', 'music_Icon_2D_Art.jpg', 'progression_curves_Icon_2D_Art.jpg',
  'props_Icon_2D_Art.jpg', 'quests_Icon_2D_Art.jpg', 'save_points_Icon_2D_Art.jpg',
  'screen_flow_Icon_2D_Art.jpg', 'spellbook_Icon_2D_Art.jpg', 'state_graph_Icon_2D_Art.jpg',
  'status_effects_Icon_2D_Art.jpg', 'tutorial_beats_Icon_2D_Art.jpg',
  'tutorial_beats_Pointer_Highlight_2D.jpg', 'vendors_Icon_2D_Art.jpg', 'vfx_Icon_2D_Art.jpg',
  'vfx_Material.jpg',
];

/** The rename plan for `generated/icons/_unaddressable/` — computed, never hand-written. */
const RENAME_PLAN: { from: string; catalogId: string; entityId: string; step: string }[] = [
  { from: 'items__item-1__t0.jpg', catalogId: 'items', entityId: 'item-1', step: 'Icon 2D Art' },
  { from: 'props__crate__hero.jpg', catalogId: 'props', entityId: 'prop-reinforced-crate', step: 'Icon 2D Art' },
];

describe('iconSlug — the entity dimension', () => {
  it('keeps the legacy two-argument slug byte-identical', () => {
    expect(iconSlug('achievements', 'Icon 2D Art')).toBe(slugOfIconFile('achievements_Icon_2D_Art.jpg'));
    expect(iconSlug('items', 'Icon 2D Art')).toBe('items_icon_2d_art');
  });

  it('adds an entity dimension that a per-entity filename round-trips', () => {
    const slug = iconSlug('items', 'Icon 2D Art', 'item-1');
    expect(slug).not.toBe(iconSlug('items', 'Icon 2D Art'));
    expect(slugOfIconFile(iconFileBase('items', 'Icon 2D Art', 'item-1') + '.jpg')).toBe(slug);
  });

  it('names a per-step file exactly as the generator always has', () => {
    expect(iconFileBase('items', 'Icon 2D Art')).toBe('items_icon_2d_art');
  });
});

describe('parseIconFileName — both shapes, structurally', () => {
  it('resolves a per-entity file to {catalogId, entityId, step}', () => {
    const id = parseIconFileName('items__item-1__t0.jpg');
    expect(id.scope).toBe('entity');
    expect(id.catalogId).toBe('items');
    expect(id.entityId).toBe('item_1');
    expect(id.step).toBe('t0');
  });

  it('declares a legacy per-step file as step-scoped and does NOT guess its split', () => {
    for (const name of LIBRARY_TODAY) {
      const id = parseIconFileName(name);
      expect(id.scope).toBe('step');
      expect(id.entityId).toBeUndefined();
      // the flat slug is the ONLY identity a legacy name carries — unchanged from today
      expect(id.slug).toBe(slugOfIconFile(name));
    }
  });
});

describe('resolution precedence — entity art wins, step art is the fallback', () => {
  const icons = buildIconList([
    { name: 'items_icon_2d_art.jpg', mtimeMs: 10 },
    { name: `${iconFileBase('items', 'Icon 2D Art', 'item-1')}.jpg`, mtimeMs: 20 },
  ]);

  it('serves the entity icon to the entity that owns it, and says which scope served', () => {
    const hit = resolveIconFor(icons, 'items', 'Icon 2D Art', 'item-1');
    expect(hit?.scope).toBe('entity');
    expect(hit?.name).toBe('items__item_1__icon_2d_art.jpg');
  });

  it('falls back to the step icon for an entity with no art of its own', () => {
    const hit = resolveIconFor(icons, 'items', 'Icon 2D Art', 'item-9');
    expect(hit?.scope).toBe('step');
    expect(hit?.name).toBe('items_icon_2d_art.jpg');
  });

  it('never lets one entity\'s art answer a bare step query', () => {
    expect(iconsForStep(icons, 'items', 'Icon 2D Art').map((i) => i.name)).toEqual(['items_icon_2d_art.jpg']);
    expect(iconsFor(icons, 'items', 'Icon 2D Art').map((i) => i.name)).toEqual(['items_icon_2d_art.jpg']);
  });

  it('reports no art as a resolvable absence, not a throw', () => {
    expect(resolveIconFor(icons, 'items', 'Nowhere', 'item-1')).toBeNull();
  });
});

describe('the _unaddressable rename plan', () => {
  it('computes a served, addressable name for each renameable orphan', () => {
    for (const p of RENAME_PLAN) {
      const to = `${iconFileBase(p.catalogId, p.step, p.entityId)}.jpg`;
      expect(safeIconName(to)).toBe(to); // servable by /api/visual-gen/icon/<name>
      const icons = buildIconList([{ name: to, mtimeMs: 1 }]);
      expect(resolveIconFor(icons, p.catalogId, p.step, p.entityId)?.scope).toBe('entity');
    }
  });

  it('collides with nothing in today\'s library', () => {
    const existing = new Set(LIBRARY_TODAY);
    const existingSlugs = new Set(LIBRARY_TODAY.map(slugOfIconFile));
    for (const p of RENAME_PLAN) {
      const to = `${iconFileBase(p.catalogId, p.step, p.entityId)}.jpg`;
      expect(existing.has(to)).toBe(false);
      expect(existingSlugs.has(slugOfIconFile(to))).toBe(false);
    }
  });
});
