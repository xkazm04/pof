import { describe, expect, it } from 'vitest';
import { MISSILE_COLUMNS, MISSILE_MAP } from '@/lib/catalog/ingest/diablo1Missiles';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { resolveLinks } from '@/lib/catalog/reference/links';

const table = DIABLO1.tables.find((candidate) => candidate.file === 'missiles/misdat.tsv')!;

const row = (values: Record<string, string>): string => [
  MISSILE_COLUMNS.join('\t'),
  MISSILE_COLUMNS.map((column) => values[column] ?? '').join('\t'),
].join('\n');

describe('Diablo I missile mapping', () => {
  it('pins the eight real upstream column names and classifies every one', () => {
    expect(MISSILE_COLUMNS).toEqual([
      'id', 'addFn', 'processFn', 'castSound', 'hitSound', 'graphic', 'flags', 'movementDistribution',
    ]);
    const audit = auditColumns([...MISSILE_COLUMNS], MISSILE_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
    expect(audit.mapped).toHaveLength(8);
    expect(audit.dropped).toEqual([]);
    expect(audit.gap).toEqual([]);
  });

  it('registers misdat as a vfx table keyed by id', () => {
    expect(table).toMatchObject({ catalogId: 'vfx', keyColumn: 'id', map: MISSILE_MAP });
  });

  it('keeps a blank id as positional identity and omits blank cells', () => {
    const result = wrapTable(DIABLO1, table, row({ flags: 'Magic,Invisible' }), 't0');
    expect(result.wrappers[0]).toMatchObject({ key: 'row0', keyKind: 'positional' });
    expect(result.wrappers[0].entity.id).toBe('d1-row0');
    expect(result.wrappers[0].entity.data.graphic).toBeUndefined();
    expect(result.wrappers[0].entity.data.flags).toEqual(['Magic', 'Invisible']);
  });

  it('records a prefixed sprite reference for link resolution', () => {
    const missile = wrapTable(DIABLO1, table, row({ id: 'SyntheticMissile', graphic: 'SyntheticSprite' }), 't0').wrappers[0];
    const target = {
      ...missile,
      wrapperId: 'test:sprite',
      file: 'missiles/missile_sprites.tsv',
      key: 'SyntheticSprite',
      entity: {
        ...missile.entity,
        id: 'd1-sprite-SyntheticSprite',
        links: undefined,
      },
    };
    const resolved = resolveLinks([missile, target], 'd1');
    expect(resolved.report).toEqual({ resolved: 1, unresolved: [] });
    expect(resolved.wrappers[0].entity.data.graphic).toBe('SyntheticSprite');
    expect(resolved.wrappers[0].entity.links).toEqual([
      { catalogId: 'vfx', entityId: 'd1-sprite-SyntheticSprite', role: 'sprite' },
    ]);
  });
});

