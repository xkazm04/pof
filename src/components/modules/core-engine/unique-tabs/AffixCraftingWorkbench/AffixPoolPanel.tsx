'use client';

import { Plus, GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { ACCENT } from './constants';
import { RARITY_COLORS } from './data';
import type { AffixPoolEntry } from './data';
import type { PoolCategory } from './types';

interface AffixPoolPanelProps {
  filteredPool: AffixPoolEntry[];
  poolFilter: PoolCategory;
  setPoolFilter: (f: PoolCategory) => void;
  poolSearch: string;
  setPoolSearch: (s: string) => void;
  maxAffixes: number;
  craftedAffixCount: number;
  rarityColor: string;
  rarity: string;
  canAddMore: boolean;
  draggingAffixId: string | null;
  maxWeight: number;
  totalWeight: number;
  onAddAffix: (entry: AffixPoolEntry) => void;
  onDragStart: (e: React.DragEvent, entry: AffixPoolEntry) => void;
  onDragEnd: () => void;
  getCategoryColor: (cat: 'offensive' | 'defensive' | 'utility') => string;
}

export function AffixPoolPanel({
  filteredPool, poolFilter, setPoolFilter, poolSearch, setPoolSearch,
  maxAffixes, craftedAffixCount, rarityColor, rarity,
  canAddMore, draggingAffixId, maxWeight, totalWeight,
  onAddAffix, onDragStart, onDragEnd, getCategoryColor,
}: AffixPoolPanelProps) {
  return (
    <BlueprintPanel color={ACCENT} className="p-3 space-y-4 max-h-[600px] flex flex-col md:row-span-2 xl:row-span-1 relative">
      <SectionHeader label="Affix Pool" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
        Drag affixes onto the item or click <Plus className="w-2.5 h-2.5 inline" /> to add.
        {maxAffixes > 0 && (
          <span className="ml-1 font-mono" style={{ color: rarityColor, textShadow: `0 0 12px ${rarityColor}40` }}>
            ({craftedAffixCount}/{maxAffixes})
          </span>
        )}
      </p>

      {/* Filter buttons */}
      <div className="flex gap-1">
        {(['all', 'offensive', 'defensive', 'utility'] as const).map((cat) => (
          <button key={cat} onClick={() => setPoolFilter(cat)}
            className="flex-1 px-2 py-1 rounded text-xs font-mono uppercase tracking-[0.15em] capitalize transition-all"
            style={{
              backgroundColor: poolFilter === cat ? `${ACCENT}20` : 'transparent',
              color: poolFilter === cat ? ACCENT : 'var(--text-muted)',
              border: `1px solid ${poolFilter === cat ? `${ACCENT}50` : `${ACCENT}25`}`,
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" value={poolSearch} onChange={(e) => setPoolSearch(e.target.value)}
        placeholder="Search affixes..."
        className="w-full px-2 py-1.5 bg-surface-deep rounded text-xs font-mono text-text placeholder-text-muted outline-none transition-colors"
        style={{ border: `1px solid ${ACCENT}25` }} />

      {/* Pool list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {filteredPool.map((entry) => {
          const rColor = RARITY_COLORS[entry.minRarity];
          const isDragging = draggingAffixId === entry.id;
          const catColor = getCategoryColor(entry.category);
          const weightPct = maxWeight > 0 ? (entry.weight / maxWeight) * 100 : 0;
          return (
            <motion.div key={entry.id} draggable
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, entry)}
              onDragEnd={onDragEnd}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing group"
              style={{
                backgroundColor: 'var(--surface-deep)',
                border: `1px solid ${ACCENT}18`,
                opacity: isDragging ? 0.5 : 1,
                transform: isDragging ? 'scale(0.95)' : 'scale(1)',
                transition: 'opacity 0.15s ease, transform 0.15s ease',
              }}
              whileHover={isDragging ? {} : { scale: 1.01 }}>
              <GripVertical className="w-3 h-3 text-text-muted opacity-40 group-hover:opacity-80 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono text-text truncate"
                    style={{ textShadow: `0 0 12px ${catColor}40` }}>{entry.displayName}</span>
                  <span className="text-xs px-1 py-0.5 rounded font-bold font-mono uppercase"
                    style={{ backgroundColor: `${rColor}15`, color: rColor, border: `1px solid ${rColor}30` }}>
                    {entry.bIsPrefix ? 'PRE' : 'SUF'}
                  </span>
                </div>
                <div className="text-xs text-text-muted font-mono truncate">{entry.stat} ({entry.minValue}-{entry.maxValue})</div>
                <div className="mt-0.5" title={`Weight: ${entry.weight} | Prob: ${totalWeight > 0 ? ((entry.weight / totalWeight) * 100).toFixed(1) : 0}%`}>
                  <NeonBar pct={weightPct} color={catColor} height={3} />
                </div>
              </div>
              <button onClick={() => onAddAffix(entry)} disabled={!canAddMore}
                className="p-1 rounded transition-colors disabled:opacity-30"
                style={{ color: STATUS_SUCCESS }} title="Add to item">
                <Plus className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
        {filteredPool.length === 0 && (
          <div className="text-xs font-mono text-text-muted italic text-center py-4">
            {craftedAffixCount >= maxAffixes ? 'Item is full -- remove an affix to add more' : 'No matching affixes'}
          </div>
        )}
      </div>
    </BlueprintPanel>
  );
}
