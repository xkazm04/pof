/** Engine-derived Diablo I locations. Table rows remain external; only engine structure lives here. */
import type { LocationSpecData } from '@/lib/catalog/reference/locationSpecs';

const source = (path: string): string => {
  const match = /^(.*):(\d+)$/.exec(path);
  return `https://github.com/diasurgical/devilutionX/blob/4138a82/Source/${match ? `${match[1]}#L${match[2]}` : path}`;
};
const refs = (...paths: string[]) => paths.map(source);

export const LOCATION_SPECS_DATA = [
  {
    id: 'd1-town-tristram', name: 'Tristram / Town', kind: 'town', dungeonType: 'DTYPE_TOWN', depth: 0,
    entry: 'New-game start; stairs connect to level 1, unlocked shortcuts connect to levels 5, 9, and 13, and Town Portals return from dungeon or set levels. Hellfire adds Hive and Crypt entrances.',
    procedural: 'Fixed authored town assembled from sector map files; quest state changes some tiles and entrances.',
    quests: ['Q_BUTCHER', 'Q_PWATER'], hellfire: false,
    refs: refs('levels/gendung.cpp:328', 'levels/town.cpp:202', 'levels/trigs.cpp:109', 'portal.cpp:134'),
  },
  {
    id: 'd1-level-01', name: 'Cathedral — Level 1', kind: 'dungeon', dungeonType: 'DTYPE_CATHEDRAL', depth: 1,
    entry: 'Town stairs connect to level 1; down stairs connect to level 2; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Cathedral dungeon generation.', quests: [], hellfire: false,
    refs: refs('levels/gendung.cpp:330', 'levels/drlg_l1.cpp:1298', 'levels/trigs.cpp:152'),
  },
  {
    id: 'd1-level-02', name: 'Cathedral — Level 2', kind: 'dungeon', dungeonType: 'DTYPE_CATHEDRAL', depth: 2,
    entry: 'Stairs connect to levels 1 and 3; a conditional entrance leads to the Poisoned Water Supply; an optional Town Portal returns to town.',
    procedural: 'Seed-driven dungeon generation that may embed fixed quest-map content.', quests: ['Q_BUTCHER', 'Q_PWATER'], hellfire: false,
    refs: refs('levels/gendung.cpp:330', 'levels/drlg_l1.cpp:387', 'levels/drlg_l1.cpp:1114'),
  },
  {
    id: 'd1-level-03', name: 'Cathedral — Level 3', kind: 'dungeon', dungeonType: 'DTYPE_CATHEDRAL', depth: 3,
    entry: "Stairs connect to levels 2 and 4; a conditional entrance leads to Skeleton King's Lair; an optional Town Portal returns to town.",
    procedural: 'Seed-driven dungeon generation with a conditional fixed set-level entrance.', quests: ['Q_SKELKING'], hellfire: false,
    refs: refs('levels/gendung.cpp:330', 'levels/drlg_l1.cpp:389', 'quests.cpp:188'),
  },
  {
    id: 'd1-level-04', name: 'Cathedral — Level 4', kind: 'dungeon', dungeonType: 'DTYPE_CATHEDRAL', depth: 4,
    entry: 'Stairs connect to levels 3 and 5; an optional Town Portal returns to town.',
    procedural: "Seed-driven dungeon generation; Ogden's Sign uses an embedded map piece, while Gharbad is placed as a quest unique.",
    quests: ['Q_GARBUD', 'Q_LTBANNER'], hellfire: false,
    refs: refs('levels/gendung.cpp:330', 'levels/drlg_l1.cpp:391', 'monster.cpp:515'),
  },
  {
    id: 'd1-level-05', name: 'Catacombs — Level 5', kind: 'dungeon', dungeonType: 'DTYPE_CATACOMBS', depth: 5,
    entry: 'Stairs connect to levels 4 and 6; an unlocked shortcut connects to Tristram; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Catacombs dungeon generation with conditional fixed quest pieces.', quests: ['Q_ROCK', 'Q_BLOOD'], hellfire: false,
    refs: refs('levels/gendung.cpp:332', 'levels/drlg_l2.cpp:2830', 'levels/trigs.cpp:474', 'monster.cpp:551'),
  },
  {
    id: 'd1-level-06', name: 'Catacombs — Level 6', kind: 'dungeon', dungeonType: 'DTYPE_CATACOMBS', depth: 6,
    entry: 'Stairs connect to levels 5 and 7; a quest entrance leads to the Chamber of Bone; an optional Town Portal returns to town.',
    procedural: 'Seed-driven dungeon generation with a conditional fixed set-level entrance.', quests: ['Q_SCHAMB'], hellfire: false,
    refs: refs('levels/gendung.cpp:332', 'levels/trigs.cpp:172', 'levels/drlg_quests.cpp:112'),
  },
  {
    id: 'd1-level-07', name: 'Catacombs — Level 7', kind: 'dungeon', dungeonType: 'DTYPE_CATACOMBS', depth: 7,
    entry: 'Stairs connect to levels 6 and 8; an optional Town Portal returns to town.',
    procedural: 'Seed-driven dungeon generation with a conditional Halls of the Blind map piece.', quests: ['Q_BLIND'], hellfire: false,
    refs: refs('levels/gendung.cpp:332', 'levels/drlg_quests.cpp:100', 'monster.cpp:555'),
  },
  {
    id: 'd1-level-08', name: 'Catacombs — Level 8', kind: 'dungeon', dungeonType: 'DTYPE_CATACOMBS', depth: 8,
    entry: 'Stairs connect to levels 7 and 9; an optional Town Portal returns to town.',
    procedural: 'Seed-driven dungeon generation; Zhar occupies a selected procedural library theme room.', quests: ['Q_ZHAR'], hellfire: false,
    refs: refs('levels/gendung.cpp:332', 'monster.cpp:413', 'monster.cpp:517'),
  },
  {
    id: 'd1-level-09', name: 'Caves — Level 9', kind: 'dungeon', dungeonType: 'DTYPE_CAVES', depth: 9,
    entry: 'Stairs connect to levels 8 and 10; an unlocked shortcut connects to Tristram; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Caves dungeon generation.', quests: ['Q_MUSHROOM'], hellfire: false,
    refs: refs('levels/gendung.cpp:334', 'levels/drlg_l3.cpp:2185', 'levels/trigs.cpp:526', 'quests.cpp:449'),
  },
  {
    id: 'd1-level-10', name: 'Caves — Level 10', kind: 'dungeon', dungeonType: 'DTYPE_CAVES', depth: 10,
    entry: 'Stairs connect to levels 9 and 11; an optional Town Portal returns to town.',
    procedural: 'Seed-driven dungeon generation with a conditional fixed Anvil map piece.', quests: ['Q_ANVIL'], hellfire: false,
    refs: refs('levels/gendung.cpp:334', 'levels/drlg_l3.cpp:1798', 'monster.cpp:559'),
  },
  {
    id: 'd1-level-11', name: 'Caves — Level 11', kind: 'dungeon', dungeonType: 'DTYPE_CAVES', depth: 11,
    entry: 'Stairs connect to levels 10 and 12; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Caves dungeon generation.', quests: [], hellfire: false,
    refs: refs('levels/gendung.cpp:334', 'levels/drlg_l3.cpp:2185', 'levels/trigs.cpp:495'),
  },
  {
    id: 'd1-level-12', name: 'Caves — Level 12', kind: 'dungeon', dungeonType: 'DTYPE_CAVES', depth: 12,
    entry: 'Stairs connect to levels 11 and 13; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Caves dungeon generation.', quests: [], hellfire: false,
    refs: refs('levels/gendung.cpp:334', 'levels/drlg_l3.cpp:2185', 'levels/trigs.cpp:495'),
  },
  {
    id: 'd1-level-13', name: 'Hell — Level 13', kind: 'dungeon', dungeonType: 'DTYPE_HELL', depth: 13,
    entry: 'Stairs connect to levels 12 and 14; an unlocked shortcut connects to Tristram; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Hell dungeon generation with a conditional Warlord map piece.', quests: ['Q_WARLORD'], hellfire: false,
    refs: refs('levels/gendung.cpp:336', 'levels/drlg_l4.cpp:167', 'levels/trigs.cpp:573', 'monster.cpp:563'),
  },
  {
    id: 'd1-level-14', name: 'Hell — Level 14', kind: 'dungeon', dungeonType: 'DTYPE_HELL', depth: 14,
    entry: 'Stairs connect to levels 13 and 15; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Hell dungeon generation; Lachdanan is placed as a quest unique when selected.', quests: ['Q_VEIL'], hellfire: false,
    refs: refs('levels/gendung.cpp:336', 'monster.cpp:521', 'monster.cpp:568'),
  },
  {
    id: 'd1-level-15', name: 'Hell — Level 15', kind: 'dungeon', dungeonType: 'DTYPE_HELL', depth: 15,
    entry: "Up stairs connect to level 14; a quest-gated hell gate leads to level 16 after the Betrayer quest; a red portal enters Lazarus' set level; an optional Town Portal returns to town.",
    procedural: "Seed-driven Hell dungeon generation with a fixed Lazarus entrance and map piece; Lachdanan's quest may place its follow-up item here.",
    quests: ['Q_BETRAYER', 'Q_DIABLO', 'Q_VEIL'], hellfire: false,
    refs: refs('levels/drlg_l4.cpp:1132', 'levels/trigs.cpp:255', 'quests.cpp:153', 'quests.cpp:465'),
  },
  {
    id: 'd1-level-16', name: 'Hell — Level 16 / Diablo', kind: 'dungeon', dungeonType: 'DTYPE_HELL', depth: 16,
    entry: 'The hell gate connects from level 15; up stairs return to level 15; an optional Town Portal returns to town.',
    procedural: 'The generator establishes the mirrored shell, then four authored Diablo map quadrants and their fixed monster layers are inserted.',
    quests: ['Q_DIABLO'], hellfire: false,
    refs: refs('levels/drlg_l4.cpp:1166', 'levels/drlg_l4.cpp:1216', 'monster.cpp:613', 'monster.cpp:3435'),
  },
  {
    id: 'd1-set-skeleton-king', name: "Skeleton King's Lair", kind: 'set-level', dungeonType: 'DTYPE_CATHEDRAL', depth: 'quest-parent', parentQuest: 'Q_SKELKING',
    entry: 'A conditional entrance on the configured parent floor enters the set level; a fixed return trigger returns beside that entrance; Town Portals preserve set-level identity.',
    procedural: 'Fixed authored maps; no ordinary dungeon generation.', quests: ['Q_SKELKING'], hellfire: false,
    refs: refs('levels/setmaps.cpp:29', 'levels/setmaps.cpp:115', 'levels/trigs.cpp:318', 'quests.cpp:292'),
  },
  {
    id: 'd1-set-chamber-of-bone', name: 'Chamber of Bone', kind: 'set-level', dungeonType: 'DTYPE_CATACOMBS', depth: 'quest-parent', parentQuest: 'Q_SCHAMB',
    entry: 'A quest entrance on the configured parent floor enters the set level; a fixed return trigger returns beside that entrance; an optional Town Portal returns to town.',
    procedural: 'Fixed authored maps; no ordinary dungeon generation.', quests: ['Q_SCHAMB'], hellfire: false,
    refs: refs('levels/setmaps.cpp:30', 'levels/setmaps.cpp:128', 'levels/trigs.cpp:326', 'quests.cpp:294'),
  },
  {
    id: 'd1-set-poisoned-water', name: 'Poisoned Water Supply', kind: 'set-level', dungeonType: 'DTYPE_CAVES', depth: 'quest-parent', parentQuest: 'Q_PWATER',
    entry: 'A quest entrance on the configured parent floor enters the set level; a fixed return trigger returns beside that entrance; an optional Town Portal returns to town.',
    procedural: 'Fixed authored map and quest palette; no ordinary dungeon generation.', quests: ['Q_PWATER'], hellfire: false,
    refs: refs('levels/setmaps.cpp:32', 'levels/setmaps.cpp:138', 'levels/trigs.cpp:334', 'quests.cpp:296'),
  },
  {
    id: 'd1-set-lazarus', name: "Archbishop Lazarus' Lair", kind: 'set-level', dungeonType: 'DTYPE_CATHEDRAL', depth: 'quest-parent', parentQuest: 'Q_BETRAYER',
    entry: 'A quest-state red portal on the parent floor enters the set level. After Lazarus dies, a return red portal is created. Town Portals preserve set-level identity.',
    procedural: 'Fixed authored maps; no ordinary dungeon generation.', quests: ['Q_BETRAYER'], hellfire: false,
    refs: refs('levels/setmaps.cpp:33', 'levels/setmaps.cpp:145', 'quests.cpp:153', 'quests.cpp:166'),
  },
  {
    id: 'd1-region-cathedral', name: 'Cathedral', kind: 'lore-place', dungeonType: 'DTYPE_CATHEDRAL', depth: '1-4',
    entry: 'Aggregate lore and biome record; its concrete floors are entered through stairs, quest entrances, or Town Portals.',
    procedural: 'Contains four seed-driven dungeon floors and conditional fixed quest pieces.',
    quests: ['Q_BUTCHER', 'Q_PWATER', 'Q_SKELKING', 'Q_GARBUD', 'Q_LTBANNER'], hellfire: false,
    refs: refs('levels/gendung_defs.hpp:17', 'levels/gendung.cpp:330'),
  },
  {
    id: 'd1-region-catacombs', name: 'Catacombs', kind: 'lore-place', dungeonType: 'DTYPE_CATACOMBS', depth: '5-8',
    entry: 'Aggregate lore and biome record; concrete floors use stairs, the level-5 town shortcut, quest entrances, or Town Portals.',
    procedural: 'Contains four seed-driven dungeon floors and conditional fixed quest pieces.',
    quests: ['Q_ROCK', 'Q_BLOOD', 'Q_SCHAMB', 'Q_BLIND', 'Q_ZHAR'], hellfire: false,
    refs: refs('levels/gendung_defs.hpp:18', 'levels/gendung.cpp:332'),
  },
  {
    id: 'd1-region-caves', name: 'Caves', kind: 'lore-place', dungeonType: 'DTYPE_CAVES', depth: '9-12',
    entry: 'Aggregate lore and biome record; concrete floors use stairs, the level-9 town shortcut, or Town Portals.',
    procedural: 'Contains four seed-driven dungeon floors and conditional fixed quest pieces.', quests: ['Q_MUSHROOM', 'Q_ANVIL'], hellfire: false,
    refs: refs('levels/gendung_defs.hpp:19', 'levels/gendung.cpp:334'),
  },
  {
    id: 'd1-region-hell', name: 'Hell', kind: 'lore-place', dungeonType: 'DTYPE_HELL', depth: '13-16',
    entry: 'Aggregate lore and biome record; concrete floors use stairs, the level-13 town shortcut, the level-15 hell gate, or Town Portals.',
    procedural: 'Contains four seed-driven dungeon floors; fixed map content is embedded for quests and level 16.',
    quests: ['Q_WARLORD', 'Q_VEIL', 'Q_BETRAYER', 'Q_DIABLO'], hellfire: false,
    refs: refs('levels/gendung_defs.hpp:20', 'levels/gendung.cpp:336'),
  },
  {
    id: 'd1-level-17', name: 'Hive / Nest 1', kind: 'dungeon', dungeonType: 'DTYPE_NEST', depth: 17,
    entry: 'The Hellfire town Hive entrance connects to level 17; down stairs connect to level 18; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Nest dungeon generation using the Caves generator.', quests: ['Q_DEFILER', 'Q_GIRL'], hellfire: true,
    refs: refs('levels/gendung.cpp:338', 'levels/gendung.cpp:362', 'levels/trigs.cpp:136', 'player.cpp:3468'),
  },
  {
    id: 'd1-level-18', name: 'Hive / Nest 2', kind: 'dungeon', dungeonType: 'DTYPE_NEST', depth: 18,
    entry: 'Stairs connect to levels 17 and 19; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Nest dungeon generation with a forced Hork Spawn monster type.', quests: [], hellfire: true,
    refs: refs('levels/gendung.cpp:338', 'levels/drlg_l3.cpp:2185', 'monster.cpp:3442'),
  },
  {
    id: 'd1-level-19', name: 'Hive / Nest 3', kind: 'dungeon', dungeonType: 'DTYPE_NEST', depth: 19,
    entry: 'Stairs connect to levels 18 and 20; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Nest dungeon generation with forced Hork monster types.', quests: ['Q_GIRL', 'Q_DEFILER', 'Q_TRADER'], hellfire: true,
    refs: refs('levels/gendung.cpp:338', 'monster.cpp:3444', 'monster.cpp:925', 'player.cpp:3476'),
  },
  {
    id: 'd1-level-20', name: 'Hive / Nest 4', kind: 'dungeon', dungeonType: 'DTYPE_NEST', depth: 20,
    entry: 'Up stairs connect to level 19; there are no down stairs; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Nest dungeon generation with the Defiler forced into the roster.', quests: ['Q_DEFILER'], hellfire: true,
    refs: refs('levels/gendung.cpp:338', 'levels/drlg_l3.cpp:1968', 'monster.cpp:3448'),
  },
  {
    id: 'd1-level-21', name: 'Crypt 1', kind: 'dungeon', dungeonType: 'DTYPE_CRYPT', depth: 21,
    entry: 'The Hellfire town grave entrance connects to level 21; down stairs connect to level 22; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Crypt dungeon generation; it may contain the Cornerstone room.', quests: ['Q_GRAVE', 'Q_CORNSTN', 'Q_NAKRUL'], hellfire: true,
    refs: refs('levels/gendung.cpp:340', 'levels/gendung.cpp:355', 'levels/crypt.cpp:731', 'objects.cpp:3387'),
  },
  {
    id: 'd1-level-22', name: 'Crypt 2', kind: 'dungeon', dungeonType: 'DTYPE_CRYPT', depth: 22,
    entry: 'Stairs connect to levels 21 and 23; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Crypt dungeon generation.', quests: ['Q_NAKRUL'], hellfire: true,
    refs: refs('levels/gendung.cpp:340', 'levels/drlg_l1.cpp:1298', 'objects.cpp:3387'),
  },
  {
    id: 'd1-level-23', name: 'Crypt 3', kind: 'dungeon', dungeonType: 'DTYPE_CRYPT', depth: 23,
    entry: 'Stairs connect to levels 22 and 24; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Crypt dungeon generation.', quests: ['Q_NAKRUL'], hellfire: true,
    refs: refs('levels/gendung.cpp:340', 'levels/drlg_l1.cpp:1298', 'objects.cpp:3387'),
  },
  {
    id: 'd1-level-24', name: 'Crypt 4 / Na-Krul', kind: 'dungeon', dungeonType: 'DTYPE_CRYPT', depth: 24,
    entry: 'Up stairs connect to level 23; there are no down stairs; an optional Town Portal returns to town.',
    procedural: 'Seed-driven Crypt dungeon generation with a fixed Na-Krul room and forced monster types.', quests: ['Q_NAKRUL'], hellfire: true,
    refs: refs('levels/gendung.cpp:340', 'levels/crypt.cpp:740', 'monster.cpp:3450', 'objects.cpp:3382'),
  },
  {
    id: 'd1-region-hive', name: 'Hive / Nest', kind: 'lore-place', dungeonType: 'DTYPE_NEST', depth: '17-20',
    entry: 'Hellfire-only aggregate region entered through the quest-opened Hive passage in Tristram.',
    procedural: 'Four seed-driven dungeon floors using the Caves generator.', quests: ['Q_FARMER', 'Q_JERSEY', 'Q_GIRL', 'Q_DEFILER', 'Q_TRADER'], hellfire: true,
    refs: refs('levels/gendung_defs.hpp:21', 'levels/trigs.cpp:100', 'levels/trigs.cpp:390'),
  },
  {
    id: 'd1-region-crypt', name: 'Crypt', kind: 'lore-place', dungeonType: 'DTYPE_CRYPT', depth: '21-24',
    entry: 'Hellfire-only aggregate region entered through the quest-opened grave in Tristram.',
    procedural: 'Four seed-driven dungeon floors using the Cathedral generator, with authored Cornerstone and Na-Krul rooms.',
    quests: ['Q_GRAVE', 'Q_CORNSTN', 'Q_NAKRUL'], hellfire: true,
    refs: refs('levels/gendung_defs.hpp:22', 'levels/trigs.cpp:102', 'levels/trigs.cpp:400'),
  },
] as const satisfies readonly LocationSpecData[];

export const LOCATION_LAW_DATA = [
  {
    id: 'd1-level-structure', title: 'Level structure', scope: 'zone-map',
    body: 'Level structure, derived from the engine: town is depth 0; depths 1–4 are Cathedral, 5–8 Catacombs, 9–12 Caves, and 13–16 Hell. Hellfire adds Nest at 17–20 and Crypt at 21–24. Normal floors use seeded procedural generation with optional authored quest pieces; town and set levels use authored maps.',
    refs: refs('levels/gendung.cpp:326', 'levels/gendung.cpp:346', 'levels/setmaps.cpp:112'),
  },
  {
    id: 'd1-monster-type-selection', title: 'Monster type selection per level', scope: 'zone-map',
    body: 'Monster type selection per level, derived from the engine: forced special and quest types register first. Random candidates must be available in the current edition and include the dungeon depth in their inclusive range. Distinct eligible types are drawn until none remain, 24 total types are registered, or the cumulative image budget reaches 4000. Level 16 skips the random draw.',
    refs: refs('monster.cpp:3154', 'monster.cpp:3432', 'monster.cpp:3484', 'monster.h:39'),
  },
  {
    id: 'd1-unique-placement', title: 'Unique placement', scope: 'zone-map',
    body: 'Unique placement, derived from the engine: an ordinary unique row requires its configured level to equal the current dungeon depth and its base type to be in the registered roster; unavailable quest uniques are skipped. Quest bosses use scripted set-piece coordinates and others use a legal random tile. Pack mode chooses no pack, an independent eight-minion pack, or a leashed pack; scripted bosses may override its size.',
    refs: refs('monster.cpp:391', 'monster.cpp:504', 'monster.cpp:514', 'monster.cpp:3402'),
  },
  {
    id: 'd1-drop-level', title: 'Drop level', scope: 'items',
    body: "Drop level, derived from the engine: a monster drop chooses a base whose minimum level fits the monster's effective level, including unique and difficulty bonuses, but records and rolls the item with the slain base archetype's table level rather than the dungeon depth. Floor and object drops use the current dungeon depth; set maps inherit their parent quest floor.",
    refs: refs('items.cpp:3256', 'items.cpp:3422', 'items.cpp:3472', 'items.cpp:399'),
  },
] as const;
