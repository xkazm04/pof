'use client';

import { useState, useMemo, useCallback } from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import {
  ACCENT, RARITY_COLORS, LOADOUT_SLOTS, LOADOUT_SLOT_POSITIONS,
  DUMMY_ITEMS, SLOT_SUBTYPES,
} from '../_shared/data';
import { SpatialStashSection } from './spatial-stash/SpatialStashSection';
import type { ItemData } from '../_shared/data';
import type { LoadoutSlot } from '@/types/unique-tab-improvements';
import { STATUS_SUBDUED, STATUS_LOCKED_STROKE, OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_12, OPACITY_25, OPACITY_37, OPACITY_50, GLOW_MD,
} from '@/lib/chart-colors';

/* ── SelectableItem for ScalableSelector ─────────────────────────────────── */

type SelectableItem = ItemData & { [key: string]: unknown };

function renderSlotItem(item: SelectableItem, selected: boolean) {
  const color = RARITY_COLORS[item.rarity] ?? STATUS_SUBDUED;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
      style={{
        borderColor: selected ? color : `${withOpacity(color, OPACITY_25)}`,
        backgroundColor: selected ? `${withOpacity(color, OPACITY_12)}` : `${withOpacity(color, OPACITY_5)}`,
        boxShadow: selected ? `0 0 0 1px ${color}` : undefined,
      }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-mono text-text truncate">{item.name}</div>
        <div className="text-xs font-mono text-text-muted">{item.rarity} {item.subtype}</div>
      </div>
      {item.stats[0] && (
        <span className="text-xs font-mono font-bold" style={{ color }}>{item.stats[0].value}</span>
      )}
    </div>
  );
}

/* ── Stat Contributions (memoized) ─────────────────────────────────────── */

function StatContributions({ loadout }: { loadout: LoadoutSlot[] }) {
  const statRows = useMemo(() => {
    const totals: Record<string, { value: number; sources: string[] }> = {};
    for (const slot of loadout) {
      if (!slot.item) continue;
      for (const [stat, val] of Object.entries(slot.item.stats)) {
        if (!totals[stat]) totals[stat] = { value: 0, sources: [] };
        totals[stat].value += val;
        totals[stat].sources.push(slot.item.name);
      }
    }
    const maxVal = Math.max(...Object.values(totals).map(t => t.value), 1);
    return Object.entries(totals).map(([stat, d]) => ({ stat, ...d, maxVal }));
  }, [loadout]);

  return (
    <div className="flex-1 min-w-[200px] space-y-3">
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Stat Contributions</p>
      {statRows.map(({ stat, value, sources, maxVal }) => (
        <div key={stat} className="space-y-0.5">
          <div className="flex justify-between text-sm font-mono">
            <span className="text-text-muted">{stat}</span>
            <span className="text-text font-bold" style={{ textShadow: `0 0 12px ${withOpacity(ACCENT, OPACITY_25)}` }}>{value}</span>
          </div>
          <NeonBar pct={(value / maxVal) * 100} color={ACCENT} glow />
          <p className="text-xs text-text-muted opacity-60">{sources.join(', ')}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Equipment Loadout Section ─────────────────────────────────────────── */

export function EquipmentLoadoutSection() {
  const [loadout, setLoadout] = useState<LoadoutSlot[]>(LOADOUT_SLOTS);
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);

  const pickerItems = useMemo<SelectableItem[]>(() => {
    if (!pickerSlot) return [];
    const validSubs = SLOT_SUBTYPES[pickerSlot] ?? [];
    return DUMMY_ITEMS.filter(i => validSubs.includes(i.subtype)) as SelectableItem[];
  }, [pickerSlot]);

  const handleSelect = useCallback((selected: SelectableItem[]) => {
    if (selected.length === 0 || !pickerSlot) return;
    const item = selected[0];
    const stats: Record<string, number> = {};
    for (const s of item.stats) {
      if (s.numericValue != null) stats[s.label] = s.numericValue;
    }
    setLoadout(prev => prev.map(s =>
      s.slotId === pickerSlot
        ? { ...s, item: { name: item.name, rarity: item.rarity, stats }, isEmpty: false }
        : s
    ));
    setPickerSlot(null);
  }, [pickerSlot]);

  return (
    <div className="space-y-4">
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT, OPACITY_37)}, transparent)` }} />
      <SectionHeader icon={Shield} label="Equipment Loadout Visualizer" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Click any slot to equip items via ScalableSelector.</p>
      <div className="flex flex-wrap gap-4 items-start justify-center">
        {/* Paper doll SVG */}
        <div className="relative" style={{ width: 180, height: 160 }}>
          <svg width={180} height={160} viewBox="0 0 220 200" className="absolute inset-0">
            <ellipse cx="95" cy="25" rx="14" ry="16" fill="none" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
            <line x1="95" y1="41" x2="95" y2="110" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
            <line x1="95" y1="55" x2="60" y2="85" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
            <line x1="95" y1="55" x2="130" y2="85" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
            <line x1="95" y1="110" x2="75" y2="165" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
            <line x1="95" y1="110" x2="115" y2="165" stroke={withOpacity(OVERLAY_WHITE, OPACITY_12)} strokeWidth="1.5" />
          </svg>
          {loadout.map(slot => {
            const pos = LOADOUT_SLOT_POSITIONS[slot.slotId];
            if (!pos) return null;
            const color = slot.item ? RARITY_COLORS[slot.item.rarity] ?? STATUS_SUBDUED : STATUS_LOCKED_STROKE;
            return (
              <motion.div key={slot.slotId} className="absolute flex flex-col items-center cursor-pointer"
                style={{ left: pos.x, top: pos.y }}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ scale: 1.1 }}
                onClick={() => setPickerSlot(slot.slotId)}>
                <div className="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold font-mono shadow-lg"
                  style={{ borderColor: `${withOpacity(color, OPACITY_50)}`, backgroundColor: `${withOpacity(color, OPACITY_12)}`, color, boxShadow: slot.item ? `${GLOW_MD} ${withOpacity(color, OPACITY_25)}` : 'none' }}
                  title={slot.item ? `${slot.item.name} (${slot.item.rarity})` : `Empty: ${slot.slotName} — click to equip`}>
                  {slot.item ? slot.item.name.charAt(0) : '?'}
                </div>
                <span className="text-xs font-mono text-text-muted mt-0.5">{slot.slotName}</span>
              </motion.div>
            );
          })}
        </div>
        {/* Stat summary */}
        <StatContributions loadout={loadout} />
      </div>

      {/* ScalableSelector for slot picker */}
      <ScalableSelector<SelectableItem>
        items={pickerItems}
        groupBy="rarity"
        renderItem={renderSlotItem}
        onSelect={handleSelect}
        selected={[]}
        searchKey="name"
        placeholder="Search items for this slot..."
        mode="single"
        open={pickerSlot != null}
        onClose={() => setPickerSlot(null)}
        title={`Equip: ${pickerSlot ?? ''}`}
        accent={ACCENT}
      />
    </BlueprintPanel>

    <SpatialStashSection />
    </div>
  );
}
