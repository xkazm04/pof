/**
 * Reading TECHNIQUES — how a source's bytes become records.
 *
 * A wrapper records which technique (and which version of it) produced its raw record, so
 * the same game can later be read by a different technique without losing track of which
 * wrappers came from which reader. Diablo's design tables are TSV; its sprites (CEL/CL2),
 * palettes, levels (DUN) and audio (WAV inside an MPQ) would each be another technique with
 * another `assetKind`. Only the ones that exist are registered — an entry here is a promise
 * that `read` works, so a technique is added when it is built, not when it is imagined.
 */
import { parseTsv, type TsvTable } from '@/lib/catalog/ingest/tsv';

/** What kind of game asset a technique reads. Grows as techniques are built. */
export type AssetKind = 'table';

export interface ReadingTechnique {
  id: string;
  /** Bumped whenever `read` can produce different records from the same input. */
  version: number;
  assetKind: AssetKind;
  describe: string;
  read(text: string): TsvTable;
}

export const TECHNIQUES: Record<string, ReadingTechnique> = {
  tsv: {
    id: 'tsv',
    version: 1,
    assetKind: 'table',
    describe: 'Tab-separated design table, header row first, no quoting (DevilutionX assets/txtdata).',
    read: parseTsv,
  },
};

/** `tsv@1` — the label stored on every wrapper. */
export const techniqueLabel = (t: ReadingTechnique): string => `${t.id}@${t.version}`;

export function getTechnique(id: string): ReadingTechnique {
  const t = TECHNIQUES[id];
  if (!t) throw new Error(`Unknown reading technique "${id}" — registered: ${Object.keys(TECHNIQUES).join(', ')}`);
  return t;
}
