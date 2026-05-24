'use client';

import { MapPin } from 'lucide-react';
import {
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import { motion } from 'framer-motion';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import {
  ACCENT, RARITY_COLORS,
  CRYSTAL_STAFF_SOURCES,
} from '../_shared/data';

/* ── Drop Source Section ───────────────────────────────────────────────── */

export function DropSourceSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader icon={MapPin} label="Item Drop Source Map" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Trace drop sources for Crystal Staff: enemies, loot tables, and zones.</p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="p-3 rounded-lg border-2 text-center min-w-[110px] flex-shrink-0"
          style={{ borderColor: `${withOpacity(RARITY_COLORS.Rare, OPACITY_37)}`, backgroundColor: `${withOpacity(RARITY_COLORS.Rare, OPACITY_8)}` }}>
          <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(RARITY_COLORS.Rare, OPACITY_25)}` }}>Crystal Staff</p>
          <p className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS.Rare }}>Rare Staff</p>
        </div>
        <div className="text-text-muted text-lg font-bold">&larr;</div>
        <div className="space-y-3 flex-1 min-w-[200px]">
          {CRYSTAL_STAFF_SOURCES.map(src => (
            <motion.div key={src.name} className="flex items-center gap-3 px-3 py-2 rounded-lg border"
              style={{ borderColor: `${withOpacity(src.color, OPACITY_20)}`, backgroundColor: `${withOpacity(src.color, OPACITY_5)}` }}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <span className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${withOpacity(src.color, OPACITY_12)}`, color: src.color }}>
                {src.type === 'enemy' ? 'Enemy' : src.type === 'loot_table' ? 'Loot Table' : 'Zone'}
              </span>
              <span className="text-sm font-mono text-text flex-1">{src.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16"><NeonBar pct={src.dropRate * 100 * 5} color={src.color} height={4} /></div>
                <span className="text-sm font-mono font-bold" style={{ color: src.color, textShadow: `0 0 12px ${withOpacity(src.color, OPACITY_25)}` }}>
                  {(src.dropRate * 100).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </BlueprintPanel>
  );
}
