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

export interface ReferenceTableSpec {
  /** Path relative to the source's data root: `monsters/monstdat.tsv`. */
  file: string;
  catalogId: string;
  /** Key into `TECHNIQUES`. */
  technique: string;
  /** Omitted or blank → positional identity (see `ingestRecords`). */
  keyColumn?: string;
  map: FieldMap;
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
    { file: 'monsters/monstdat.tsv', catalogId: 'bestiary', technique: 'tsv', keyColumn: '_monster_id', map: MONSTER_MAP },
    { file: 'items/itemdat.tsv', catalogId: 'items', technique: 'tsv', keyColumn: 'id', map: ITEM_MAP },
    { file: 'spells/spelldat.tsv', catalogId: 'spellbook', technique: 'tsv', keyColumn: 'id', map: SPELL_MAP },
  ],
};

export const REFERENCE_SOURCES: Record<string, ReferenceSource> = { [DIABLO1.id]: DIABLO1 };

export function getReferenceSource(id: string): ReferenceSource {
  const s = REFERENCE_SOURCES[id];
  if (!s) throw new Error(`Unknown reference source "${id}" — registered: ${Object.keys(REFERENCE_SOURCES).join(', ')}`);
  return s;
}
