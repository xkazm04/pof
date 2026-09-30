import { describe, expect, it } from 'vitest';
import {
  MISSILE_SPRITE_COLUMNS,
  MISSILE_SPRITE_MAP,
} from '@/lib/catalog/ingest/diablo1MissileSprites';
import { auditColumns } from '@/lib/catalog/ingest/fieldMap';
import { DIABLO1 } from '@/lib/catalog/reference/sources';
import { wrapTable } from '@/lib/catalog/reference/wrapper';

const table = DIABLO1.tables.find((candidate) => candidate.file === 'missiles/missile_sprites.tsv')!;
const directions = (offset = 0) => Array.from({ length: 16 }, (_, index) => String(index + offset)).join(',');
const row = (values: Record<string, string>): string => [
  MISSILE_SPRITE_COLUMNS.join('\t'),
  MISSILE_SPRITE_COLUMNS.map((column) => values[column] ?? '').join('\t'),
].join('\n');

describe('Diablo I missile sprite mapping', () => {
  it('pins the eight upstream column names and classifies every one', () => {
    expect(MISSILE_SPRITE_COLUMNS).toEqual([
      'id', 'width', 'width2', 'name', 'numFrames', 'flags', 'frameDelay', 'frameLength',
    ]);
    const audit = auditColumns([...MISSILE_SPRITE_COLUMNS], MISSILE_SPRITE_MAP);
    expect(audit).toMatchObject({
      mapped: [...MISSILE_SPRITE_COLUMNS], dropped: [], gap: [], unclassified: [], declaredButAbsent: [],
    });
  });

  it('registers prefixed vfx reference wrappers and decodes frame metadata', () => {
    expect(table).toMatchObject({
      catalogId: 'vfx', keyColumn: 'id', keyPrefix: 'sprite-', map: MISSILE_SPRITE_MAP,
    });
    const result = wrapTable(DIABLO1, table, row({
      id: 'SyntheticSprite', width: '111', width2: '23', name: 'synthetic-file', numFrames: '7',
      flags: 'MonsterOwned,NotAnimated', frameDelay: directions(), frameLength: directions(20),
    }), 't0');
    expect(result.audit.unclassified).toEqual([]);
    expect(result.wrappers[0]).toMatchObject({ key: 'SyntheticSprite', keyKind: 'column' });
    expect(result.wrappers[0].entity).toMatchObject({
      id: 'd1-sprite-SyntheticSprite',
      data: {
        frame: { width: 111, offsetX: 23 },
        spriteFile: 'synthetic-file',
        frames: 7,
        flags: { monsterOwned: true, animated: false },
        frameDelay: Array.from({ length: 16 }, (_, index) => index),
        frameLength: Array.from({ length: 16 }, (_, index) => index + 20),
      },
    });
  });

  it('omits a blank sprite file and refuses direction arrays that are not 16 entries', () => {
    const blank = wrapTable(DIABLO1, table, row({
      id: 'BlankSprite', width: '1', width2: '0', numFrames: '1',
      frameDelay: directions(), frameLength: directions(),
    }), 't0').wrappers[0];
    expect(blank.entity.data.spriteFile).toBeUndefined();
    expect(() => wrapTable(DIABLO1, table, row({
      id: 'ShortSprite', width: '1', width2: '0', numFrames: '1',
      frameDelay: directions().split(',').slice(0, 15).join(','), frameLength: directions(),
    }), 't0')).toThrow(/expected 16 entries, got 15/);
  });
});
