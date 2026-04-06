'use client';

import { useState, useMemo, useCallback } from 'react';
import { Shield, Crown, ChevronDown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../_design';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import {
  ACCENT, RARITY_COLORS, LOADOUT_SLOTS, LOADOUT_SLOT_POSITIONS, ITEM_SETS,
  DUMMY_ITEMS, SLOT_SUBTYPES,
} from '../data';
import type { ItemData } from '../data';
import type { LoadoutSlot } from '@/types/unique-tab-improvements';
import { STATUS_SUBDUED, STATUS_LOCKED_STROKE, STATUS_ERROR, STATUS_SUCCESS, OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_30, OPACITY_37, OPACITY_50, GLOW_MD,
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
  );
}

/* ── Set Bonus Section ─────────────────────────────────────────────────── */

export function SetBonusSection() {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(() => new Set(ITEM_SETS.map(s => s.name)));
  const [setFilter, setSetFilter] = useState<'all' | 'complete' | 'incomplete'>('all');

  const toggleSet = useCallback((name: string) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const filteredSets = useMemo(() => {
    if (setFilter === 'all') return ITEM_SETS;
    return ITEM_SETS.filter(set => {
      const complete = set.pieces.every(p => p.owned);
      return setFilter === 'complete' ? complete : !complete;
    });
  }, [setFilter]);

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={Crown} label="Set Bonus System Preview" color={ACCENT} />
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          {(['all', 'complete', 'incomplete'] as const).map(f => (
            <button key={f} onClick={() => setSetFilter(f)}
              className="text-xs font-mono px-2 py-1 rounded-md transition-all cursor-pointer"
              style={{
                backgroundColor: setFilter === f ? `${withOpacity(ACCENT, OPACITY_12)}` : 'transparent',
                color: setFilter === f ? ACCENT : 'var(--text-muted)',
                border: `1px solid ${setFilter === f ? withOpacity(ACCENT, OPACITY_30) : 'transparent'}`,
              }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Track set collection progress and bonus thresholds.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSets.map(set => {
          const ownedCount = set.pieces.filter(p => p.owned).length;
          const isExpanded = expandedSets.has(set.name);
          return (
            <motion.div key={set.name} className="rounded-lg border overflow-hidden"
              style={{ borderColor: `${withOpacity(set.color, OPACITY_25)}`, backgroundColor: `${withOpacity(set.color, OPACITY_5)}` }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Collapsible header */}
              <button onClick={() => toggleSet(set.name)}
                className="w-full flex items-center justify-between p-3 hover:bg-surface-hover/20 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  </motion.div>
                  <span className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(set.color, OPACITY_25)}` }}>{set.name}</span>
                </div>
                <span className="text-sm font-mono font-bold" style={{ color: set.color }}>{ownedCount}/{set.pieces.length}</span>
              </button>
              {/* Collapsible body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {set.pieces.map(piece => (
                          <div key={piece.slot} className="flex items-center gap-1.5 text-sm font-mono px-2 py-1 rounded border"
                            style={{ borderColor: piece.owned ? `${withOpacity(set.color, OPACITY_30)}` : 'var(--border)', backgroundColor: piece.owned ? `${withOpacity(set.color, OPACITY_10)}` : 'transparent', opacity: piece.owned ? 1 : 0.5 }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: piece.owned ? set.color : STATUS_SUBDUED }} />
                            <span className="text-text-muted">{piece.slot}:</span>
                            <span className={piece.owned ? 'text-text' : 'text-text-muted'}>{piece.name}</span>
                            {!piece.owned && <span className="text-xs" style={{ color: STATUS_ERROR }}>(missing)</span>}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5 border-t pt-2" style={{ borderColor: `${withOpacity(set.color, OPACITY_12)}` }}>
                        {set.bonuses.map(bonus => {
                          const active = ownedCount >= bonus.pieces;
                          return (
                            <div key={bonus.pieces} className="flex items-center gap-2 text-sm font-mono" style={{ opacity: active ? 1 : 0.4 }}>
                              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold border"
                                style={{ borderColor: active ? `${withOpacity(set.color, OPACITY_37)}` : 'var(--border)', backgroundColor: active ? `${withOpacity(set.color, OPACITY_12)}` : 'transparent', color: active ? set.color : 'var(--text-muted)' }}>
                                {bonus.pieces}
                              </span>
                              <span className={active ? 'text-text' : 'text-text-muted'}>{bonus.description}</span>
                              {active && <span className="text-xs font-mono uppercase tracking-[0.15em] ml-auto" style={{ color: STATUS_SUCCESS }}>ACTIVE</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
