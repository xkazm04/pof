'use client';

import { motion } from 'framer-motion';
import { OPACITY_8, OPACITY_15, OPACITY_25, OPACITY_37, withOpacity } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { ACCENT } from './constants';
import { ITEM_BASES, RARITY_COLORS, getItemLevelScaling } from './data';
import type { ItemBase } from './data';

interface ItemBaseSelectorProps {
  selectedBase: ItemBase;
  itemLevel: number;
  onSelectBase: (base: ItemBase) => void;
  onSetItemLevel: (level: number) => void;
}

export function ItemBaseSelector({
  selectedBase, itemLevel, onSelectBase, onSetItemLevel,
}: ItemBaseSelectorProps) {
  return (
    <>
      {/* Item base selector */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader label="Item Base" color={ACCENT} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 mt-2">
          {ITEM_BASES.map((base) => {
            const rc = RARITY_COLORS[base.rarity];
            const isSelected = selectedBase.name === base.name;
            return (
              <motion.button key={base.name}
                onClick={() => onSelectBase(base)}
                whileHover={{ scale: 1.03 }}
                className="px-2 py-1.5 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: isSelected ? withOpacity(rc, OPACITY_8) : 'transparent',
                  border: `1px solid ${isSelected ? withOpacity(rc, OPACITY_37) : withOpacity(rc, OPACITY_15)}`,
                  color: isSelected ? rc : 'var(--text-muted)',
                }}>
                <div className="font-bold font-mono text-xs uppercase tracking-[0.15em] truncate"
                  style={isSelected ? { textShadow: `0 0 12px ${withOpacity(rc, OPACITY_25)}` } : undefined}>
                  {base.name}
                </div>
                <div className="text-xs font-mono opacity-70">{base.type} | Lv{base.itemLevel}</div>
              </motion.button>
            );
          })}
        </div>
      </BlueprintPanel>

      {/* Item level slider */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Item Level
          </span>
          <span className="text-xs font-mono font-bold"
            style={{ color: ACCENT, textShadow: `0 0 12px ${withOpacity(ACCENT, OPACITY_25)}` }}>
            {itemLevel}
          </span>
        </div>
        <input type="range" min={1} max={100} value={itemLevel}
          onChange={(e) => onSetItemLevel(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: ACCENT }} />
        <div className="flex justify-between text-xs text-text-muted font-mono mt-0.5">
          <span>1</span>
          <span style={{ textShadow: `0 0 12px ${withOpacity(ACCENT, OPACITY_25)}` }}>
            Scaling: {getItemLevelScaling(itemLevel).toFixed(1)}x
          </span>
          <span>100</span>
        </div>
      </BlueprintPanel>
    </>
  );
}
