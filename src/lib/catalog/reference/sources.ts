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
import { BOTW_OBTAIN, BOTW_PIN, BOTW_SOURCE, PARAM_GROUP_CLASS_MAP, PLAYER_CLASS_MAP } from '@/lib/catalog/ingest/botw';

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
  tables: [
    // W00: the player's action / AI-node library → player-movement (wrap only).
    { file: 'src/Game/Actor/Player/**/*.{h,cpp}', catalogId: 'player-movement', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: PLAYER_CLASS_MAP },
    // W02: the per-object parameter-group library → items, the largest share of its groups (wrap only).
    { file: 'src/KingSystem/Resource/GeneralParamList/**/*.{h,cpp}', catalogId: 'items', technique: 'cpp-decls', keyColumn: 'qualifiedName', map: PARAM_GROUP_CLASS_MAP },
  ],
};

export const REFERENCE_SOURCES: Record<string, ReferenceSource> = { [DIABLO1.id]: DIABLO1, [BOTW.id]: BOTW };

export function getReferenceSource(id: string): ReferenceSource {
  const s = REFERENCE_SOURCES[id];
  if (!s) throw new Error(`Unknown reference source "${id}" — registered: ${Object.keys(REFERENCE_SOURCES).join(', ')}`);
  return s;
}
