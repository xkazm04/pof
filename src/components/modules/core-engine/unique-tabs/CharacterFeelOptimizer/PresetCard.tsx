'use client';

import { ArrowLeftRight } from 'lucide-react';
import { motion } from 'framer-motion';
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
        borderColor: isSelected ? `${preset.color}80` : isCompareTarget ? `${preset.color}40` : `${preset.color}18`,
        backgroundColor: isSelected ? `${preset.color}15` : 'transparent',
        boxShadow: isSelected ? `0 0 12px ${preset.color}30, inset 0 0 12px ${preset.color}08` : 'none',
      }}
      onClick={onSelect}
    >
      <CornerBrackets color={preset.color} size={6} />
      <div className="p-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold" style={{ color: preset.color }}>
            {preset.name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted px-1.5 py-0.5 rounded bg-surface-deep border border-border/30">
            {preset.genre}
          </span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed mb-1.5">{preset.description}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {preset.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: `${preset.color}15`, color: preset.color, border: `1px solid ${preset.color}25` }}
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded transition-colors"
          style={{
            backgroundColor: isCompareTarget ? `${preset.color}25` : 'var(--surface-deep)',
            color: isCompareTarget ? preset.color : 'var(--text-muted)',
            border: `1px solid ${isCompareTarget ? preset.color + '50' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <ArrowLeftRight className="w-3 h-3" />
          {isCompareTarget ? 'Comparing' : 'Compare'}
        </button>
      </div>
    </motion.div>
  );
}
