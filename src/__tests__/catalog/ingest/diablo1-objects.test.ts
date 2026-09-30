import { describe, expect, it } from 'vitest';
import { applyDecode } from '@/lib/catalog/ingest/decode';
import { OBJECT_MAP } from '@/lib/catalog/ingest/diablo1Objects';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { ingestTable } from '@/lib/catalog/ingest/run';
import { DIABLO1, type ReferenceSource } from '@/lib/catalog/reference/sources';
import { resolveLinks } from '@/lib/catalog/reference/links';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

// Column names are schema, not reference-game row values.
const OBJECT_HEADER = 'id file minLevel maxLevel levelType theme quest flags animDelay animLen animWidth selectionRegion'.split(' ');

const source: ReferenceSource = {
  ...DIABLO1,
  tables: [],
};

function wrapper(entity: ReturnType<typeof ingestTable>['entities'][number], key: string): ReferenceWrapper {
  return {
    wrapperId: `invented:${key}`,
    sourceId: source.id,
    file: 'invented.tsv',
    technique: 'tsv@1',
    key,
    keyKind: 'column',
    raw: { id: key },
    rawHash: 'invented',
    catalogId: entity.catalogId,
    entity,
    mappingVersion: 'invented',
  };
}

describe('Diablo I object mapping', () => {
  it('pins the 12 real column names and classifies every one', () => {
    expect(OBJECT_HEADER).toHaveLength(12);
    const audit = auditColumns(OBJECT_HEADER, OBJECT_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit.mapped).toHaveLength(7);
    expect(audit.dropped).toHaveLength(5);
  });

  it('maps depth labels, dungeon/theme fields, quest links and split flags from invented data', () => {
    const row = [
      'OBJ_SYNTH', 'synthetic.cel', '2', '7', 'DTYPE_SYNTH', 'THEME_SYNTH', 'Q_SYNTH',
      'Solid, Trap', '3', '9', '96', 'Bottom',
    ].join('\t');
    const tsv = [OBJECT_HEADER.join('\t'), row].join('\n');
    const result = ingestTable(tsv, {
      catalogId: 'props', sourceFile: 'objects/invented.tsv', keyColumn: 'id', map: OBJECT_MAP,
      idPrefix: 'd1',
      provenanceFor: (sourceFile, sourceRow) => ({
        kind: 'ingest', sourceGame: 'Invented', sourceProject: 'Test', sourceFile, sourceRow,
        licenceNote: 'Invented fixture', ingestedAt: '2026-01-01T00:00:00.000Z', canonProfile: 'diablo1',
      }),
    });
    const entity = result.entities[0];
    expect(entity.id).toBe('d1-OBJ_SYNTH');
    expect(entity.data.spawnDepth).toEqual([{ label: 'min', value: '2' }, { label: 'max', value: '7' }]);
    expect(entity.data.dungeonType).toBe('DTYPE_SYNTH');
    expect(entity.data.theme).toBe('THEME_SYNTH');
    expect(entity.data.flags).toEqual(['Solid', 'Trap']);
    expect(entity.links).toEqual([{ catalogId: 'quests', entityId: 'Q_SYNTH', role: 'quest' }]);
    expect(entity.data.animDelay).toBeUndefined();
  });

  it('treats blank theme and quest cells as none, and resolves a quest enum to d1-Q_*', () => {
    const decode = OBJECT_MAP.flags.kind === 'mapped' ? OBJECT_MAP.flags.decode : undefined;
    expect(applyDecode('Animated, Solid, Light', decode)).toEqual(['Animated', 'Solid', 'Light']);

    const opts = {
      catalogId: 'props', sourceFile: 'objects/invented.tsv', keyColumn: 'id', map: OBJECT_MAP, idPrefix: 'd1',
      provenanceFor: (sourceFile: string, sourceRow: string) => ({
        kind: 'ingest' as const, sourceGame: 'Invented', sourceProject: 'Test', sourceFile, sourceRow,
        licenceNote: 'Invented fixture', ingestedAt: '2026-01-01T00:00:00.000Z', canonProfile: 'diablo1',
      }),
    };
    const blank = ingestTable(`${OBJECT_HEADER.join('\t')}\nOBJ_BLANK\t\t\t\t\t\t\t\t\t\t\t`, opts).entities[0];
    expect(blank.data.theme).toBeUndefined();
    expect(blank.links).toBeUndefined();

    const object = ingestTable(`${OBJECT_HEADER.join('\t')}\nOBJ_LINK\t\t\t\t\t\tQ_SYNTH\t\t\t\t\t`, opts).entities[0];
    const quest = { ...object, id: 'd1-Q_SYNTH', catalogId: 'quests', links: undefined };
    const resolved = resolveLinks([wrapper(object, 'OBJ_LINK'), wrapper(quest, 'Q_SYNTH')], 'd1');
    expect(resolved.wrappers[0].entity.links).toEqual([
      { catalogId: 'quests', entityId: 'd1-Q_SYNTH', role: 'quest' },
    ]);
    expect(resolved.report.unresolved).toEqual([]);
  });

  it('registers objdat as a props table', () => {
    expect(DIABLO1.tables.find((table) => table.file === 'objects/objdat.tsv')).toMatchObject({
      catalogId: 'props', keyColumn: 'id', map: OBJECT_MAP,
    });
  });
});
