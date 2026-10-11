/**
 * Reference SOURCES — the games PoF studies, and how each table in them is read and mapped.
 *
 * A source is data: which files, read by which technique, keyed by which column, projected
 * through which `FieldMap` into which catalog. Adding a table to an existing game is one
 * entry here plus its map; adding a game is one more `ReferenceSource`. The loop that
 * replicates a game (`/diablo`) grows these entries wave by wave.
 */
import type { FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { DIABLO1_SOURCE, ITEM_MAP, MONSTER_MAP, SPELL_MAP } from '@/lib/catalog/ingest/diablo1';
import { UNIQUE_ITEM_MAP } from '@/lib/catalog/ingest/diablo1UniqueItems';
import { UNIQUE_MAP } from '@/lib/catalog/ingest/diablo1Uniques';
import { slug, type StringDecodeStep } from '@/lib/catalog/ingest/decode';
import { MONSTER_DERIVE, affixDerive, type DeriveSpec } from './derive';
import { CPP_DECLS_PARENT_PASS, type RunLinkPass } from './baseLinks';
import { AFFIX_MAP } from '@/lib/catalog/ingest/diablo1Affixes';
import {
  QUEST_DERIVE,
  QUEST_DIALOG_MAP,
  QUEST_MAP,
  QUEST_ROW_IDS,
  TEXT_LINE_MAP,
  TOWNER_MAP,
} from '@/lib/catalog/ingest/diablo1Dialogue';
import {
  CLASS_ANIMATIONS_MAP,
  CLASS_ATTRIBUTES_MAP,
  CLASS_DERIVE,
  CLASS_SOUNDS_MAP,
  CLASS_SPRITES_MAP,
  CLASS_STARTING_LOADOUT_MAP,
  CLASSDAT_MAP,
  DIABLO1_CLASSES,
  EXPERIENCE_MAP,
} from '@/lib/catalog/ingest/diablo1Classes';
import { OBJECT_MAP } from '@/lib/catalog/ingest/diablo1Objects';
import { MISSILE_MAP } from '@/lib/catalog/ingest/diablo1Missiles';
import { MISSILE_SPRITE_MAP } from '@/lib/catalog/ingest/diablo1MissileSprites';
import { ACTOR_FILE_CLASS_MAP, BEHAVIOUR_NODE_ROW_MAP, BOTW_OBTAIN, BOTW_PIN, BOTW_SOURCE, CAMERA_SHOT_NODE_MAP, CHEMISTRY_CLASS_MAP, COOKING_CLASS_MAP, MOUNT_CLASS_MAP, PARAM_GROUP_CLASS_MAP, PARAMETER_HANDLE_MAP, PLAYER_CLASS_MAP, WORLD_CLASS_MAP } from '@/lib/catalog/ingest/botw';

export interface ReferenceTableSpec {
  /**
   * Path relative to the source's data root: `monsters/monstdat.tsv` — or a GLOB over it
   * (`src/Game/Actor/Player/**` + `/*.{h,cpp}`; see `pathCoverage.isGlobPattern`). A glob spec reads
   * every matching file with the same technique and map; each file's records keep their own
   * path as wrapper identity, and the run summary reports the spec once, with its file counts.
   */
  file: string;
  catalogId: string;
  /** Key into `TECHNIQUES`. */
  technique: string;
  /** Omitted or blank → positional identity (see `ingestRecords`). */
  keyColumn?: string;
  map: FieldMap;
  /** Values computed from the mapped fields + canon laws into `data.derived` (D29); versioned with the map. */
  derive?: DeriveSpec;
  /** Scopes this table's positional entity ids (`d1-<tag>row<N>`) when another positional table shares its catalog. */
  positionalTag?: string;
  /** Enum identifiers by row position for a table that has no key column. */
  rowIds?: readonly string[];
  /** Fixed display name for a table whose record carries no name field. */
  displayName?: string;
  /** Prefix added to a declared key when constructing the projected entity id. */
  keyPrefix?: string;
  /** Serializable decoder applied to the key column before identity is constructed. */
  keyDecode?: StringDecodeStep[];
}

export interface ReferenceManifestSpec {
  file: string;
  technique: string;
  keyColumn: string;
  map: FieldMap;
  /** Registered table paths use this token where the manifest key belongs. */
  registeredFilePattern: string;
}

export interface ReferenceSource {
  id: string;
  game: string;
  project: string;
  licenceNote: string;
  /** Prefix for projected entity ids, so they cannot collide with PoF's own seeds. */
  idPrefix: string;
  /** Where an operator gets the data — this repo never carries it. */
  obtain: string;
  /** Canon profile its entities' prompts are written for (`canon/profiles.ts`). */
  canonProfile: string;
  tables: ReferenceTableSpec[];
  /** Metadata-only registries checked for upstream entries with no registered table. */
  manifests?: ReferenceManifestSpec[];
  /** The upstream commit the data root must be at — a code reference is read at a pin. */
  pin?: string;
  /** Run-level link passes over every wrapper of one run, before the generic link loop (`baseLinks.ts`). */
  linkPasses?: readonly RunLinkPass[];
}

export const DIABLO1: ReferenceSource = {
  id: 'diablo1',
  game: DIABLO1_SOURCE.sourceGame,
  project: DIABLO1_SOURCE.sourceProject,
  licenceNote: DIABLO1_SOURCE.licenceNote,
  idPrefix: 'd1',
  canonProfile: 'diablo1',
  obtain: 'git clone https://github.com/diasurgical/devilutionX — the data root is assets/txtdata',
  tables: [
    { file: 'monsters/monstdat.tsv', catalogId: 'bestiary', technique: 'tsv', keyColumn: '_monster_id', map: MONSTER_MAP, derive: MONSTER_DERIVE },
    { file: 'objects/objdat.tsv', catalogId: 'props', technique: 'tsv', keyColumn: 'id', map: OBJECT_MAP },
    { file: 'monsters/unique_monstdat.tsv', catalogId: 'bestiary', technique: 'tsv', keyColumn: 'name', keyPrefix: 'uniq-', keyDecode: [slug()], map: UNIQUE_MAP },
    { file: 'items/itemdat.tsv', catalogId: 'items', technique: 'tsv', keyColumn: 'id', map: ITEM_MAP },
    { file: 'items/unique_itemdat.tsv', catalogId: 'items', technique: 'tsv', keyColumn: 'name', keyPrefix: 'uitem-', keyDecode: [slug()], map: UNIQUE_ITEM_MAP },
    { file: 'spells/spelldat.tsv', catalogId: 'spellbook', technique: 'tsv', keyColumn: 'id', map: SPELL_MAP },
    { file: 'missiles/misdat.tsv', catalogId: 'vfx', technique: 'tsv', keyColumn: 'id', map: MISSILE_MAP },
    { file: 'missiles/missile_sprites.tsv', catalogId: 'vfx', technique: 'tsv', keyColumn: 'id', keyPrefix: 'sprite-', map: MISSILE_SPRITE_MAP },
    // Affix TIERS (W11): names repeat across powers, so identity is positional; the side is the table (derive).
    { file: 'items/item_prefixes.tsv', catalogId: 'affixes', technique: 'tsv', map: AFFIX_MAP, derive: affixDerive('prefix'), positionalTag: 'pre-' },
    { file: 'items/item_suffixes.tsv', catalogId: 'affixes', technique: 'tsv', map: AFFIX_MAP, derive: affixDerive('suffix'), positionalTag: 'suf-' },
    { file: 'towners/towners.tsv', catalogId: 'characters', technique: 'tsv', keyColumn: 'type', map: TOWNER_MAP },
    { file: 'text/textdat.tsv', catalogId: 'dialog-trees', technique: 'tsv', keyColumn: 'txtstrid', map: TEXT_LINE_MAP },
    { file: 'towners/quest_dialog.tsv', catalogId: 'dialog-trees', technique: 'tsv', keyColumn: 'towner_type', map: QUEST_DIALOG_MAP },
    { file: 'quests/questdat.tsv', catalogId: 'quests', technique: 'tsv', map: QUEST_MAP, rowIds: QUEST_ROW_IDS, derive: QUEST_DERIVE },
    ...DIABLO1_CLASSES.flatMap(({ folder, name }) => [
      {
        file: `classes/${folder}/attributes.tsv`, catalogId: 'characters', technique: 'tsv-kv',
        map: CLASS_ATTRIBUTES_MAP, rowIds: [`class-${folder}`], displayName: name, derive: CLASS_DERIVE,
      },
      {
        file: `classes/${folder}/animations.tsv`, catalogId: 'characters', technique: 'tsv-kv',
        map: CLASS_ANIMATIONS_MAP, rowIds: [`class-${folder}`], displayName: name,
      },
      {
        file: `classes/${folder}/starting_loadout.tsv`, catalogId: 'characters', technique: 'tsv-kv',
        map: CLASS_STARTING_LOADOUT_MAP, rowIds: [`class-${folder}`], displayName: name,
      },
      {
        file: `classes/${folder}/sounds.tsv`, catalogId: 'characters', technique: 'tsv',
        keyColumn: 'speech', keyPrefix: `class-${folder}-speech-`, keyDecode: [slug()],
        map: CLASS_SOUNDS_MAP, displayName: name,
      },
      {
        file: `classes/${folder}/sprites.tsv`, catalogId: 'characters', technique: 'tsv-kv',
        map: CLASS_SPRITES_MAP, rowIds: [`class-${folder}`], displayName: name,
      },
    ]),
    { file: 'Experience.tsv', catalogId: 'progression-curves', technique: 'tsv', keyColumn: 'Level', keyPrefix: 'xp-', map: EXPERIENCE_MAP },
  ],
  manifests: [{
    file: 'classes/classdat.tsv', technique: 'tsv', keyColumn: 'folderName', map: CLASSDAT_MAP,
    registeredFilePattern: 'classes/{key}/attributes.tsv',
  }],
};

/**
 * Breath of the Wild, read from the zeldaret/botw decompilation (/zelda). Its specs are GLOBS over
 * the C++ tree, one per area mapped so far; `BOTW_DESCOPES` (ingest/botw.ts) holds what PoF does not
 * need, and `scripts/zelda/status.ts` derives the covered / descoped / open file counts from both.
 */
export const BOTW: ReferenceSource = {
  id: 'botw',
  game: BOTW_SOURCE.sourceGame,
  project: BOTW_SOURCE.sourceProject,
  licenceNote: BOTW_SOURCE.licenceNote,
  idPrefix: 'botw',
  // No canon profile is registered for it, by decision: /zelda is wrap-only for its whole life and
  // nothing is ever promoted (vault Decisions Z-D9). The label stays — it is stamped in provenance.
  canonProfile: 'botw',
  obtain: BOTW_OBTAIN,
  pin: BOTW_PIN,
  // W22: a bare first base becomes an 'extends' link to its parent's record, or an explicit unresolved marker, on the
  // child's projection (F18, vault Decisions Z-D97, Z-D98); the pass's version joins every cpp-decls spec's stamp.
  linkPasses: [CPP_DECLS_PARENT_PASS],
  tables: [
    // W00: the player's action / AI-node library → player-movement (wrap only).
    { file: 'src/Game/Actor/Player/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: PLAYER_CLASS_MAP },
    // W02: the per-object parameter-group library → items, the largest share of its groups (wrap only).
    { file: 'src/KingSystem/Resource/GeneralParamList/**/*.{h,cpp}', catalogId: 'items', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: PARAM_GROUP_CLASS_MAP },
    // W03: the chemistry rule-book → status-effects, the catalog that names elements (wrap only).
    { file: 'src/KingSystem/Chemical/**/*.{h,cpp}', catalogId: 'status-effects', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: CHEMISTRY_CLASS_MAP },
    // W03: the world simulation (climate, weather, clock, look) → zone-map, where a region lives (wrap only).
    { file: 'src/KingSystem/World/**/*.{h,cpp}', catalogId: 'zone-map', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: WORLD_CLASS_MAP },
    // W04: the mount's behaviour-node library → state-graph, the plurality home of its nodes (wrap only).
    { file: 'src/Game/Actor/Horse/**/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: MOUNT_CLASS_MAP },
    // W06: the cooking engine → crafting-recipes, the home of most of its records (wrap only).
    { file: 'src/Game/Cooking/**/*.{h,cpp}', catalogId: 'crafting-recipes', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: COOKING_CLASS_MAP },
    // W06: the per-object parameter files → props, the largest share among real catalogs (wrap only).
    { file: 'src/KingSystem/Resource/Actor/**/*.{h,cpp}', catalogId: 'props', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: ACTOR_FILE_CLASS_MAP },
    // W07: the camera's node library, one spec per half (one map): event and gameplay camera actions → cutscenes,
    // the camera selectors → dialog-trees, each the plurality of its half among real catalogs (wrap only).
    { file: 'src/Game/Actor/Camera/Action/**/*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: CAMERA_SHOT_NODE_MAP },
    { file: 'src/Game/Actor/Camera/AI/**/*.{h,cpp}', catalogId: 'dialog-trees', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: CAMERA_SHOT_NODE_MAP },
    // W09: the generic node rows, one spec per row under one shared map. Action A–B (flat folder, initials A
    // and B only) → state-graph, the plurality of its nodes among real catalogs (wrap only).
    { file: 'src/Game/Actor/Action/action{A,B}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W10: Action C–D (flat folder, initials C and D only), same shared map → cutscenes, the plurality of this
    // row's nodes among real catalogs (event actor commands); each row earns its own label (wrap only).
    { file: 'src/Game/Actor/Action/action{C,D}*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W12: Action E (flat folder, initial E only), same shared map → cutscenes, the plurality of this row's nodes among
    // real catalogs (scripted-event commands, Z-D51); its handle twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/Action/action{E}*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W13: the fourth row (flat folder, one name stem, not an initial: the side actions a node runs beside its main
    // action), same shared map → state-graph, the plurality of this row's nodes among real catalogs (Z-D55); its handle
    // twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/Action/actionFork*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W14: the fifth row (flat folder: the stem row's initial WITHOUT the stem, and the next initial), same shared map →
    // state-graph, the plurality of this row's nodes among real catalogs (Z-D59). The glob language has no negation, so the
    // first half is an enumeration of the continuations present at the pin, proven disjoint from the stem spec; its handle
    // twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/Action/action{Fa,Fi,Fl,Fr,Fol,Forb,Forc,Fore,G}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W15: the sixth row (flat folder, the five initials after the fifth row's last one), same shared map → state-graph, the
    // plurality of this row's nodes among real catalogs on the concept rule (Z-D63); its handle twin is the last spec below
    // (wrap only).
    { file: 'src/Game/Actor/Action/action{H,I,J,K,L}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W16: the seventh row (flat folder, the three initials after the sixth row's last one), same shared map → state-graph, the
    // plurality of this row's nodes among real catalogs on the concept rule (Z-D70); its handle twin is the last spec below
    // (wrap only).
    { file: 'src/Game/Actor/Action/action{M,N,O}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W17: the eighth row (flat folder, seven initials; it does NOT start after the seventh row's last one — the rows between
    // are later waves), same shared map → state-graph, the plurality of this row's nodes among real catalogs on the concept rule
    // (Z-D75); its handle twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/Action/action{T,U,V,W,X,Y,Z}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W18: the ninth row (flat folder, one initial; registered after the eighth although it lies below it in the alphabet —
    // registration order is wave order), same shared map → state-graph, the plurality of this row's nodes among real catalogs
    // on the concept rule (Z-D80); its handle twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/Action/action{S}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W19: the tenth row (flat folder, three initials; registered after the ninth, and the first row whose alphabetic gap closes
    // from BOTH sides — M–O below it, S above it), same shared map → state-graph, the plurality of this row's nodes among real
    // catalogs on the concept rule (Z-D85); its handle twin is below (wrap only).
    { file: 'src/Game/Actor/Action/action{P,Q,R}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W19: the area-volume folder (a folder of the Action library's own node shape, not a row of the Action folder): same shared
    // map, catalog fixed by the App Master's ruling (placed volumes and area tags; Z-D84, Z-D85). Registered after the tenth row.
    { file: 'src/Game/Actor/Area/Action/*.{h,cpp}', catalogId: 'zone-map', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W19: the NPC folder (the talk, turn, wait and lerp commands of a conversation), same shared map, catalog fixed by the App
    // Master's ruling (Z-D84, Z-D85); it ended the cpp-decls block until the first AI row. Its sibling AI folder stays open (an AI row reads it later).
    // The folder began under dialog-trees and moved to state-graph by Z-D87 (c) and Z-D88: its nodes start a conversation by id
    // (a hook) and wait, turn and lerp (states), none of them the content of a dialog-trees step.
    { file: 'src/Game/Actor/NPC/Action/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W20: the first row of the AI folder (the Action library's counterpart: tree roots, selectors and the creatures' own
    // behaviour nodes; two initials, the AI file prefix), same shared map, state-graph on the concept rule — the plurality
    // of this row's nodes among real catalogs, selectors counted as guards (Z-D90). Registered after the NPC folder (Z-D89).
    { file: 'src/Game/Actor/AI/ai{G,H}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W21: the second row of the AI folder (the enemy's base kit — normal, battle, find-player, reaction, range-keep — and the
    // fork nodes; two initials again), same shared map, state-graph on the concept rule: the plurality of this row's nodes among
    // real catalogs, robust under every reading of its selectors (Z-D94). Registered directly after the first AI row (Z-D93).
    { file: 'src/Game/Actor/AI/ai{E,F}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W23: the third row of the AI folder (the composite kit — sequence, switch and select nodes — and several creature
    // families' own nodes; one initial, in the brace form), same shared map, state-graph on the concept rule: the plurality of
    // this row's nodes among real catalogs, robust under the verbatim selector readings (Z-D99). Registered directly after the
    // second AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{S}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W24: the fourth row of the AI folder (the archer, last-boss, small-spirit, insect and bird families' own nodes beside a
    // handful of selectors; four consecutive initials, the brace form), same shared map, state-graph on the concept rule: the
    // plurality of this row's nodes among real catalogs, robust under every reading of its selectors (Z-D102). Registered
    // directly after the third AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{I,J,K,L}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W25: the fifth row of the AI folder (the dungeon-puzzle tags, the dragon family, the die and cliff selectors, the circle
    // moves and the cooking pot's root; two initials, the brace form), same shared map, state-graph on the concept rule: the
    // plurality of this row's nodes among real catalogs, robust under every reading of its selectors (Z-D106). Registered
    // directly after the fourth AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{C,D}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W26: the sixth row of the AI folder (the target-position nodes, the weapon-handling selectors, the view and wait nodes,
    // the treasure, warp and water nodes and several creature families; SEVEN consecutive initials in the brace form, one of
    // which names no file today, and the last capital of the alphabet), same shared map, state-graph on the concept rule: the
    // plurality of this row's nodes among real catalogs, robust under every reading of its selectors (Z-D109). Registered
    // directly after the fifth AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{T,U,V,W,X,Y,Z}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W27: the seventh row of the AI folder (the air-creature, animal, assassin, arrow and attack families' own nodes, a handful of
    // selectors, and ONE header that is no behaviour node: a data-manager helper beside its source; two consecutive initials, the
    // first capital of the alphabet among them, in the brace form), same shared map, state-graph on the concept rule: the plurality
    // of this row's nodes among real catalogs, robust under every reading of its selectors (Z-D111). Registered directly after the
    // sixth AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{A,B}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W28: the eighth row of the AI folder, the largest (one boss-kit family holds two fifths of its nodes, beside many selectors
    // and several creature families; THREE consecutive initials in the brace form, the middle one naming no file today), same
    // shared map, state-graph on the concept rule: the plurality of this row's nodes among real catalogs, robust under every
    // reading of its selectors (Z-D114). Registered directly after the seventh AI row and before the NPC's AI folder, which keeps
    // the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{P,Q,R}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W29: the ninth and LAST row of the AI folder (many selectors, several creature families and a family of non-player-character
    // nodes; THREE consecutive initials in the brace form, every one naming files), same shared map, state-graph on the concept
    // rule: the plurality of this row's nodes among real catalogs, robust under every reading of its selectors (Z-D117).
    // Registered directly after the eighth AI row and before the NPC's AI folder, which keeps the end of the block (Z-D96 (d)).
    { file: 'src/Game/Actor/AI/ai{M,N,O}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W21: the NPC's AI folder (a flat folder of the AI node shape beside the NPC's Action folder), same shared map and the NPC
    // folder's catalog; it ends the cpp-decls block (Z-D93). Its handle twin is the last spec below (wrap only).
    { file: 'src/Game/Actor/NPC/AI/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: BEHAVIOUR_NODE_ROW_MAP },
    // W11: the parameter handles of every node area that declares them, read by a SECOND technique over the same globs
    // (cpp-handles — one record per handle: name, scope word, declared type; Z-D46 – Z-D48). One spec per handle-bearing
    // glob, each in its twin spec's catalog, all under one catalog-neutral map; covers no new file (wrap only).
    { file: 'src/Game/Actor/Player/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/Horse/**/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/Camera/Action/**/*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/Action/action{A,B}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/Action/action{C,D}*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W12: Action E's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D51).
    { file: 'src/Game/Actor/Action/action{E}*.{h,cpp}', catalogId: 'cutscenes', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W13: the fourth row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D55).
    { file: 'src/Game/Actor/Action/actionFork*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W14: the fifth row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D59).
    { file: 'src/Game/Actor/Action/action{Fa,Fi,Fl,Fr,Fol,Forb,Forc,Fore,G}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W15: the sixth row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D63).
    { file: 'src/Game/Actor/Action/action{H,I,J,K,L}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W16: the seventh row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D70).
    { file: 'src/Game/Actor/Action/action{M,N,O}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W17: the eighth row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D75).
    { file: 'src/Game/Actor/Action/action{T,U,V,W,X,Y,Z}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W18: the ninth row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D80).
    { file: 'src/Game/Actor/Action/action{S}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W19: the tenth row's handles and the two folders' handles, over the same globs as their cpp-decls twins and in their
    // catalogs (Z-D85); the NPC folder's twin is last, and moved with its decls spec to state-graph (Z-D87 (c), Z-D88).
    { file: 'src/Game/Actor/Action/action{P,Q,R}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/Area/Action/*.{h,cpp}', catalogId: 'zone-map', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/NPC/Action/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W20: the first AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D90).
    { file: 'src/Game/Actor/AI/ai{G,H}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W21: the second AI row's handles and the NPC's AI folder's handles, over the same globs as their cpp-decls twins and in their
    // catalogs (Z-D93, Z-D94); the NPC's AI folder's twin is last of the table.
    { file: 'src/Game/Actor/AI/ai{E,F}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W23: the third AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D99), directly after the
    // second AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{S}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W24: the fourth AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D102), directly after the
    // third AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{I,J,K,L}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W25: the fifth AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D106), directly after the
    // fourth AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{C,D}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W26: the sixth AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D109), directly after the
    // fifth AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{T,U,V,W,X,Y,Z}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W27: the seventh AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D111), directly after the
    // sixth AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{A,B}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W28: the eighth AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D114), directly after the
    // seventh AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{P,Q,R}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    // W29: the ninth and last AI row's handles, over the same glob as its cpp-decls twin and in its catalog (Z-D117), directly after
    // the eighth AI row's twin and before the NPC's AI folder's twin, which stays last.
    { file: 'src/Game/Actor/AI/ai{M,N,O}*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
    { file: 'src/Game/Actor/NPC/AI/*.{h,cpp}', catalogId: 'state-graph', technique: 'cpp-handles', keyColumn: 'qualifiedName', map: PARAMETER_HANDLE_MAP },
  ],
};

export const REFERENCE_SOURCES: Record<string, ReferenceSource> = { [DIABLO1.id]: DIABLO1, [BOTW.id]: BOTW };

export function getReferenceSource(id: string): ReferenceSource {
  const s = REFERENCE_SOURCES[id];
  if (!s) throw new Error(`Unknown reference source "${id}" — registered: ${Object.keys(REFERENCE_SOURCES).join(', ')}`);
  return s;
}
