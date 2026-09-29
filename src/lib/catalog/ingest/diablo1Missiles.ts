/** Diablo I missile-table schema mapping. Reference row values remain outside the repository. */
import { split } from '@/lib/catalog/ingest/decode';
import { mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';

/**
 * The generic mapper records compound cells without interpreting engine enums. Promotion through
 * `withMissileSpecs` normalizes the labelled behaviour/sound fields, flags, and blockability.
 */
export const MISSILE_MAP: FieldMap = {
  id: mapped('id'),
  addFn: mapped('data.behaviour[addFn]'),
  processFn: mapped('data.behaviour[processFn]'),
  castSound: mapped('data.sounds[cast]'),
  hitSound: mapped('data.sounds[hit]'),
  graphic: mapped('data.graphic'),
  flags: mapped('data.flags[]', split(',')),
  movementDistribution: mapped('data.blockable'),
};

export const MISSILE_COLUMNS = [
  'id',
  'addFn',
  'processFn',
  'castSound',
  'hitSound',
  'graphic',
  'flags',
  'movementDistribution',
] as const;

