import { describe, expect, it } from 'vitest';
import { experienceCurve } from '@/lib/catalog/reference/experienceCurve';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const spec = DIABLO1.tables.find((table) => table.file === 'Experience.tsv')!;

describe('experienceCurve', () => {
  it('aggregates synthetic thresholds in ascending level order and reports maxLevel', () => {
    const wrappers = wrapTable(DIABLO1, spec, [
      'Level\tExperience',
      '12\t1212',
      '3\t303',
      '8\t808',
    ].join('\n'), 't0').wrappers;
    const [curve] = experienceCurve(wrappers);
    expect(curve.catalogId).toBe('progression-curves');
    expect(curve.entity).toMatchObject({ id: 'd1-xp-curve', name: 'Diablo I experience curve' });
    expect(curve.entity.data).toEqual({
      levels: [
        { level: 3, experience: 303 },
        { level: 8, experience: 808 },
        { level: 12, experience: 1212 },
      ],
      maxLevel: 12,
    });
  });

  it('returns no aggregate when no valid progression rows are present', () => {
    expect(experienceCurve([])).toEqual([]);
  });
});
