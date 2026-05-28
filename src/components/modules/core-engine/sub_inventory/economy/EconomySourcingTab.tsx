'use client';

import { useState, useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, STATUS_INFO, STATUS_SUBDUED,
  OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_25,
} from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { ItemDetailDrawer } from '../catalog/ItemDetailDrawer';
import {
  ACCENT, DUMMY_ITEMS, RARITY_COLORS, ALL_ITEM_TYPES,
  INVENTORY_GOLD_VALUE, CLEANUP_SUGGESTIONS,
} from '../_shared/data';
import type { ItemData } from '../_shared/data';
import { CraftingRecipeSection, DropSourceSection, RarityDistributionSection, EconomySankeySection } from './EconomySections';
import { aggregateMetrics, type PackingMetrics } from '@/lib/spatial-inventory';
import { spatialItemLookup, useAllStashTabs } from '@/stores/spatialInventoryStore';

/* ── Inventory Capacity Section ────────────────────────────────────────── */

/** Stable color map for type segments (matches GridMetric semantics). */
const TYPE_COLORS: Record<string, string> = {
  Weapon: STATUS_ERROR,
  Armor: STATUS_INFO,
  Accessory: ACCENT,
  Consumable: STATUS_SUCCESS,
  Material: STATUS_WARNING,
  Quest: STATUS_SUBDUED,
};

function InventoryCapacitySection() {
  // Live spatial data — `aggregateMetrics` rolls every stash tab into one
  // header packing/byType/byRarity rollup so the planner reflects the actual
  // grid placements, not a static counts table.
  const tabs = useAllStashTabs();
  const metrics = useMemo<PackingMetrics>(
    () => aggregateMetrics(tabs, spatialItemLookup),
    [tabs],
  );
  const typeEntries = useMemo(
    () => Object.entries(metrics.byType).sort((a, b) => b[1] - a[1]),
    [metrics.byType],
  );
  const typeCellEntries = useMemo(
    () => Object.entries(metrics.byTypeCells).sort((a, b) => b[1] - a[1]),
    [metrics.byTypeCells],
  );
  const rarityEntries = useMemo(
    () => Object.entries(metrics.byRarity).sort((a, b) => b[1] - a[1]),
    [metrics.byRarity],
  );
  const totalRarityCells = rarityEntries.reduce((s, [, v]) => s + v, 0);

  // Designer-facing suggestions derived from the live grid: too-tight or
  // too-empty packings each get an action prompt, plus the static catalog
  // hints from data-economy as fallback.
  const liveSuggestions = useMemo(() => {
    const out: string[] = [];
    if (metrics.totalCells === 0) return CLEANUP_SUGGESTIONS;
    if (metrics.packing > 0.9) {
      out.push(`Packing ${Math.round(metrics.packing * 100)}% — add a stash tab or salvage low-rarity items.`);
    }
    if (metrics.fragmentation > 0.4) {
      out.push(`Fragmentation ${Math.round(metrics.fragmentation * 100)}% — repack: small holes are blocking 2×2 armor.`);
    }
    if (metrics.usedCells === 0) {
      out.push('Stash is empty — drag items from the spatial palette to seed it.');
    }
    return out.length > 0 ? out : CLEANUP_SUGGESTIONS;
  }, [metrics]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={PieChart} label="Inventory Capacity Planner" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Live packing from the spatial stash · by type, by rarity, and cleanup hints.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut chart — slice angles come from cells consumed per type */}
        <div className="flex flex-col items-center gap-2">
          <svg width={110} height={110} viewBox="0 0 140 140">
            {(() => {
              const cx = 70, cy = 70, outerR = 55, innerR = 35;
              const total = Math.max(1, metrics.totalCells);
              let accAngle = 0;
              const paths: React.ReactElement[] = [];
              for (const [type, cells] of typeCellEntries) {
                const angle = (cells / total) * 2 * Math.PI;
                if (angle <= 0) continue;
                const startAngle = -Math.PI / 2 + accAngle;
                accAngle += angle;
                const endAngle = startAngle + angle;
                const x1o = cx + outerR * Math.cos(startAngle), y1o = cy + outerR * Math.sin(startAngle);
                const x1i = cx + innerR * Math.cos(startAngle), y1i = cy + innerR * Math.sin(startAngle);
                const x2o = cx + outerR * Math.cos(endAngle), y2o = cy + outerR * Math.sin(endAngle);
                const x2i = cx + innerR * Math.cos(endAngle), y2i = cy + innerR * Math.sin(endAngle);
                const large = angle > Math.PI ? 1 : 0;
                const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
                paths.push(<path key={type} d={d} fill={TYPE_COLORS[type] ?? ACCENT} opacity={0.85} stroke="var(--surface)" strokeWidth="1.5" />);
              }
              return paths;
            })()}
            {(() => {
              const cx = 70, cy = 70, outerR = 55, innerR = 35;
              const usedAngle = (metrics.usedCells / Math.max(1, metrics.totalCells)) * 2 * Math.PI;
              const emptyAngle = 2 * Math.PI - usedAngle;
              if (emptyAngle <= 0) return null;
              const startAngle = -Math.PI / 2 + usedAngle;
              const x1o = cx + outerR * Math.cos(startAngle), y1o = cy + outerR * Math.sin(startAngle);
              const x1i = cx + innerR * Math.cos(startAngle), y1i = cy + innerR * Math.sin(startAngle);
              const endAngle = startAngle + emptyAngle;
              const x2o = cx + outerR * Math.cos(endAngle), y2o = cy + outerR * Math.sin(endAngle);
              const x2i = cx + innerR * Math.cos(endAngle), y2i = cy + innerR * Math.sin(endAngle);
              const large = emptyAngle > Math.PI ? 1 : 0;
              const d = `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x2i},${y2i} A${innerR},${innerR} 0 ${large} 0 ${x1i},${y1i} Z`;
              return <path d={d} fill={withOpacity(OVERLAY_WHITE, OPACITY_5)} stroke="var(--surface)" strokeWidth="1.5" />;
            })()}
            <text x="70" y="66" textAnchor="middle" className="text-sm font-bold fill-text font-mono" style={{ fontSize: 14 }}>{metrics.usedCells}/{metrics.totalCells}</text>
            <text x="70" y="80" textAnchor="middle" className="text-xs fill-[var(--text-muted)] font-mono">cells</text>
          </svg>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {typeEntries.map(([type, count]) => (
              <span key={type} className="text-xs font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TYPE_COLORS[type] ?? ACCENT }} />{type} ({count})
              </span>
            ))}
            {typeEntries.length === 0 && (
              <span className="text-xs font-mono text-text-muted">Stash empty</span>
            )}
          </div>
        </div>
        {/* Rarity bars */}
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">By Rarity (cells)</p>
          {rarityEntries.map(([rarity, cells]) => (
            <div key={rarity} className="space-y-0.5">
              <div className="flex justify-between text-sm font-mono">
                <span style={{ color: RARITY_COLORS[rarity] ?? ACCENT }}>{rarity}</span>
                <span className="text-text-muted">{cells}</span>
              </div>
              <NeonBar pct={totalRarityCells === 0 ? 0 : (cells / totalRarityCells) * 100} color={RARITY_COLORS[rarity] ?? ACCENT} />
            </div>
          ))}
          {rarityEntries.length === 0 && (
            <p className="text-xs font-mono text-text-muted">Place items in the spatial stash to populate.</p>
          )}
          <p className="text-sm font-mono text-text-muted mt-2">
            Packing: <span className="font-bold" style={{ color: STATUS_WARNING }}>{Math.round(metrics.packing * 100)}%</span>
            <span className="mx-2 opacity-50">·</span>
            Frag: <span className="font-bold" style={{ color: STATUS_WARNING }}>{Math.round(metrics.fragmentation * 100)}%</span>
          </p>
          <p className="text-sm font-mono text-text-muted">
            Total Value: <span className="font-bold" style={{ color: STATUS_WARNING, textShadow: `0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_25)}` }}>{INVENTORY_GOLD_VALUE}g</span>
          </p>
        </div>
        {/* Cleanup suggestions */}
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Auto-Cleanup Suggestions</p>
          {liveSuggestions.map((sug, i) => (
            <motion.div key={i} className="flex items-start gap-2 text-sm font-mono p-2 rounded-lg bg-surface-deep border" style={{ borderColor: `${withOpacity(ACCENT, OPACITY_10)}` }}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <span className="font-bold flex-shrink-0" style={{ color: STATUS_WARNING }}>{i + 1}.</span>
              <span className="text-text-muted">{sug}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Main Tab ──────────────────────────────────────────────────────────── */

/* ── Pre-compute items grouped by type for optgroup dropdown ──────────── */

const ITEMS_BY_TYPE = ALL_ITEM_TYPES.reduce<Record<string, ItemData[]>>((acc, type) => {
  const items = DUMMY_ITEMS.filter(i => i.type === type);
  if (items.length > 0) acc[type] = items;
  return acc;
}, {});

export function EconomySourcingTab() {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const selectedItem = useMemo(
    () => DUMMY_ITEMS.find(i => i.id === selectedItemId) ?? null,
    [selectedItemId],
  );

  return (
    <motion.div key="economy-sourcing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* Item selector */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Inspect Item</span>
          <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}
            className="text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 text-text cursor-pointer min-w-[200px]">
            <option value="">-- Select an item --</option>
            {Object.entries(ITEMS_BY_TYPE).map(([type, items]) => (
              <optgroup key={type} label={type}>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.rarity})</option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedItem && (
            <span className="text-xs font-mono px-2 py-0.5 rounded border"
              style={{ color: RARITY_COLORS[selectedItem.rarity], borderColor: `${withOpacity(RARITY_COLORS[selectedItem.rarity], OPACITY_25)}`, backgroundColor: `${withOpacity(RARITY_COLORS[selectedItem.rarity], OPACITY_8)}` }}>
              {selectedItem.rarity}
            </span>
          )}
        </div>
      </BlueprintPanel>

      <ItemDetailDrawer item={selectedItem} onClose={() => setSelectedItemId('')} />

      <EconomySankeySection />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CraftingRecipeSection />
        <DropSourceSection />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RarityDistributionSection />
        <InventoryCapacitySection />
      </div>
    </motion.div>
  );
}
