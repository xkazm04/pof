// Real upstream schema names captured from DevilutionX. No class-stat or XP row values.
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import {
  CLASS_ATTRIBUTES_MAP,
  CLASSDAT_MAP,
  DIABLO1_CLASSES,
  EXPERIENCE_MAP,
} from '@/lib/catalog/ingest/diablo1Classes';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';
import { ingestSourceFromDir } from '@/lib/catalog/reference/ingestSource';

const CLASS_ATTRIBUTE_HEADER = 'classFlags baseStr baseMag baseDex baseVit maxStr maxMag maxDex maxVit blockBonus adjLife adjMana lvlLife lvlMana chrLife chrMana itmLife itmMana baseMagicToHit baseMeleeToHit baseRangedToHit'.split(' ');
const CLASSDAT_HEADER = 'className folderName portrait inv'.split(' ');
const EXPERIENCE_HEADER = ['Level', 'Experience'];

const inventedAttributes = (flags = '') => [
  'Attribute\tValue',
  ...CLASS_ATTRIBUTE_HEADER.map((attribute, index) => `${attribute}\t${attribute === 'classFlags' ? flags : 101 + index}`),
].join('\n');

describe('Diablo I class and experience maps', () => {
  it('pins and completely classifies the real upstream headers', () => {
    expect(CLASS_ATTRIBUTE_HEADER).toHaveLength(21);
    expect(CLASSDAT_HEADER).toHaveLength(4);
    expect(EXPERIENCE_HEADER).toHaveLength(2);
    for (const [columns, map] of [
      [CLASS_ATTRIBUTE_HEADER, CLASS_ATTRIBUTES_MAP],
      [CLASSDAT_HEADER, CLASSDAT_MAP],
      [EXPERIENCE_HEADER, EXPERIENCE_MAP],
    ] as const) {
      const audit = auditColumns([...columns], map);
      expect(audit.unclassified).toEqual([]);
      expect(audit.declaredButAbsent).toEqual([]);
    }
  });

  it('registers every class with stable identity, classdat name, flags, and expansion', () => {
    for (const { folder, name } of DIABLO1_CLASSES) {
      const spec = DIABLO1.tables.find((table) => table.file === `classes/${folder}/attributes.tsv`)!;
      const wrapper = wrapTable(DIABLO1, spec, inventedAttributes('FlagOne,FlagTwo'), 't0').wrappers[0];
      expect(wrapper.entity.id).toBe(`d1-class-${folder}`);
      expect(wrapper.entity.name).toBe(name);
      expect(wrapper.entity.data.classFlags).toEqual(['FlagOne', 'FlagTwo']);
      expect(wrapper.entity.data.derived).toEqual({
        expansion: ['monk', 'bard', 'barbarian'].includes(folder) ? 'hellfire' : 'diablo',
      });
      expect(wrapper.technique).toBe('tsv-kv@1');
    }
  });

  it('keys XP tier rows as d1-xp-<Level>', () => {
    const spec = DIABLO1.tables.find((table) => table.file === 'Experience.tsv')!;
    const wrapper = wrapTable(DIABLO1, spec, 'Level\tExperience\n7\t707', 't0').wrappers[0];
    expect(wrapper.entity.id).toBe('d1-xp-7');
    expect(wrapper.entity.data).toEqual({ level: '7', experienceToReach: '707' });
  });
});

describe('classdat manifest drift', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); });

  it('reports a class folder present in classdat but absent from registered class tables', () => {
    const readFile = (path: string) => {
      if (path.replace(/\\/g, '/').endsWith('classes/classdat.tsv')) {
        return [
          CLASSDAT_HEADER.join('\t'),
          'Invented Warrior\twarrior\t101\tinvented',
          'Invented Alchemist\talchemist\t202\tinvented',
        ].join('\n');
      }
      throw new Error('ENOENT');
    };
    const summary = ingestSourceFromDir('diablo1', '/data', { db, readFile, now: 't0' });
    expect(summary.manifests).toEqual([{
      file: 'classes/classdat.tsv', status: 'checked', unclassified: [], declaredButAbsent: [],
      malformed: 0, unregisteredKeys: ['alchemist'],
    }]);
  });
});
