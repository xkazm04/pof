'use client';

import { useCallback, useMemo, useState } from 'react';
import { Grid3x3, Plus, Trash2, RefreshCw } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../../unique-tabs/_design';
import {
  spatialItemLookup,
  useActiveStashTab,
  useSpatialInventoryStore,
  useStashTabList,
} from '@/stores/spatialInventoryStore';
import { computePackingMetrics } from '@/lib/spatial-inventory';
import { ACCENT, RARITY_COLORS } from '../../_shared/data';
import { SpatialStashGrid } from './SpatialStashGrid';
import { SpatialStashPalette } from './SpatialStashPalette';
import {
  withOpacity, OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_50,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_SUBDUED,
} from '@/lib/chart-colors';

/**
 * Tetris-style spatial inventory: WxH cell grid with multi-tab stash,
 * drag-drop placement, rotation, and a live packing/fragmentation metric
 * that the Inventory Capacity Planner reads instead of static counts.
 */
export function SpatialStashSection() {
  const tabs = useStashTabList();
  const activeTab = useActiveStashTab();
  const setActiveTab = useSpatialInventoryStore((s) => s.setActiveTab);
  const addTab = useSpatialInventoryStore((s) => s.addTab);
  const removeTab = useSpatialInventoryStore((s) => s.removeTab);
  const renameTab = useSpatialInventoryStore((s) => s.renameTab);
  const reseed = useSpatialInventoryStore((s) => s.reseedActiveTab);

  const metrics = useMemo(
    () => computePackingMetrics(activeTab, (id) => spatialItemLookup(id)),
    [activeTab],
  );

  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  const onAddTab = useCallback(() => addTab('Tab ' + (tabs.length + 1)), [addTab, tabs.length]);
  const onRemoveActive = useCallback(() => {
    if (tabs.length > 1) removeTab(activeTab.id);
  }, [removeTab, tabs.length, activeTab.id]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={Grid3x3} label="Spatial Stash (Tetris Inventory)" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">
        Drag items into the grid · press <kbd className="px-1 rounded bg-surface-deep border border-border/40">R</kbd> to rotate · footprint comes from item subtype.
      </p>

      {/* Tab strip */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {tabs.map((t) => {
          const isActive = t.id === activeTab.id;
          const isEditing = editingTabId === t.id;
          return (
            <div
              key={t.id}
              className="flex items-center"
              style={{
                borderColor: withOpacity(ACCENT, isActive ? OPACITY_50 : OPACITY_15),
                backgroundColor: withOpacity(ACCENT, isActive ? OPACITY_15 : '00'),
              }}
            >
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={t.name}
                  onBlur={(e) => {
                    renameTab(t.id, e.currentTarget.value);
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  className="text-xs font-mono px-2 py-1 rounded-md bg-surface-deep border outline-none w-24"
                  style={{ borderColor: withOpacity(ACCENT, OPACITY_25) }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  onDoubleClick={() => setEditingTabId(t.id)}
                  className="text-xs font-mono px-2 py-1 rounded-md border transition-colors"
                  style={{
                    color: isActive ? ACCENT : 'var(--text-muted)',
                    borderColor: withOpacity(ACCENT, isActive ? OPACITY_50 : OPACITY_15),
                    backgroundColor: withOpacity(ACCENT, isActive ? OPACITY_15 : '00'),
                  }}
                  title="Double-click to rename"
                >
                  {t.name} <span className="opacity-60">({t.cols}×{t.rows})</span>
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAddTab}
          className="text-xs font-mono px-1.5 py-1 rounded-md border flex items-center gap-1"
          style={{ borderColor: withOpacity(ACCENT, OPACITY_25), color: ACCENT }}
          title="Add tab"
        >
          <Plus className="w-3 h-3" />
        </button>
        {tabs.length > 1 && (
          <button
            type="button"
            onClick={onRemoveActive}
            className="text-xs font-mono px-1.5 py-1 rounded-md border flex items-center gap-1"
            style={{ borderColor: withOpacity(STATUS_ERROR, OPACITY_25), color: STATUS_ERROR }}
            title="Remove active tab"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={reseed}
          className="text-xs font-mono px-1.5 py-1 rounded-md border flex items-center gap-1 ml-auto"
          style={{ borderColor: withOpacity(STATUS_SUBDUED, OPACITY_25), color: 'var(--text-muted)' }}
          title="Reseed active tab"
        >
          <RefreshCw className="w-3 h-3" />
          Reseed
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <SpatialStashGrid tab={activeTab} accent={ACCENT} />
        <div className="flex-1 min-w-[240px] space-y-3">
          <PackingPanel
            packing={metrics.packing}
            usedCells={metrics.usedCells}
            totalCells={metrics.totalCells}
            itemCount={metrics.itemCount}
            fragmentation={metrics.fragmentation}
          />
          <SpatialStashPalette accent={ACCENT} />
        </div>
      </div>
    </BlueprintPanel>
  );
}

interface PackingProps {
  packing: number;
  usedCells: number;
  totalCells: number;
  itemCount: number;
  fragmentation: number;
}

function PackingPanel({ packing, usedCells, totalCells, itemCount, fragmentation }: PackingProps) {
  const pct = Math.round(packing * 100);
  const fragPct = Math.round(fragmentation * 100);
  const packColor = packing > 0.85 ? STATUS_ERROR : packing > 0.6 ? STATUS_WARNING : STATUS_SUCCESS;
  const fragColor = fragmentation > 0.5 ? STATUS_ERROR : fragmentation > 0.25 ? STATUS_WARNING : STATUS_SUCCESS;
  return (
    <div
      className="rounded-md border p-3 space-y-2"
      style={{ borderColor: withOpacity(ACCENT, OPACITY_15), backgroundColor: withOpacity(ACCENT, OPACITY_8) }}
    >
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Packing</p>
      <div className="flex justify-between text-sm font-mono">
        <span className="text-text-muted">Cells {usedCells}/{totalCells}</span>
        <span className="font-bold" style={{ color: packColor }}>{pct}%</span>
      </div>
      <NeonBar pct={pct} color={packColor} glow />
      <div className="flex justify-between text-sm font-mono">
        <span className="text-text-muted">Fragmentation</span>
        <span className="font-bold" style={{ color: fragColor }}>{fragPct}%</span>
      </div>
      <NeonBar pct={fragPct} color={fragColor} />
      <p className="text-[10px] font-mono text-text-muted opacity-70">
        {itemCount} items placed · fragmentation = free cells too tight for a 2×2 footprint
      </p>
    </div>
  );
}

/* ── Re-export rarity colors for parent imports ───────────────────────── */
export { RARITY_COLORS };
