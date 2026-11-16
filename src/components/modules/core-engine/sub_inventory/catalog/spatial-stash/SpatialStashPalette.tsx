'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { RARITY_COLORS, type ItemData } from '../../_shared/data';
import { useInventoryItems } from '../../_shared/useInventoryItems';
import { getItemFootprint } from '@/lib/spatial-inventory';
import { getDragIntent, setDragIntent } from './spatialDragState';
import {
  withOpacity, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_50,
  STATUS_SUBDUED, OVERLAY_WHITE,
} from '@/lib/chart-colors';

interface Props {
  accent: string;
}

/** Rows rendered at once; the overflow is announced, never silently dropped. */
const PALETTE_ROW_CAP = 40;

const TYPE_OPTIONS =['all', 'Weapon', 'Armor', 'Accessory', 'Consumable', 'Material', 'Quest'] as const;

export function SpatialStashPalette({ accent }: Props) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>('all');

  const catalogItems = useInventoryItems();
  const matches = useMemo(() => {
    let pool: ItemData[] = catalogItems;
    if (type !== 'all') pool = pool.filter((i) => i.type === type);
    if (q) {
      const lower = q.toLowerCase();
      pool = pool.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          i.subtype.toLowerCase().includes(lower),
      );
    }
    return { shown: pool.slice(0, PALETTE_ROW_CAP), total: pool.length };
  }, [catalogItems, q, type]);
  const { shown: items, total } = matches;

  return (
    <div className="flex flex-col gap-2 w-full max-w-[280px]">
      <div className="flex items-center gap-1.5">
        <Search className="w-3 h-3 text-text-muted flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items…"
          aria-label="Search stash palette items"
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
        {total > items.length && (
          <p role="status" className="text-xs font-mono text-text-muted py-1">
            Showing {items.length} of {total} — search or filter to reach the rest.
          </p>
        )}
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
  // Keyboard path: Enter/Space picks the footprint up; the grid then owns the
  // arrow / Enter / Escape / R keys until it is placed or cancelled.
  const onKeyDown = (e: React.KeyboardEvent) => {
    // While something is carried, Enter belongs to the grid (it drops the item).
    if (getDragIntent() || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragIntent({ kind: 'new', itemId: item.id, footprint: fp, rotated: false });
  };
  return (
    <div
      draggable
      data-palette-row
      tabIndex={0}
      role="button"
      aria-label={`Pick up ${item.name} (${fp.w}×${fp.h}) to place in the stash`}
      onKeyDown={onKeyDown}
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
