// Arena V truth set: pof's input-gate criteria, labelled by eye (2026-09-22, by eye; the zombie concept later moved to EXCLUDED for a dark gradient backdrop, to match criterion 2).
// Only unambiguous cases are scored; ambiguous ones are listed so a reviewer can see what was left out.
// expect: 'pass' = a good image->3D input; 'fail' = violates at least one criterion unambiguously.
const G = 'generated/'; // relative to the pof root
const I = G + 'icons/';
export const CASES = [
  // --- true PASS: single full subject, plain background, near-canonical pose, in frame
  [G + 'jinx-leo/jinx_gptimg2.png', 'pass', 'full body A-pose, plain light backdrop'],
  [G + 'jinx-leo/jinx_hd_concept.png', 'pass', 'full body A-pose, white backdrop'],
  [G + 'jinx-leo/jinx_v2_friendly.png', 'pass', 'full body A-pose, white backdrop'],
  [G + 'saber/saber_hilt.png', 'pass', 'single object, white backdrop, fully in frame'],
  [G + 'saber/saber_hilt.preview.png', 'pass', 'single object, white backdrop, fully in frame'],
  [I + 'props__prop_reinforced_crate__icon_2d_art.jpg', 'pass', 'single object, plain grey backdrop, fully in frame'],
  // --- hard FAIL: a full subject but a real criterion broken
  [I + '_unaddressable/bestiary_grunt_hero.jpg', 'fail', 'shield covers half the torso, weapon across body: occlusion'],
  [I + 'bestiary_Concept_2D_Art.jpg', 'fail', 'shield occludes torso, combat stance, signature mark'],
  [I + 'characters_Material_Outfit.jpg', 'fail', 'two subjects (front and back views) in one image'],
  [G + 'images/qwen-image_1788892296725.png', 'fail', 'sixteen subjects in a grid'],
  [I + 'crafting_recipes_Icon_2D_Art.jpg', 'fail', 'several objects plus leaves: not one subject'],
  [I + 'loot_tables_Icon_2D_Art.jpg', 'fail', 'several overlapping objects'],
  [I + 'character_pipeline_Icon_2D_Art.jpg', 'fail', 'bust in a badge frame, cropped, two pistols'],
  // --- cropped portraits (criterion 4: not fully in frame)
  ...['bounty_hunter', 'brute', 'elite_knight', 'gamorrean_guard', 'hssiss', 'kath_hound', 'kinrath', 'melee_grunt',
      'rakghoul', 'ranged_caster', 'sith_officer', 'terentatek', 'trandoshan_slaver', 'war_droid', 'wookiee_berserker', 'zhug_assassin']
    .map((n) => [I + `bestiary__bestiary_${n}__icon_2d_art.png`, 'fail', 'portrait cropped at chest/waist: subject not fully in frame']),
  [I + 'character_pipeline_face_gate_2d.jpg', 'fail', 'face crop'],
  [I + 'characters_Icon_2D_Art_portrait_.jpg', 'fail', 'bust portrait, cropped'],
  // --- not an object concept at all (scene, map, texture, VFX, UI)
  [I + 'codex_Illustration.jpg', 'fail', 'landscape scene, no subject'],
  [I + 'combat_map_3D_Terrain.jpg', 'fail', 'top-down map'],
  [I + 'combat_map_Icon_2D_Art.jpg', 'fail', 'top-down map icon'],
  [I + 'zone_map_3D_Biome.jpg', 'fail', 'world map'],
  [I + 'materials_Maps.jpg', 'fail', 'tiling stone texture'],
  [I + 'vfx_Material.jpg', 'fail', 'particle burst, no solid subject'],
  [I + 'vfx_Mesh_Sprite.jpg', 'fail', 'particle burst, no solid subject'],
  [I + 'vfx_Variants.jpg', 'fail', 'scattered particles'],
  [I + 'hud_elements_Wireframe.jpg', 'fail', 'UI wireframe'],
  [I + 'input_schemes_Input_Glyphs.jpg', 'fail', 'grid of glyphs'],
  [I + 'progression_curves_Icon_2D_Art.jpg', 'fail', 'chart icon'],
  [I + 'screen_flow_Icon_2D_Art.jpg', 'fail', 'framed silhouette UI icon'],
  [I + 'tutorial_beats_Pointer_Highlight_2D.jpg', 'fail', 'UI highlight ring over a silhouette'],
  [I + 'tutorial_beats_Icon_2D_Art.jpg', 'fail', 'UI arrows around a silhouette'],
  [I + 'save_points_Icon_2D_Art.jpg', 'fail', 'silhouette inside a fire scene'],
  [I + 'vfx_Icon_2D_Art.jpg', 'fail', 'silhouette inside a fire emblem'],
  [I + 'zone_map_Icon_2D_Art.jpg', 'fail', 'framed landscape emblem'],
  [I + 'achievements_Icon_2D_Art.jpg', 'fail', 'emblem with frame'],
  [I + 'ambient_Icon_2D_Art.jpg', 'fail', 'flat UI glyph'],
  [I + 'cutscenes_Icon_2D_Art.jpg', 'fail', 'flat UI glyph in a ring'],
  [I + 'dialog_trees_Icon_2D_Art.jpg', 'fail', 'UI glyph'],
  [I + 'music_Icon_2D_Art.jpg', 'fail', 'glyph in a frame'],
  [I + 'state_graph_Icon_2D_Art.jpg', 'fail', 'abstract UI glyph'],
  [I + 'status_effects_Icon_2D_Art.jpg', 'fail', 'emblem glyph'],
  [I + 'quests_Icon_2D_Art.jpg', 'fail', 'star emblem'],
  [I + 'factions_Heraldry_Icon.jpg', 'fail', 'ring emblem'],
  [I + 'icon_sets_Icon_2D_Art.jpg', 'fail', 'abstract emblem'],
  [I + 'vendors_Icon_2D_Art.jpg', 'fail', 'scales inside a badge frame'],
  [I + 'spellbook_Icon_2D_Art.jpg', 'fail', 'fire streak with flames'],
].map(([file, expect, why]) => ({ file, expect, why }));

export const EXCLUDED_AMBIGUOUS = [
  'bestiary__d1_mt_nzombie__concept_2d_art.jpg (A-pose, but on a dark gradient: fails criterion 2 as literally as the emblems do)',
  'characters_Concept_2D_Art.jpg (full body, arms down but sword and cape against the legs)',
  'character_pipeline_Concept_2D.jpg (T-pose with pistols and a long coat)',
  'items_icon_2d_art.jpg (blade tip touches the frame edge)', 'items__item_1__icon_2d_art.jpg (flat stylized)',
  'props_Icon_2D_Art.jpg (stylized)', 'currencies_Icon_2D_Art.jpg', 'hud_elements_Icon_2D_Art.jpg', 'materials_Icon_2D_Art.jpg',
  'view-gate chair renders x3 (mesh renders at odd angles)',
];
