// Diablo I dialogue/quest schemas. Headers are upstream column names only; no row values.
import { describe, expect, it } from 'vitest';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { ingestTable } from '@/lib/catalog/ingest/run';
import { provenanceFor } from '@/lib/catalog/ingest/diablo1';
import {
  QUEST_DIALOG_MAP,
  QUEST_DERIVE,
  QUEST_MAP,
  QUEST_ROW_IDS,
  TEXT_LINE_MAP,
  TOWNER_MAP,
} from '@/lib/catalog/ingest/diablo1Dialogue';

const TOWNER_HEADER = 'type name position_x position_y direction animWidth animPath animFrames animDelay gossipTexts animOrder'.split(' ');
const TEXT_HEADER = 'txtstrid txtstr scrlltxt sfxnr'.split(' ');
const QUEST_DIALOG_HEADER = 'towner_type Q_ROCK Q_MUSHROOM Q_GARBUD Q_ZHAR Q_VEIL Q_DIABLO Q_BUTCHER Q_LTBANNER Q_BLIND Q_BLOOD Q_ANVIL Q_WARLORD Q_SKELKING Q_PWATER Q_SCHAMB Q_BETRAYER Q_GRAVE Q_TRADER'.split(' ');
const QUEST_HEADER = 'qdlvl qdmultlvl qlvlt bookOrder qdrnd qslvl isSinglePlayerOnly qdmsg qlstr'.split(' ');

describe('Diablo I dialogue maps', () => {
  const tables = [
    [TOWNER_HEADER, TOWNER_MAP],
    [TEXT_HEADER, TEXT_LINE_MAP],
    [QUEST_DIALOG_HEADER, QUEST_DIALOG_MAP],
    [QUEST_HEADER, QUEST_MAP],
  ] as const;

  it('classifies every column of all four real upstream headers', () => {
    for (const [header, map] of tables) {
      const audit = auditColumns([...header], map);
      expect(audit.unclassified).toEqual([]);
      expect(audit.declaredButAbsent).toEqual([]);
    }
  });

  it('gives every dropped or gap classification a substantive reason', () => {
    for (const [header, map] of tables) {
      const audit = auditColumns([...header], map);
      for (const gap of audit.gap) expect(gap.why.length).toBeGreaterThan(20);
      for (const column of audit.dropped) {
        const rule = map[column];
        expect(rule.kind).toBe('dropped');
        if (rule.kind === 'dropped') expect(rule.why.length).toBeGreaterThan(20);
      }
    }
  });

  it('uses the complete quest_id enum order for the keyless quest table', () => {
    expect(QUEST_ROW_IDS).toHaveLength(24);
    expect(QUEST_ROW_IDS[0]).toBe('Q_ROCK');
    expect(QUEST_ROW_IDS.at(-1)).toBe('Q_JERSEY');
  });

  it('derives the base-game and Hellfire split from quest enum identity', () => {
    expect(QUEST_DERIVE.derive({ id: 'd1-Q_BETRAYER', data: {} })).toEqual({ expansion: 'diablo' });
    expect(QUEST_DERIVE.derive({ id: 'd1-Q_GRAVE', data: {} })).toEqual({ expansion: 'hellfire' });
    expect(QUEST_DERIVE.derive({ id: 'd1-Q_JERSEY', data: {} })).toEqual({ expansion: 'hellfire' });
  });
});

describe('dialogue projections', () => {
  it('splits gossip into dialog-tree links and reports repeated towner keys', () => {
    const row = (type: string, gossipTexts: string) => {
      const values: Record<string, string> = { type, gossipTexts };
      return TOWNER_HEADER.map((column) => values[column] ?? '').join('\t');
    };
    const input = [
      TOWNER_HEADER.join('\t'),
      row('TOWN_COW', 'TEXT_SYNTH_A,TEXT_SYNTH_B'),
      row('TOWN_COW', ''),
      row('TOWN_COW', ''),
    ].join('\n');
    const result = ingestTable(input, {
      catalogId: 'characters', sourceFile: 'towners/towners.tsv', keyColumn: 'type',
      map: TOWNER_MAP, provenanceFor, idPrefix: 'd1',
    });
    expect(result.entities[0].links).toEqual([
      { catalogId: 'dialog-trees', entityId: 'TEXT_SYNTH_A', role: 'gossip' },
      { catalogId: 'dialog-trees', entityId: 'TEXT_SYNTH_B', role: 'gossip' },
    ]);
    expect(result.duplicateKeys).toEqual([{ key: 'TOWN_COW', rows: [0, 1, 2] }]);
    expect(result.entities).toHaveLength(3);
  });

  it('uses a line id as the entity name when no source column maps to name', () => {
    const input = [TEXT_HEADER.join('\t'), ['TEXT_SYNTH', 'invented line', 'true', 'SYNTH_VOICE'].join('\t')].join('\n');
    const result = ingestTable(input, {
      catalogId: 'dialog-trees', sourceFile: 'text/textdat.tsv', keyColumn: 'txtstrid',
      map: TEXT_LINE_MAP, provenanceFor, idPrefix: 'd1',
    });
    expect(result.entities[0]).toMatchObject({ id: 'd1-TEXT_SYNTH', name: 'TEXT_SYNTH' });
    expect(result.entities[0].data).toEqual({ text: 'invented line', scrolling: 'true', voiceClip: 'SYNTH_VOICE' });
  });

  it('keeps the quest label and drops TEXT_NONE from quest talk', () => {
    const values: Record<string, string> = {
      towner_type: 'TOWN_SYNTH', Q_ROCK: 'TEXT_SYNTH', Q_MUSHROOM: 'TEXT_NONE',
    };
    const input = [QUEST_DIALOG_HEADER.join('\t'), QUEST_DIALOG_HEADER.map((column) => values[column] ?? '').join('\t')].join('\n');
    const result = ingestTable(input, {
      catalogId: 'dialog-trees', sourceFile: 'towners/quest_dialog.tsv', keyColumn: 'towner_type',
      map: QUEST_DIALOG_MAP, provenanceFor, idPrefix: 'd1',
    });
    expect(result.entities[0].data.questTalk).toEqual([{ label: 'Q_ROCK', value: 'TEXT_SYNTH' }]);
  });

  it('maps a quest-log line and drops fixed-level sentinels', () => {
    const values: Record<string, string> = {
      qdlvl: '101', qdmultlvl: '-1', qlvlt: '', bookOrder: '202', qdrnd: '303',
      qslvl: 'SL_NONE', isSinglePlayerOnly: 'true', qdmsg: 'TEXT_SYNTH', qlstr: 'Synthetic quest',
    };
    const input = [QUEST_HEADER.join('\t'), QUEST_HEADER.map((column) => values[column] ?? '').join('\t')].join('\n');
    const result = ingestTable(input, {
      catalogId: 'quests', sourceFile: 'quests/questdat.tsv', map: QUEST_MAP,
      provenanceFor, idPrefix: 'd1', rowIds: ['Q_ROCK'],
    });
    expect(result.entities[0].links).toEqual([
      { catalogId: 'dialog-trees', entityId: 'TEXT_SYNTH', role: 'quest-log-line' },
    ]);
    expect(result.entities[0].data).toMatchObject({
      dungeonLevel: '101', logOrder: '202', singlePlayerOnly: 'true',
    });
    expect(result.entities[0].data.dungeonLevelMultiplayer).toBeUndefined();
    expect(result.entities[0].data.setLevel).toBeUndefined();
  });
});
