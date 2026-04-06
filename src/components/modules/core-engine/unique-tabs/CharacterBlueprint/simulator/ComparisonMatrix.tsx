'use client';

import { useState, useMemo } from 'react';
import { BarChart3, Crown, Plus, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, ACCENT_VIOLET, OVERLAY_WHITE,
  OPACITY_5, OPACITY_8, OPACITY_22,
  withOpacity,
} from '@/lib/chart-colors';
import { MOTION_CONFIG } from '@/lib/motion';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import { BlueprintPanel, SectionHeader, NeonBar } from '../design';
import { COMPARISON_STATS, COMPARISON_CHARACTERS, type SelectableCharacter } from '../data';

interface ComparisonMatrixProps {
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ComparisonMatrix({ selected, onSelectionChange }: ComparisonMatrixProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleCharacters = useMemo(
    () => COMPARISON_CHARACTERS.filter(c => selectedSet.has(c.id)),
    [selectedSet],
  );

  return (
    <BlueprintPanel className="p-4" color={ACCENT_VIOLET}>
      <SectionHeader icon={BarChart3} label="Character Comparison" color={ACCENT_VIOLET} />

      {/* Selected characters + Add button */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {visibleCharacters.map(ch => (
          <span key={ch.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold border"
            style={{
              borderColor: withOpacity(ch.color, OPACITY_22),
              color: ch.color,
              backgroundColor: withOpacity(ch.color, OPACITY_8),
            }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
            {ch.name}
          </span>
        ))}
        <button
          onClick={() => setSelectorOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold border border-dashed border-border/50 text-text-muted hover:text-text hover:border-border transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Add Character
        </button>
        <span className="ml-auto text-xs font-mono text-text-muted flex items-center gap-1">
          <Users className="w-3 h-3" />
          {selected.length} / {COMPARISON_CHARACTERS.length}
        </span>
      </div>

      {/* ScalableSelector Modal */}
      <ScalableSelector<SelectableCharacter>
        items={COMPARISON_CHARACTERS}
        groupBy="category"
        renderItem={(item: SelectableCharacter, sel: boolean) => (
          <div className={`flex items-center gap-2 px-2 py-1.5 text-xs font-mono transition-all ${sel ? 'font-bold' : 'opacity-60'}`}
            style={sel ? { color: item.color } : { color: 'var(--text-muted)' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.name}</span>
            <span className="text-[9px] text-text-muted ml-auto capitalize">{item.tier}</span>
          </div>
        )}
        onSelect={(items: SelectableCharacter[]) => onSelectionChange(items.map(i => i.id))}
        selected={selected}
        searchKey="name"
        mode="multi"
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        title="Select Characters to Compare"
        accent={ACCENT_VIOLET}
      />

      {/* Comparison table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_5) }}>
              <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-[0.15em] text-text-muted w-24">Stat</th>
              {visibleCharacters.map(ch => (
                <th key={ch.id} className="py-2 px-3 text-xs font-bold uppercase tracking-[0.15em] text-center"
                  style={{ color: ch.color }}>
                  {ch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_STATS.map((stat, si) => {
              const values = visibleCharacters.map(ch => ch.values[si]);
              const maxV = Math.max(...values);
              return (
                <motion.tr
                  key={stat.stat}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: si * MOTION_CONFIG.stagger }}
                  className="border-b hover:bg-surface/20 transition-colors"
                  style={{ borderColor: withOpacity(OVERLAY_WHITE, OPACITY_5) }}
                >
                  <td className="py-3 pr-4 font-bold text-text-muted">
                    {stat.stat}
                    {stat.unit && <span className="text-[9px] opacity-50 ml-0.5">({stat.unit})</span>}
                  </td>
                  {visibleCharacters.map(ch => {
                    const val = ch.values[si];
                    const barPct = (val / stat.maxVal) * 100;
                    const isBest = val === maxV && visibleCharacters.length > 1;
                    return (
                      <td key={ch.id} className="py-3 px-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <NeonBar pct={barPct} color={ch.color} height={6} glow={isBest} />
                          <span className="flex items-center gap-1 tabular-nums" style={{
                            color: isBest ? STATUS_SUCCESS : 'var(--text)',
                            fontWeight: isBest ? 700 : 500,
                          }}>
                            {isBest && <Crown className="w-2.5 h-2.5" style={{ color: STATUS_SUCCESS }} />}
                            {val}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/10 text-xs font-mono text-text-muted">
        <Crown className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
        <span className="font-bold" style={{ color: STATUS_SUCCESS }}>Crown</span> = highest in stat
        <span className="ml-auto">{visibleCharacters.length} of {COMPARISON_CHARACTERS.length} visible</span>
      </div>
    </BlueprintPanel>
  );
}
