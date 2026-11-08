'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { useSpatialInventoryStore } from '@/stores/spatialInventoryStore';
import { useInventoryItemLookup } from '../../_shared/useInventoryItems';
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
  const intent = useSyncExternalStore(subscribeDragIntent, getDragIntent, () => null);
  const lookupItem = useInventoryItemLookup();
  // Keyboard cursor: tied to the carried intent, so a stale cursor never outlives its pick-up.
  const [kb, setKb] = useState<{ x: number; y: number; key: string } | null>(null);
  const intentKey = intent ? (intent.kind === 'new' ? `n:${intent.itemId}` : `m:${intent.placementId}`) : null;
  const kbPos = intent && kb && kb.key === intentKey ? kb : null;

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

  /** Place or move the carried intent at (x, y). Returns false (and changes nothing) when it does not fit. */
  const commitIntent = useCallback(
    (x: number, y: number): boolean => {
      const cur = getDragIntent();
      if (!cur) return false;
      const fp = orientedFootprint(cur.footprint, cur.rotated);
      if (cur.kind === 'new') {
        if (!canPlace(tab, x, y, fp.w, fp.h)) return false;
        placeItem(tab.id, cur.itemId, { x, y, rotated: cur.rotated });
        return true;
      }
      // Cross-tab move not supported in this iteration — same-tab only.
      if (cur.fromTabId !== tab.id) return false;
      return movePlacementAction(tab.id, cur.placementId, x, y, cur.rotated);
    },
    [tab, placeItem, movePlacementAction],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!getDragIntent()) return;
      e.preventDefault();
      const { x, y } = cellFromEvent(e);
      commitIntent(x, y);
      setHover(null);
      setDragIntent(null);
    },
    [cellFromEvent, commitIntent],
  );

  // Keyboard path (WCAG 2.1.1). A pick-up from the palette or a tile sets the shared drag intent;
  // while it is set the document owns R / arrows / Enter / Escape (focus may still be on the palette).
  useEffect(() => {
    if (!intent || !intentKey) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const fp = orientedFootprint(intent.footprint, intent.rotated);
      const start = intent.kind === 'move' && intent.fromTabId === tab.id
        ? tab.items.find((p) => p.id === intent.placementId)
        : undefined;
      const cur = kbPos ?? { x: start?.x ?? 0, y: start?.y ?? 0, key: intentKey };
      const clampTo = (x: number, y: number, w: number, h: number) => ({
        x: Math.max(0, Math.min(tab.cols - w, x)),
        y: Math.max(0, Math.min(tab.rows - h, y)),
      });
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      if (e.key in delta) {
        e.preventDefault();
        const [dx, dy] = delta[e.key];
        setKb({ ...clampTo(cur.x + dx, cur.y + dy, fp.w, fp.h), key: intentKey });
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const flipped = orientedFootprint(intent.footprint, !intent.rotated);
        setKb({ ...clampTo(cur.x, cur.y, flipped.w, flipped.h), key: intentKey });
        rotateDragIntent();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (commitIntent(cur.x, cur.y)) {
          setKb(null);
          setDragIntent(null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setKb(null);
        setDragIntent(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [intent, intentKey, kbPos, tab, commitIntent]);

  const kbPreview = useMemo<HoverState | null>(() => {
    if (!intent || !kbPos) return null;
    const fp = orientedFootprint(intent.footprint, intent.rotated);
    const ignore = intent.kind === 'move' && intent.fromTabId === tab.id ? intent.placementId : undefined;
    return { x: kbPos.x, y: kbPos.y, w: fp.w, h: fp.h, valid: canPlace(tab, kbPos.x, kbPos.y, fp.w, fp.h, ignore) };
  }, [intent, kbPos, tab]);
  const shownHover = kbPreview ?? hover;

  const carriedItemId = !intent
    ? null
    : intent.kind === 'new'
      ? intent.itemId
      : tab.items.find((p) => p.id === intent.placementId)?.itemId ?? '';
  const carriedName = carriedItemId == null ? null : lookupItem(carriedItemId)?.name ?? 'item';
  const carryStatus = carriedName
    ? `Carrying ${carriedName}${kbPreview ? ` at column ${kbPreview.x + 1}, row ${kbPreview.y + 1}${kbPreview.valid ? '' : ', blocked'}` : ''}. Arrow keys move, R rotates, Enter places, Escape cancels.`
    : '';

  const cellMap = useMemo(() => new Array(tab.cols * tab.rows).fill(null), [tab.cols, tab.rows]);

  return (
    <div
      className="relative"
      style={{ width: totalW, height: totalH }}
      tabIndex={0}
    >
      <p role="status" data-stash-status className="sr-only">{carryStatus}</p>
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

        {shownHover && (
          <div
            className="absolute pointer-events-none rounded-md border-2 transition-colors"
            style={{
              left: shownHover.x * (CELL_PX + GAP_PX),
              top: shownHover.y * (CELL_PX + GAP_PX),
              width: shownHover.w * CELL_PX + (shownHover.w - 1) * GAP_PX,
              height: shownHover.h * CELL_PX + (shownHover.h - 1) * GAP_PX,
              borderColor: shownHover.valid ? STATUS_SUCCESS : STATUS_ERROR,
              backgroundColor: withOpacity(shownHover.valid ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_25),
              boxShadow: `inset 0 0 12px ${withOpacity(shownHover.valid ? STATUS_SUCCESS : STATUS_ERROR, OPACITY_50)}`,
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
  // Reactive: the tile re-resolves when the catalog store gains or edits the item.
  const item = useInventoryItemLookup()(placement.itemId);
  const color = item ? RARITY_COLORS[item.rarity] ?? STATUS_SUBDUED : STATUS_SUBDUED;
  // Tile controls name their item so a grid of Rotate/Remove buttons stays distinguishable.
  const tileName = item ? item.name : `unresolved item ${placement.itemId}`;
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

  // Keyboard pick-up: only from the tile itself (its Rotate/Remove buttons keep their own Enter),
  // and only when nothing is being carried, so Enter while carrying still drops.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || !item || getDragIntent()) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    setDragIntent({
      kind: 'move',
      placementId: placement.id,
      fromTabId: tabId,
      footprint: { w: placement.rotated ? placement.h : placement.w, h: placement.rotated ? placement.w : placement.h },
      rotated: placement.rotated,
    });
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-placed-tile
      tabIndex={0}
      role="group"
      aria-label={`${tileName} (${placement.w}×${placement.h}). Press Enter to pick up and move.`}
      onKeyDown={onKeyDown}
      className="absolute rounded-md border cursor-grab active:cursor-grabbing group flex flex-col items-center justify-center text-center px-1 transition-transform"
      title={item
        ? `${item.name} — ${item.rarity} ${item.subtype} (${placement.w}×${placement.h})`
        : `Unresolved item "${placement.itemId}" — not in the item catalog`}
      data-unresolved={item ? undefined : true}
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
      <div className="absolute inset-x-0 top-0 flex justify-end gap-0.5 p-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onRotate}
          className="rounded p-0.5"
          style={{ backgroundColor: withOpacity(OVERLAY_WHITE, '15'), color }}
          aria-label={`Rotate ${tileName}`}
        >
          <RotateCw className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5"
          style={{ backgroundColor: withOpacity(OVERLAY_WHITE, '15'), color: STATUS_ERROR }}
          aria-label={`Remove ${tileName}`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
