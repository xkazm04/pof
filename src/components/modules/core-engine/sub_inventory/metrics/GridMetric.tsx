'use client';

import { useMemo } from 'react';
import { EQUIPMENT_SLOTS, ACCENT, ALL_ITEM_TYPES, type ItemData } from '../_shared/data';
import { useInventoryItems } from '../_shared/useInventoryItems';
import { withOpacity, OPACITY_50, STATUS_ERROR, STATUS_INFO, STATUS_SUCCESS, STATUS_WARNING, ACCENT_PURPLE, ACCENT_ORANGE } from '@/lib/chart-colors';

const slotCount = EQUIPMENT_SLOTS.length;

/** One distinct segment colour per item type (every member of ALL_ITEM_TYPES). */
export const TYPE_COLORS: Record<ItemData['type'], string> = {
  Weapon: STATUS_ERROR,
  Armor: STATUS_INFO,
  Accessory: ACCENT_PURPLE,
  Consumable: STATUS_SUCCESS,
  Quest: STATUS_WARNING,
  Material: ACCENT_ORANGE,
};

const COLOR_BY_TYPE: Record<string, string> = TYPE_COLORS;

export function GridMetric() {
  // The catalog store is the system of record for which items exist (not the static seed list).
  const items = useInventoryItems();
  const { itemCount, typeCounts, typeSegments } = useMemo(() => {
    const counts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});
    return {
      itemCount: items.length,
      typeCounts: counts,
      typeSegments: Object.entries(counts).map(([type, count]) => ({
        type,
        pct: (count / Math.max(items.length, 1)) * 100,
        color: COLOR_BY_TYPE[type] ?? ACCENT,
      })),
    };
  }, [items]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-px h-3 w-8 shrink-0" aria-hidden="true">
        {typeSegments.map((seg) => (
          <div
            key={seg.type}
            className="h-full rounded-sm"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
            title={`${seg.type}: ${typeCounts[seg.type]}`}
          />
        ))}
      </div>
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{itemCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> items / </span>
        <span className="font-bold" style={{ color: ACCENT }}>{slotCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> slots</span>
      </div>
    </div>
  );
}
