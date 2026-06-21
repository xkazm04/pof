import type { CatalogEntityBase } from './types';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { SubModuleId } from '@/types/modules';

interface StarterDef { id: string; name: string; categoryPath: string[]; tags: string[]; description: string }
export interface NewCatalogDef {
  catalogId: string;
  label: string;
  category: string;
  description: string;
  module: SubModuleId;
  tracks: PipelineTrackId[];
  starters: StarterDef[];
}

/**
 * The new catalog entities — 21 from game_catalog_pipelines.xlsx + `player-movement` (the
 * autonomously-built Mixamo→Manny locomotion pipeline, surfaced here so it's lab-visible
 * and walker-covered instead of orphaned). One source of truth: CATALOG_SECTIONS,
 * PIPELINE_BY_CATALOG and CATALOG_MODULE are all derived from this.
 */
export const NEW_CATALOGS: NewCatalogDef[] = [
  // ── Quests & Narrative ──
  { catalogId: 'quests', label: 'Quests', category: 'Quests & Narrative', description: 'Structured player objectives with stages, rewards, and narrative beats.', module: 'dialogue-quests', tracks: ['logic', 'audio', 'test'],
    starters: [{ id: 'quest-ember-pact', name: 'The Ember Pact', categoryPath: ['Main'], tags: ['intro'], description: 'A 3-stage introductory fetch-and-choice quest.' }] },
  { catalogId: 'dialog-trees', label: 'Dialog Trees', category: 'Quests & Narrative', description: 'Branching conversations with conditions, effects, and voice.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'dialog-gatekeeper', name: 'Gatekeeper Greeting', categoryPath: ['NPC'], tags: ['intro'], description: 'A simple gate-NPC conversation with a skill check.' }] },
  { catalogId: 'cutscenes', label: 'Cutscenes', category: 'Quests & Narrative', description: 'Scripted in-engine sequences for story moments.', module: 'dialogue-quests', tracks: ['animation', 'audio', 'vfx', 'test'],
    starters: [{ id: 'cutscene-prologue', name: 'Prologue: The Fall', categoryPath: ['Story'], tags: ['intro'], description: 'The opening in-engine cinematic.' }] },
  { catalogId: 'codex', label: 'Codex', category: 'Quests & Narrative', description: 'In-game encyclopedia entries unlocked by play.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'test'],
    starters: [{ id: 'codex-sundering', name: 'The Sundering', categoryPath: ['Lore'], tags: ['history'], description: "A foundational lore entry on the world's cataclysm." }] },
  { catalogId: 'factions', label: 'Factions', category: 'Quests & Narrative', description: 'Group affiliations with standings, rewards, and consequences.', module: 'dialogue-quests', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'faction-ashen-order', name: 'The Ashen Order', categoryPath: ['Faction'], tags: [], description: 'A militant order with a reputation ladder.' }] },
  // ── Game Assets ──
  { catalogId: 'characters', label: 'Characters', category: 'Game Assets', description: 'Playable or named NPCs with full presentation and behavior.', module: 'arpg-character', tracks: ['logic', 'art-3d', 'animation', 'audio', 'vfx', 'test'],
    starters: [{ id: 'char-captain-vael', name: 'Captain Vael', categoryPath: ['NPC'], tags: ['named'], description: 'A named quest-giver NPC.' }] },
  { catalogId: 'props', label: 'Props', category: 'Game Assets', description: 'Static or interactable world objects.', module: 'models', tracks: ['art-3d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'prop-reinforced-crate', name: 'Reinforced Crate', categoryPath: ['Interactable'], tags: ['destructible'], description: 'A destructible loot container.' }] },
  { catalogId: 'status-effects', label: 'Status Effects', category: 'Game Assets', description: 'Temporary or persistent modifiers applied to an actor.', module: 'arpg-gas', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [
      { id: 'status-burning', name: 'Burning', categoryPath: ['Debuff'], tags: ['fire', 'dot'], description: 'Fire damage-over-time; pairs with Fireball (State.Burning).' },
      { id: 'status-chilled', name: 'Chilled', categoryPath: ['Debuff'], tags: ['ice', 'slow'], description: 'Movement-speed slow from ice damage.' }] },
  // ── Systems ──
  { catalogId: 'crafting-recipes', label: 'Crafting Recipes', category: 'Systems', description: 'Combine inputs into output items with conditions.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'recipe-health-potion', name: 'Health Potion', categoryPath: ['Alchemy'], tags: ['consumable'], description: 'Combine herb + vial into a healing potion.' }] },
  { catalogId: 'vendors', label: 'Vendors', category: 'Systems', description: 'NPC merchants with inventory, pricing, and restock rules.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'audio', 'test'],
    starters: [{ id: 'vendor-wandering-merchant', name: 'Wandering Merchant', categoryPath: ['Shop'], tags: [], description: 'A roaming general-goods vendor.' }] },
  { catalogId: 'progression-curves', label: 'Progression Curves', category: 'Systems', description: 'XP, level, or mastery curves driving advancement.', module: 'arpg-progression', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'curve-hero-level', name: 'Hero Level Curve', categoryPath: ['XP'], tags: [], description: 'The main character XP-to-level curve.' }] },
  { catalogId: 'achievements', label: 'Achievements', category: 'Systems', description: 'Player accomplishments tracked across sessions.', module: 'arpg-progression', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'achievement-first-blood', name: 'First Blood', categoryPath: ['Combat'], tags: [], description: 'Defeat your first enemy.' }] },
  { catalogId: 'save-points', label: 'Save / Checkpoint', category: 'Systems', description: 'Persistence points capturing player and world state.', module: 'arpg-save', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'save-bonfire', name: 'Bonfire Checkpoint', categoryPath: ['Checkpoint'], tags: [], description: 'An interact-to-save world checkpoint.' }] },
  // ── Audio & FX ──
  { catalogId: 'music', label: 'Music', category: 'Audio & FX', description: 'Adaptive or linear music assets.', module: 'audio', tracks: ['audio', 'test'],
    starters: [{ id: 'music-combat-a', name: 'Combat Theme A', categoryPath: ['Combat'], tags: ['adaptive'], description: 'An adaptive combat music track with stems.' }] },
  { catalogId: 'ambient', label: 'Ambient', category: 'Audio & FX', description: 'Layered environmental audio for a zone or scene.', module: 'audio', tracks: ['audio', 'test'],
    starters: [{ id: 'ambient-forest-day', name: 'Forest Day', categoryPath: ['Outdoor'], tags: [], description: 'A daytime forest soundscape (bed + one-shots).' }] },
  { catalogId: 'vfx', label: 'VFX Assets', category: 'Audio & FX', description: 'Reusable particle/Niagara effects.', module: 'arpg-polish', tracks: ['vfx', 'art-3d', 'audio', 'test'],
    starters: [{ id: 'vfx-fire-impact', name: 'Fire Impact Burst', categoryPath: ['Impact'], tags: ['fire'], description: 'An impact burst; pairs with Fireball.' }] },
  // ── UI ──
  { catalogId: 'hud-elements', label: 'HUD Elements', category: 'UI', description: 'Persistent in-game UI widgets.', module: 'ui-hud', tracks: ['logic', 'art-2d', 'animation', 'vfx', 'audio', 'test'],
    starters: [{ id: 'hud-health-bar', name: 'Health Bar', categoryPath: ['Vitals'], tags: [], description: 'The player health bar widget.' }] },
  { catalogId: 'icon-sets', label: 'Icon Sets', category: 'UI', description: 'Coherent icon families (items, abilities, statuses).', module: 'ui-hud', tracks: ['art-2d', 'test'],
    starters: [{ id: 'iconset-abilities', name: 'Ability Icons', categoryPath: ['Abilities'], tags: [], description: 'A coherent ability-icon family.' }] },
  // ── Input & Platform ──
  { catalogId: 'input-schemes', label: 'Input Schemes', category: 'Input & Platform', description: 'Bindings and feel for one input device family.', module: 'input-handling', tracks: ['logic', 'art-2d', 'test'],
    starters: [{ id: 'input-gamepad', name: 'Gamepad Default', categoryPath: ['Gamepad'], tags: [], description: 'The default gamepad binding scheme.' }] },
  // ── Onboarding ──
  { catalogId: 'tutorial-beats', label: 'Tutorial Beats', category: 'Onboarding', description: 'Single scripted teaching moments.', module: 'arpg-ui', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'tutorial-dodge', name: 'Learn to Dodge', categoryPath: ['Combat'], tags: [], description: 'Teach the dodge input in a sandbox.' }] },
  // ── Economy / Meta ──
  { catalogId: 'currencies', label: 'Currencies', category: 'Economy / Meta', description: 'Spendable resource types in the economy.', module: 'arpg-inventory', tracks: ['logic', 'art-2d', 'vfx', 'audio', 'test'],
    starters: [{ id: 'currency-gold', name: 'Gold', categoryPath: ['Standard'], tags: [], description: 'The primary soft currency.' }] },
  // ── Player Movement (not from the xlsx-21) ──
  // The autonomously-built locomotion pipeline. Bridge-driven: each step dispatches a
  // Python module on the editor thread, so every step is L3/L4-deferred-to-the-bridge in
  // stub mode (config-complete, walkable). Surfaced here to retire its orphaned/walker-skip
  // status — see src/lib/catalog/pipelines/player-movement.ts.
  { catalogId: 'player-movement', label: 'Player Movement', category: 'Game Assets', description: 'Tier-2 player locomotion: Mixamo→Manny retarget → blend space → AnimBP → roll montage → playable gate.', module: 'arpg-character', tracks: ['animation', 'test'],
    starters: [{ id: 'player-locomotion-manny', name: 'Manny Locomotion', categoryPath: ['Movement'], tags: ['mixamo', 'locomotion'], description: 'WASD + Shift sprint + Space roll, from no animation to a PIE-and-feel playable gate.' }] },
];

/** Materialize a new catalog's starters into CatalogEntityBase[] (planned, minimal data). */
export function newCatalogStarters(def: NewCatalogDef): CatalogEntityBase[] {
  return def.starters.map((s) => ({
    id: s.id, catalogId: def.catalogId, name: s.name, categoryPath: s.categoryPath, tags: s.tags,
    lifecycle: 'planned' as const, data: { description: s.description },
  }));
}
