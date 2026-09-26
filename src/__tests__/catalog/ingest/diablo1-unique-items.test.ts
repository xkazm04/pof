import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { affixTargetsOf } from '@/lib/catalog/ingest/diablo1Affixes';
import { UNIQUE_ITEM_MAP } from '@/lib/catalog/ingest/diablo1UniqueItems';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { parseTsv } from '@/lib/catalog/ingest/tsv';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

// assets/txtdata/items/unique_itemdat.tsv — schema only; source row values never enter the repo.
const HEADER = 'name cursorGraphic uniqueBaseItem minLevel value power0 power0.value1 power0.value2 power1 power1.value1 power1.value2 power2 power2.value1 power2.value2 power3 power3.value1 power3.value2 power4 power4.value1 power4.value2 power5 power5.value1 power5.value2'.split(' ');
const spec = DIABLO1.tables.find((table) => table.file === 'items/unique_itemdat.tsv')!;
const realTablePath = join(process.cwd(), '.reference/devilutionX/assets/txtdata/items/unique_itemdat.tsv');

function row(values: Record<string, string>): string {
  return HEADER.map((column) => values[column] ?? '').join('\t');
}

describe('Diablo I unique-item mapping', () => {
  it('pins and classifies all 23 upstream columns', () => {
    expect(HEADER).toHaveLength(23);
    const audit = auditColumns(HEADER, UNIQUE_ITEM_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
  });

  it('creates a slugged wrapper and compacts populated power slots in source order', () => {
    const text = [
      HEADER.join('\t'),
      row({
        name: 'Synthetic Blade', uniqueBaseItem: 'SYNTH_BASE', minLevel: '7', value: '123',
        power0: 'STR', 'power0.value1': '2', 'power0.value2': '4',
        power2: 'SETDAM', 'power2.value1': '5', 'power2.value2': '9',
      }),
    ].join('\n');
    const wrapper = wrapTable(DIABLO1, spec, text, 't0').wrappers[0];
    expect(wrapper.entity.id).toBe('d1-uitem-synthetic-blade');
    expect(wrapper.entity.data).toMatchObject({
      uniqueBase: 'SYNTH_BASE', dropLevel: '7',
      stats: [{ label: 'Value', value: '123' }],
      powers: [
        { power: 'STR', min: '2', max: '4' },
        { power: 'SETDAM', min: '5', max: '9' },
      ],
    });
  });

  it('reports duplicate slugs without dropping either source row', () => {
    const result = wrapTable(DIABLO1, spec, [
      HEADER.join('\t'),
      row({ name: 'Synthetic Edge' }),
      row({ name: 'Synthetic---Edge' }),
    ].join('\n'), 't0');
    expect(result.duplicateKeys).toEqual([{ key: 'synthetic-edge', rows: [0, 1] }]);
    expect(result.wrappers).toHaveLength(2);
    expect(result.wrappers[0].wrapperId).not.toBe(result.wrappers[1].wrapperId);
  });
});

describe('unique-item power vocabulary', () => {
  it('classifies every power used only by unique items, including the two not in the brief', () => {
    for (const power of [
      'SETAC', 'SETDAM', 'SETDUR', 'NOMINSTR', '3XDAMVDEM', 'RNDSTEALLIFE',
      'ONEHAND', 'SPELL', 'RNDARROWVEL', 'AC_CURSE', 'ALLRESZERO', 'DRAINLIFE',
    ]) {
      expect(affixTargetsOf(power), power).not.toBeNull();
    }
  });

  it.skipIf(!existsSync(realTablePath))('covers every power in the real table when the reference checkout is present', () => {
    const table = parseTsv(readFileSync(realTablePath, 'utf8'));
    const powers = new Set(table.rows.flatMap((record) =>
      Array.from({ length: 6 }, (_, index) => record[`power${index}`]).filter(Boolean)));
    for (const power of powers) expect(affixTargetsOf(power), power).not.toBeNull();
  });

  it('refuses an unknown power instead of silently dropping it', () => {
    expect(affixTargetsOf('SYNTH_UNKNOWN_POWER')).toBeNull();
  });
});
