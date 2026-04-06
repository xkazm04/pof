'use client';

import { ArrowLeftRight } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  OPACITY_5, OPACITY_8, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_25, OPACITY_30, OPACITY_50,
  OVERLAY_WHITE,
  withOpacity,
} from '@/lib/chart-colors';
import type { FeelPreset } from '@/lib/character-feel-optimizer';
import { CornerBrackets } from '../_design';

/* ── Preset Card ─────────────────────────────────────────────────────────── */

interface PresetCardProps {
  preset: FeelPreset;
  isSelected: boolean;
  isCompareTarget: boolean;
  onSelect: () => void;
  onCompare: () => void;
}

export function PresetCard({ preset, isSelected, isCompareTarget, onSelect, onCompare }: PresetCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-lg border cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? withOpacity(preset.color, OPACITY_50) : isCompareTarget ? withOpacity(preset.color, OPACITY_25) : withOpacity(preset.color, OPACITY_10),
        backgroundColor: isSelected ? withOpacity(preset.color, OPACITY_8) : 'transparent',
        boxShadow: isSelected ? `0 0 12px ${withOpacity(preset.color, OPACITY_20)}, inset 0 0 12px ${withOpacity(preset.color, OPACITY_5)}` : 'none',
      }}
      onClick={onSelect}
    >
      <CornerBrackets color={preset.color} size={6} />
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold" style={{ color: preset.color }}>
            {preset.name}
          </span>
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted px-1.5 py-0.5 rounded bg-surface-deep border border-border/30">
            {preset.genre}
          </span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed mb-1.5">{preset.description}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {preset.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: withOpacity(preset.color, OPACITY_8), color: preset.color, border: `1px solid ${withOpacity(preset.color, OPACITY_15)}` }}
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] px-2 py-1 rounded transition-colors"
          style={{
            backgroundColor: isCompareTarget ? withOpacity(preset.color, OPACITY_15) : 'var(--surface-deep)',
            color: isCompareTarget ? preset.color : 'var(--text-muted)',
            border: `1px solid ${isCompareTarget ? withOpacity(preset.color, OPACITY_30) : withOpacity(OVERLAY_WHITE, OPACITY_8)}`,
          }}
        >
          <ArrowLeftRight className="w-3 h-3" />
          {isCompareTarget ? 'Comparing' : 'Compare'}
        </button>
      </div>
    </motion.div>
  );
}
