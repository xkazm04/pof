/** Diablo I missile-sprite-table schema mapping. Reference row values remain outside the repository. */
import { booleanFlags, integer, integerList } from '@/lib/catalog/ingest/decode';
import { mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';

export const MISSILE_SPRITE_MAP: FieldMap = {
  id: mapped('id'),
  width: mapped('data.frame{width}', integer()),
  width2: mapped('data.frame{offsetX}', integer()),
  name: mapped('data.spriteFile'),
  numFrames: mapped('data.frames', integer()),
  flags: mapped('data.flags', booleanFlags({
    MonsterOwned: { key: 'monsterOwned', value: true },
    NotAnimated: { key: 'animated', value: false },
  })),
  frameDelay: mapped('data.frameDelay', integerList(16)),
  frameLength: mapped('data.frameLength', integerList(16)),
};

export const MISSILE_SPRITE_COLUMNS = [
  'id',
  'width',
  'width2',
  'name',
  'numFrames',
  'flags',
  'frameDelay',
  'frameLength',
] as const;
