/** Diablo I object-table schema mapping. Reference values remain outside the repository. */
import { split } from '@/lib/catalog/ingest/decode';
import { dropped, mapped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';

export const OBJECT_MAP: FieldMap = {
  id: mapped('id'),
  file: dropped('sprite-file selector; presentation is rebuilt by the target engine'),
  minLevel: mapped('data.spawnDepth[min]'),
  maxLevel: mapped('data.spawnDepth[max]'),
  levelType: mapped('data.dungeonType'),
  // Empty cells are the table sentinel for no required theme; the generic decoder omits blanks.
  theme: mapped('data.theme'),
  // Empty cells mean no quest. Non-empty Q_* enum names resolve to d1-Q_* wrappers after ingest.
  quest: mapped('links[role=quest]'),
  flags: mapped('data.flags[]', split(',')),
  animDelay: dropped('source-sprite animation timing; the target prop owns its animation timing'),
  animLen: dropped('source-sprite animation frame count; the target prop owns its animation clips'),
  animWidth: dropped('source-sprite frame width; renderer layout is not object behaviour'),
  selectionRegion: dropped('source mouse-picking region; target interaction geometry is authored separately'),
};
