import { describe, expect, it } from 'vitest';
import { unresolvedQuestTalk } from '@/lib/catalog/reference/questTalk';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const textSpec = DIABLO1.tables.find((table) => table.file === 'text/textdat.tsv')!;
const talkSpec = DIABLO1.tables.find((table) => table.file === 'towners/quest_dialog.tsv')!;

const tsv = (columns: readonly string[], row: Record<string, string>) =>
  [columns.join('\t'), columns.map((column) => row[column] ?? '').join('\t')].join('\n');

describe('unresolvedQuestTalk', () => {
  it('lists unique quest-talk line ids that have no wrapped line', () => {
    const lines = wrapTable(DIABLO1, textSpec, tsv(Object.keys(textSpec.map), {
      txtstrid: 'TEXT_PRESENT', txtstr: 'invented line', scrlltxt: 'false',
    }), 't0').wrappers;
    const talk = wrapTable(DIABLO1, talkSpec, tsv(Object.keys(talkSpec.map), {
      towner_type: 'TOWN_SYNTH', Q_ROCK: 'TEXT_PRESENT', Q_MUSHROOM: 'TEXT_MISSING', Q_GARBUD: 'TEXT_MISSING',
    }), 't0').wrappers;

    expect(unresolvedQuestTalk([...lines, ...talk])).toEqual(['TEXT_MISSING']);
  });
});
