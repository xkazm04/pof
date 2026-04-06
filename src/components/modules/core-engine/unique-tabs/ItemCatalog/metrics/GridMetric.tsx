'use client';

import { DUMMY_ITEMS, EQUIPMENT_SLOTS, ACCENT } from '../data';
import { withOpacity, OPACITY_50, STATUS_ERROR, STATUS_INFO, STATUS_SUCCESS } from '@/lib/chart-colors';

const itemCount = DUMMY_ITEMS.length;
const slotCount = EQUIPMENT_SLOTS.length;

const TYPE_COLORS: Record<string, string> = {
  Weapon: STATUS_ERROR,
  Armor: STATUS_INFO,
  Consumable: STATUS_SUCCESS,
};

const typeCounts = DUMMY_ITEMS.reduce<Record<string, number>>((acc, item) => {
  acc[item.type] = (acc[item.type] ?? 0) + 1;
  return acc;
}, {});

const typeSegments = Object.entries(typeCounts).map(([type, count]) => ({
  type,
  pct: (count / itemCount) * 100,
  color: TYPE_COLORS[type] ?? ACCENT,
}));

export function GridMetric() {
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
