/** Resolve DevilutionX `_item_indexes` ids through their itemdat row ordinals. */
import { DIABLO1_ITEM_ENUM_ORDINALS_DATA } from '@/lib/catalog/ingest/diablo1ItemEnumsData';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const ITEM_ENUM_ORDINALS: Readonly<Record<string, number>> = DIABLO1_ITEM_ENUM_ORDINALS_DATA;

export function itemEnumOrdinal(itemId: string): number | undefined {
  return ITEM_ENUM_ORDINALS[itemId.trim().toUpperCase()];
}

/**
 * Resolve a named engine item id to its itemdat wrapper. Named cells win; otherwise the
 * `_item_indexes` ordinal addresses the wrapper's positional `rowN` key.
 */
export function itemWrapperByEnumId(
  wrappers: readonly ReferenceWrapper[],
  itemId: string,
): ReferenceWrapper | undefined {
  const normalized = itemId.trim().toUpperCase();
  const direct = wrappers.find((wrapper) => wrapper.file === 'items/itemdat.tsv'
    && String(wrapper.raw.id ?? '').trim().toUpperCase() === normalized);
  if (direct) return direct;
  const ordinal = itemEnumOrdinal(normalized);
  if (ordinal === undefined || ordinal < 0) return undefined;
  return wrappers.find((wrapper) => wrapper.file === 'items/itemdat.tsv'
    && wrapper.key === `row${ordinal}`);
}
