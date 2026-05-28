'use client';

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { RotateCw, X } from 'lucide-react';
import {
  canPlace,
  orientedFootprint,
  type StashTab,
  type PlacedItem,
} from '@/lib/spatial-inventory';
import {
  getDragIntent,
  rotateDragIntent,
  setDragIntent,
  subscribeDragIntent,
} from './spatialDragState';
import {
  spatialItemLookup,
  useSpatialInventoryStore,
} from '@/stores/spatialInventoryStore';
import { RARITY_COLORS } from '../../_shared/data';
import {
  withOpacity, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_50,
  STATUS_SUCCESS, STATUS_ERROR, STATUS_SUBDUED, OVERLAY_WHITE,
} from '@/lib/chart-colors';

const CELL_PX = 32;
const GAP_PX = 2;

interface Props {
  tab: StashTab;
  accent: string;
}

interface HoverState {
  x: number;
  y: number;
  w: number;
  h: number;
  valid: boolean;
}

export function SpatialStashGrid({ tab, accent }: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const placeItem = useSpatialInventoryStore((s) => s.placeItem);
  const movePlacementAction = useSpatialInventoryStore((s) => s.movePlacement);
  const removePlacementAction = useSpatialInventoryStore((s) => s.removePlacement);

  // Re-render when the rotation flips mid-drag so the preview updates.
  useSyncExternalStore(subscribeDragIntent, getDragIntent, () => null);

  const totalW = tab.cols * CELL_PX + (tab.cols - 1) * GAP_PX;
  const totalH = tab.rows * CELL_PX + (tab.rows - 1) * GAP_PX;

  const cellFromEvent = useCallback(
    (e: React.DragEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const cellPlusGap = CELL_PX + GAP_PX;
      const x = Math.floor((e.clientX - rect.left) / cellPlusGap);
      const y = Math.floor((e.clientY - rect.top) / cellPlusGap);
      return {
        x: Math.max(0, Math.min(tab.cols - 1, x)),
        y: Math.max(0, Math.min(tab.rows - 1, y)),
      };
    },
    [tab.cols, tab.rows],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      const intent = getDragIntent();
      if (!intent) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = intent.kind === 'move' ? 'move' : 'copy';
      const { x, y } = cellFromEvent(e);
      const fp = orientedFootprint(intent.footprint, intent.rotated);
      const ignore = intent.kind === 'move' && intent.fromTabId === tab.id ? intent.placementId : undefined;
      const valid = canPlace(tab, x, y, fp.w, fp.h, ignore);
      setHover({ x, y, w: fp.w, h: fp.h, valid });
    },
    [cellFromEvent, tab],
  );

  const onDragLeave = useCallback(() => setHover(null), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const intent = getDragIntent();
      if (!intent) return;
      e.preventDefault();
      const { x, y } = cellFromEvent(e);
      const fp = orientedFootprint(intent.footprint, intent.rotated);
      if (intent.kind === 'new') {
        if (canPlace(tab, x, y, fp.w, fp.h)) {
          placeItem(tab.id, intent.itemId, { x, y, rotated: intent.rotated });
        }
      } else {
        // Cross-tab move not supported in this iteration — same-tab only.
        if (intent.fromTabId === tab.id) {
          movePlacementAction(tab.id, intent.placementId, x, y, intent.rotated);
        }
      }
      setHover(null);
      setDragIntent(null);
    },
    [cellFromEvent, tab, placeItem, movePlacementAction],
  );

  // Keyboard rotation while a drag is in flight (browsers fire keydown on the document during DnD).
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') rotateDragIntent();
  }, []);

  const cellMap = useMemo(() => new Array(tab.cols * tab.rows).fill(null), [tab.cols, tab.rows]);

  return (
    <div
      className="relative"
      style={{ width: totalW, height: totalH }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div
        ref={gridRef}
        className="grid relative"
        role="grid"
        aria-label={`Spatial stash ${tab.name} (${tab.cols} by ${tab.rows})`}
        style={{
          gridTemplateColumns: `repeat(${tab.cols}, ${CELL_PX}px)`,
          gridTemplateRows: `repeat(${tab.rows}, ${CELL_PX}px)`,
          gap: GAP_PX,
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {cellMap.map((_, i) => (
          <div
            key={i}
            className="rounded-sm border"
            style={{
              borderColor: withOpacity(accent, OPACITY_15),
              backgroundColor: withOpacity(OVERLAY_WHITE, '05'),
            }}
          />
        ))}

        {hover && (
          <div
            className="absolute pointer-events-none rounded-md border-2 transition-colors"
            style={{
              left: hover.x * (CELL_PX + GAP_PX),
              top: hover.y * (CELL_PX + GAP_PX),
              width: hover.w * CELL_PX + (hover.w - 1) * GAP_PX,
              height: hover.h * CELL_PX + (hover.h - 1) * GAP_PX,
              borderColor: hover.valid ? STATUS_SUCCESS : STATUS_ERROR,
              backgroundColor: withOpacity(hover.valid ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_25),
              boxShadow: `inset 0 0 12px ${withOpacity(hover.valid ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_50)}`,
            }}
          />
        )}

        {tab.items.map((p) => (
          <PlacedTile
            key={p.id}
            placement={p}
            tabId={tab.id}
            onRotate={() => {
              // toggle rotation in place when it fits
              const ok = movePlacementAction(tab.id, p.id, p.x, p.y, !p.rotated);
              if (!ok) {
                // Try to find a nearby spot that fits the rotated footprint
                // (keep silent on failure — designer can always drag it out).
              }
            }}
            onRemove={() => removePlacementAction(tab.id, p.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  placement: PlacedItem;
  tabId: string;
  onRotate: () => void;
  onRemove: () => void;
}

function PlacedTile({ placement, tabId, onRotate, onRemove }: TileProps) {
  const item = spatialItemLookup(placement.itemId);
  const color = item ? RARITY_COLORS[item.rarity] ?? STATUS_SUBDUED : STATUS_SUBDUED;
  const w = placement.w * CELL_PX + (placement.w - 1) * GAP_PX;
  const h = placement.h * CELL_PX + (placement.h - 1) * GAP_PX;

  const onDragStart = (e: React.DragEvent) => {
    if (!item) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', placement.id);
    setDragIntent({
      kind: 'move',
      placementId: placement.id,
      fromTabId: tabId,
      footprint: { w: placement.rotated ? placement.h : placement.w, h: placement.rotated ? placement.w : placement.h },
      rotated: placement.rotated,
    });
  };

  const onDragEnd = () => setDragIntent(null);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="absolute rounded-md border cursor-grab active:cursor-grabbing group flex flex-col items-center justify-center text-center px-1 transition-transform"
      title={item ? `${item.name} — ${item.rarity} ${item.subtype} (${placement.w}×${placement.h})` : placement.itemId}
      style={{
        left: placement.x * (CELL_PX + GAP_PX),
        top: placement.y * (CELL_PX + GAP_PX),
        width: w,
        height: h,
        borderColor: withOpacity(color, OPACITY_50),
        backgroundColor: withOpacity(color, OPACITY_15),
        color,
        boxShadow: `inset 0 0 8px ${withOpacity(color, OPACITY_25)}, 0 1px 0 ${withOpacity(color, OPACITY_8)}`,
      }}
    >
      <span className="text-[10px] font-mono font-bold leading-tight line-clamp-2 select-none">
        {item ? item.name : '?'}
      </span>
      <div className="absolute inset-x-0 top-0 flex justify-end gap-0.5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onRotate}
          className="rounded p-0.5"
          style={{ backgroundColor: withOpacity(OVERLAY_WHITE, '15'), color }}
          aria-label="Rotate"
        >
          <RotateCw className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5"
          style={{ backgroundColor: withOpacity(OVERLAY_WHITE, '15'), color: STATUS_ERROR }}
          aria-label="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
