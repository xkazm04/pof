'use client';

import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT } from './data';

const XP_SOURCES = [
  { label: 'Monster Kills', pct: 60, color: STATUS_ERROR },
  { label: 'Quest Completion', pct: 20, color: ACCENT_CYAN },
  { label: 'Boss Kills', pct: 10, color: ACCENT_VIOLET },
  { label: 'Exploration', pct: 10, color: ACCENT_EMERALD },
];

export function XpSourceBreakdown() {
  return (
    <BlueprintPanel color={ACCENT} className="p-5">
      <SectionHeader icon={BarChart3} label="XP Source Breakdown" color={ACCENT} />

      <div className="mt-2.5 space-y-3">
        {XP_SOURCES.map((src, i) => (
          <motion.div
            key={src.label}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
            className="space-y-1"
          >
            <div className="flex justify-between text-xs font-mono">
              <span className="text-text font-semibold">{src.label}</span>
              <span className="font-bold" style={{ color: src.color }}>{src.pct}%</span>
            </div>
            <div className="relative h-5 bg-surface-deep rounded-md overflow-hidden border border-border/30">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${src.pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ backgroundColor: src.color, opacity: 0.7 }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ width: `${src.pct}%`, background: `linear-gradient(90deg, ${src.color}40, ${src.color}10)` }}
              />
              <div className="absolute inset-0 flex items-center px-2">
                <span className="text-[10px] font-mono font-bold text-white/80 drop-shadow-sm">{src.label} - {src.pct}%</span>
              </div>
            </div>
          </motion.div>
        ))}

        <div className="mt-2.5 pt-3 border-t border-border/40">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">Combined Distribution</div>
          <div className="flex h-6 rounded-lg overflow-hidden border border-border/30">
            {XP_SOURCES.map((src, i) => (
              <motion.div
                key={src.label}
                initial={{ width: 0 }} animate={{ width: `${src.pct}%` }} transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                className="relative group/seg"
                style={{ backgroundColor: src.color, opacity: 0.75 }}
                title={`${src.label}: ${src.pct}%`}
              >
                <div className="absolute inset-0 bg-white/0 group-hover/seg:bg-white/10 transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </BlueprintPanel>
  );
}
