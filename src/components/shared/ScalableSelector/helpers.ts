import type { SelectorItem, SelectorGroup as GroupT } from './types';

export function groupItems<T extends SelectorItem>(
  items: T[],
  groupBy?: keyof T,
): GroupT<T>[] {
  if (!groupBy) {
    return [{ key: '__all', label: 'All', items }];
  }
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = String(item[groupBy] ?? 'Other');
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    items: groupItems,
  }));
}

export function collectItemIds<T extends SelectorItem>(
  groups: GroupT<T>[],
  collapsedGroups: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const g of groups) {
    if (!collapsedGroups.has(g.key)) {
      for (const item of g.items) ids.push(item.id);
    }
  }
  return ids;
}
