import { describe, expect, it } from 'vitest';
import { getTechnique, parseTsvKv, techniqueLabel } from '@/lib/catalog/reference/techniques';

describe('tsv-kv reading technique', () => {
  it('transposes Attribute/Value rows into one record and tolerates blank lines', () => {
    const table = parseTsvKv([
      'Attribute\tValue',
      'alpha\t101',
      '',
      'beta\tinvented',
    ].join('\n'));
    expect(table.columns).toEqual(['alpha', 'beta']);
    expect(table.rows).toEqual([{ alpha: '101', beta: 'invented' }]);
    expect(table.malformed).toEqual([]);
  });

  it('keeps the first value and reports a duplicate attribute', () => {
    const table = parseTsvKv([
      'Attribute\tValue',
      'alpha\t101',
      '',
      'alpha\t202',
    ].join('\n'));
    expect(table.columns).toEqual(['alpha']);
    expect(table.rows).toEqual([{ alpha: '101' }]);
    expect(table.malformed).toEqual([{ line: 4, expected: 1, actual: 2, raw: 'alpha\t202' }]);
  });

  it('is registered and version-labelled independently from ordinary TSV', () => {
    expect(techniqueLabel(getTechnique('tsv-kv'))).toBe('tsv-kv@1');
  });
});
