/** Diablo I unique items (items/unique_itemdat.tsv) -> PoF's `items` catalog (/diablo W23). */
import { mapped, dropped, type FieldMap } from '@/lib/catalog/ingest/fieldMap';

export const UNIQUE_ITEM_MAP: FieldMap = {
  name: mapped('name'),
  cursorGraphic: dropped('inventory sprite override; PoF re-authors item presentation rather than carrying source cursor ids'),
  // Both item tables parse this column as the same unique_base_item enum
  // (.reference/devilutionX/Source/tables/itemdat.cpp:583,647). The cross-table
  // base-item links are added after every wrapper is available (reference/links.ts).
  uniqueBaseItem: mapped('data.uniqueBase'),
  // GetValidUniques requires this gate as well as the base enum match
  // (.reference/devilutionX/Source/items.cpp:1417-1427).
  minLevel: mapped('data.dropLevel'),
  value: mapped('data.stats[Value]'),
  // The loader reads at most six consecutive slots in order, and GetUniqueItem applies
  // that same order through SaveItemPower (.reference/devilutionX/Source/tables/itemdat.cpp:651-656;
  // .reference/devilutionX/Source/items.cpp:1452-1459).
  power0: mapped('data.powers[0].power'),
  'power0.value1': mapped('data.powers[0].min'),
  'power0.value2': mapped('data.powers[0].max'),
  power1: mapped('data.powers[1].power'),
  'power1.value1': mapped('data.powers[1].min'),
  'power1.value2': mapped('data.powers[1].max'),
  power2: mapped('data.powers[2].power'),
  'power2.value1': mapped('data.powers[2].min'),
  'power2.value2': mapped('data.powers[2].max'),
  power3: mapped('data.powers[3].power'),
  'power3.value1': mapped('data.powers[3].min'),
  'power3.value2': mapped('data.powers[3].max'),
  power4: mapped('data.powers[4].power'),
  'power4.value1': mapped('data.powers[4].min'),
  'power4.value2': mapped('data.powers[4].max'),
  power5: mapped('data.powers[5].power'),
  'power5.value1': mapped('data.powers[5].min'),
  'power5.value2': mapped('data.powers[5].max'),
};
