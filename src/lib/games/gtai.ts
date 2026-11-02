import type { GameDef, ManifestEntry } from './types';

/**
 * GTAI: Uprising — a top-down open-city crime sandbox in the GTA 2 mould: a rogue factory robot takes
 * hitman contracts from underground robot bosses, steals and drives vehicles, causes mayhem, and
 * answers to police wanted heat. About 5 hours, Steam. The engine is **Godot 4.7.2**, locked by the owner on
 * 2026-11-02 after the overnight UE/Godot/Unity spike (games/gtai/STATE.md). `root` is the game's own repo,
 * resolved against the PoF repo root (`../gtai`, a sibling checkout of PoF); `POF_GAME_ROOT_GTAI`
 * overrides it (`gameRoot.ts`). L2 static verify reads the game-written `pof.godot-evidence/1` files there
 * (`lint` + `unit-tests`); a root that is not on disk defers as unbound. The runtime tiers (L3/L4 drain,
 * packaging) are still UE-only and defer with the adapter reason (`ueBinding.ts`).
 *
 * The manifest classifies every registered pipeline (checked against each pipeline's step labels,
 * not only the scout's table): `reuse` = genre-neutral as-is, `reskin` = reworkable for the genre
 * (the note says how), `planned` = a genre pipeline that does not exist yet. ARPG-only pipelines are
 * OMITTED and listed in `GTAI_OMITTED` with the reason, so the coverage test can tell a deliberate
 * omission from a forgotten one. No `expected` counts: the pitch declares them later (absent = no
 * target declared).
 */
const GTAI_MANIFEST: readonly ManifestEntry[] = [
  // ── reskin: the pipeline's shape fits, its ARPG content does not ──
  { catalogId: 'quests', fit: 'reskin', note: 'quests -> hitman contracts: one contract per quest (target, method, payout, fail on target escape); the GTAI quest packages are the `contracts` pipeline' },
  { catalogId: 'factions', fit: 'reskin', note: 'factions -> robot-boss gangs: the rep-tier ladder becomes gang respect (GTA 2 style), hostile acts flip a gang to kill-on-sight' },
  { catalogId: 'zone-map', fit: 'reskin', note: 'zone-map -> city districts, one per gang turf; "Area Level & Density" becomes ped/cop density, not ARPG area level' },
  { catalogId: 'spellbook', fit: 'reskin', note: 'spellbook -> robot abilities (overclock, EMP burst, ram) and weapon specials; gun handling itself is the planned `firearms` pipeline' },
  { catalogId: 'bestiary', fit: 'reskin', note: 'bestiary -> cops, gangers and civilians; "Monster Rarity" and "Resistances" become threat tier and armour class, and "Sprite Render" may suit the top-down view' },
  { catalogId: 'characters', fit: 'reskin', note: 'characters -> robot bosses and named NPCs (contract givers, fixers, the protagonist)' },
  { catalogId: 'progression-curves', fit: 'reskin', note: 'progression-curves -> robot upgrades and the wanted-heat escalation curve; "Death Penalty" becomes the bust/wasted cash cut' },
  { catalogId: 'props', fit: 'reskin', note: 'props -> destructibles (hydrants, kiosks, barrels); "Loot on Destroy" drops cash and pickups, never item affixes' },
  { catalogId: 'vendors', fit: 'reskin', note: 'vendors -> arms dealer and chop shop (sell stolen cars); vehicle storage and respray are the planned `garages` pipeline' },
  { catalogId: 'status-effects', fit: 'reskin', note: 'status-effects -> EMP, fire, oil slick, electrocution; ARPG ailment math does not carry over' },
  { catalogId: 'combat-map', fit: 'reskin', note: 'combat-map -> set-piece hits (waves of gangers, a getaway); "Balance" scales by heat, not area level' },
  { catalogId: 'player-movement', fit: 'reskin', note: 'player-movement -> robot locomotion; its Mixamo/Manny steps assume a humanoid rig and need a robot rig source' },
  // Overrides of the brief's list, from the step labels:
  { catalogId: 'dialog-trees', fit: 'reskin', note: 'dialog-trees -> pay-phone and boss briefings; "Skill Checks" gate on gang respect or heat, not ARPG attributes' },
  { catalogId: 'music', fit: 'reskin', note: 'music -> score layers keyed to wanted heat and chases instead of combat tiers; the diegetic car radio is the planned `radio` pipeline' },

  // ── reuse: genre-neutral pipelines, used as they are ──
  { catalogId: 'character-pipeline', fit: 'reuse', note: 'concept -> 3D -> rig -> UE as-is; its face gates apply to human cast only, not robot subjects' },
  { catalogId: 'hud-elements', fit: 'reuse' },
  { catalogId: 'screen-flow', fit: 'reuse' },
  { catalogId: 'input-schemes', fit: 'reuse' },
  { catalogId: 'icon-sets', fit: 'reuse' },
  { catalogId: 'materials', fit: 'reuse' },
  { catalogId: 'vfx', fit: 'reuse' },
  { catalogId: 'ambient', fit: 'reuse' },
  { catalogId: 'cutscenes', fit: 'reuse' },
  { catalogId: 'state-graph', fit: 'reuse' },
  { catalogId: 'currencies', fit: 'reuse', note: 'cash is the one soft currency' },
  { catalogId: 'save-points', fit: 'reuse' },
  { catalogId: 'tutorial-beats', fit: 'reuse' },
  { catalogId: 'achievements', fit: 'reuse', note: 'Steam achievements' },
  { catalogId: 'story-arcs', fit: 'reuse', note: 'the campaign as pof.storygraph/1: contracts, the betrayal and the four souls as gated decisions' },
  { catalogId: 'contracts', fit: 'reuse', note: 'GTAI-native (built for this game, not reworked): one row per quest package games/gtai/quests/<id>/quest.json, mirrored by POST /api/games/gtai/quests/sync; Council, Plan, Guards, Package, In-game' },

  // ── planned: genre pipelines the game needs that do not exist yet ──
  { catalogId: 'vehicles', fit: 'planned', note: 'stealable vehicles: top-down arcade handling, mass-based collision, damage states' },
  { catalogId: 'wanted-heat', fit: 'planned', note: 'police wanted level: heat sources, escalation tiers, decay, response units' },
  { catalogId: 'traffic', fit: 'planned', note: 'ambient traffic and pedestrians on the road graph: density, behaviour, panic' },
  { catalogId: 'city-blocks', fit: 'planned', note: 'city block and road layout tiles that districts are built from' },
  { catalogId: 'radio', fit: 'planned', note: 'in-vehicle radio stations: tracks, DJ banter, adverts' },
  { catalogId: 'firearms', fit: 'planned', note: 'guns: fire modes, ammo, spread, pickups' },
  { catalogId: 'top-down-camera', fit: 'planned', note: 'GTA 2 style overhead camera: altitude rises with speed, occlusion of tall blocks' },
  { catalogId: 'garages', fit: 'planned', note: 'garages: store, respray (clears heat) and modify stolen vehicles' },
];

/**
 * Registered pipelines GTAI deliberately does NOT use, each with its reason. Exported so the coverage
 * test can require that every registered pipeline is either in the manifest or named here.
 */
export const GTAI_OMITTED: readonly { catalogId: string; reason: string }[] = [
  { catalogId: 'affixes', reason: 'ARPG item-affix rolls; GTA weapons have fixed stats' },
  { catalogId: 'loot-tables', reason: 'ARPG staged loot rolls; drops here are fixed cash and pickups' },
  { catalogId: 'items', reason: 'ARPG gear (rarity, affixes, ilvl); weapons belong to the planned firearms pipeline' },
  { catalogId: 'crafting-recipes', reason: 'ARPG crafting bench and orbs; no crafting loop in the pitch' },
  { catalogId: 'codex', reason: 'ARPG lore encyclopedia; story is told through contracts, briefings and radio' },
];

export const GTAI_GAME: GameDef = {
  id: 'gtai',
  title: 'GTAI: Uprising',
  canonProfiles: ['gtai'],
  manifest: GTAI_MANIFEST,
  engine: { kind: 'godot', version: '4.7.2', root: '../gtai' },
  designDir: 'games/gtai',
};
