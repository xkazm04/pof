'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DUMMY_ITEMS, RARITY_COLORS, type ItemData } from '../../_shared/data';
import { getItemFootprint } from '@/lib/spatial-inventory';
import { setDragIntent } from './spatialDragState';
import {
  withOpacity, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_50,
  STATUS_SUBDUED, OVERLAY_WHITE,
} from '@/lib/chart-colors';

interface Props {
  accent: string;
}

const TYPE_OPTIONS = ['all', 'Weapon', 'Armor', 'Accessory', 'Consumable', 'Material', 'Quest'] as const;

export function SpatialStashPalette({ accent }: Props) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>('all');

  const items = useMemo(() => {
    let pool: ItemData[] = DUMMY_ITEMS;
    if (type !== 'all') pool = pool.filter((i) => i.type === type);
    if (q) {
      const lower = q.toLowerCase();
      pool = pool.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          i.subtype.toLowerCase().includes(lower),
      );
    }
    return pool.slice(0, 40);
  }, [q, type]);

  return (
    <div className="flex flex-col gap-2 w-full max-w-[280px]">
      <div className="flex items-center gap-1.5">
        <Search className="w-3 h-3 text-text-muted flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items…"
          className="w-full text-xs font-mono px-2 py-1 rounded-md bg-surface-deep border outline-none"
          style={{ borderColor: withOpacity(accent, OPACITY_25) }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border transition-colors"
            style={{
              color: type === t ? accent : 'var(--text-muted)',
              borderColor: withOpacity(accent, type === t ? OPACITY_50 : OPACITY_15),
              backgroundColor: withOpacity(accent, type === t ? OPACITY_15 : '00'),
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        className="flex flex-col gap-1 max-h-[260px] overflow-y-auto custom-scrollbar pr-1"
        aria-label="Drag items into the stash grid"
      >
        {items.map((item) => (
          <PaletteRow key={item.id} item={item} />
        ))}
        {items.length === 0 && (
          <p className="text-[10px] font-mono text-text-muted py-2">No items match.</p>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  item: ItemData;
}

function PaletteRow({ item }: RowProps) {
  const fp = getItemFootprint(item);
  const color = RARITY_COLORS[item.rarity] ?? STATUS_SUBDUED;
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', item.id);
    setDragIntent({ kind: 'new', itemId: item.id, footprint: fp, rotated: false });
  };
  const onDragEnd = () => setDragIntent(null);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-2 px-2 py-1 rounded-md border cursor-grab active:cursor-grabbing"
      style={{
        borderColor: withOpacity(color, OPACITY_25),
        backgroundColor: withOpacity(color, OPACITY_8),
      }}
      title={`${item.name} — ${item.rarity} ${item.subtype} (${fp.w}×${fp.h})`}
    >
      <span
        className="text-[9px] font-mono font-bold w-7 text-center rounded px-0.5"
        style={{
          backgroundColor: withOpacity(OVERLAY_WHITE, '10'),
          color,
        }}
      >
        {fp.w}×{fp.h}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color }}>
          {item.name}
        </div>
        <div className="text-[10px] font-mono text-text-muted truncate">
          {item.subtype}
        </div>
      </div>
    </div>
  );
}
