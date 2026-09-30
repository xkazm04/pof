import { describe, expect, it } from 'vitest';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { UNIQUE_MAP } from '@/lib/catalog/ingest/diablo1Uniques';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const HEADER = 'type name trn level maxHp ai intelligence minDamage maxDamage reducePlayerStrength reducePlayerMagic reducePlayerDexterity reducePlayerVitality reducePlayerMaxHP reducePlayerMaxMana resistance monsterPack customToHit customArmorClass talkMessage'.split(' ');
const spec = DIABLO1.tables.find((table) => table.file === 'monsters/unique_monstdat.tsv')!;

function row(values: Record<string, string>): string {
  return HEADER.map((column) => values[column] ?? '').join('\t');
}

describe('Diablo I unique-monster mapping', () => {
  it('pins all 20 upstream column names and classifies every one', () => {
    expect(HEADER).toHaveLength(20);
    const audit = auditColumns(HEADER, UNIQUE_MAP);
    expect(audit.unclassified).toEqual([]);
    expect(audit.declaredButAbsent).toEqual([]);
  });

  it('creates linked, slugged unique wrappers and drops zero custom-stat sentinels', () => {
    const text = [
      HEADER.join('\t'),
      row({
        type: 'MT_SYNTH', name: 'The Synthetic One', trn: 'synth', level: '0', maxHp: '222',
        ai: 'SyntheticAI', intelligence: '3', minDamage: '7', maxDamage: '11',
        resistance: 'RESIST_FIRE,IMMUNE_MAGIC', monsterPack: 'Independent',
        customToHit: '0', customArmorClass: '0', talkMessage: 'TEXT_SYNTH',
      }),
    ].join('\n');
    const result = wrapTable(DIABLO1, spec, text, 't0');
    const wrapper = result.wrappers[0];
    expect(wrapper.entity.id).toBe('d1-uniq-the-synthetic-one');
    expect(wrapper.entity.links).toEqual([
      { catalogId: 'bestiary', entityId: 'd1-MT_SYNTH', role: 'base' },
      { catalogId: 'dialog-trees', entityId: 'd1-TEXT_SYNTH', role: 'talk-line' },
    ]);
    expect(wrapper.entity.data).toMatchObject({ pack: 'Independent', intelligence: '3' });
    expect((wrapper.entity.data.stats as { label: string }[]).map((stat) => stat.label)).not.toContain('Level');
    expect(wrapper.entity.data.customToHit).toBeUndefined();
    expect(wrapper.entity.data.customArmorClass).toBeUndefined();
    const untransformedVersion = wrapTable(DIABLO1, { ...spec, keyDecode: undefined }, text, 't0').mappingVersion;
    expect(result.mappingVersion).not.toBe(untransformedVersion);
  });

  it('reports colliding slugs and keeps both rows', () => {
    const text = [
      HEADER.join('\t'),
      row({ type: 'MT_ALPHA', name: 'Synthetic One' }),
      row({ type: 'MT_BETA', name: 'Synthetic---One' }),
    ].join('\n');
    const result = wrapTable(DIABLO1, spec, text, 't0');
    expect(result.duplicateKeys).toEqual([{ key: 'synthetic-one', rows: [0, 1] }]);
    expect(result.wrappers).toHaveLength(2);
    expect(result.wrappers[0].wrapperId).not.toBe(result.wrappers[1].wrapperId);
  });
});
