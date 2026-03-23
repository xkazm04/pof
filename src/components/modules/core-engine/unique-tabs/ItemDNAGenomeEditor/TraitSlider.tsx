'use client';

import { motion } from 'framer-motion';
import { OPACITY_10 } from '@/lib/chart-colors';
import { NeonBar } from '@/components/modules/core-engine/unique-tabs/_design';
import type { TraitGene } from '@/types/item-genome';
import type { AxisConfig } from './data';

/* ── Trait Slider ──────────────────────────────────────────────────────── */

export function TraitSlider({
  gene, config, onChange,
}: { gene: TraitGene; config: AxisConfig; onChange: (w: number) => void }) {
  const Icon = config.icon;
  const pct = gene.weight * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="group"
    >
      <div className="flex items-center gap-2">
        <div className="p-1 rounded" style={{ backgroundColor: `${config.color}${OPACITY_10}` }}>
          <Icon className="w-3 h-3" style={{ color: config.color }} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] w-16 truncate" style={{ color: config.color }}>
          {config.label}
        </span>
        <div className="flex-1 relative h-4 flex items-center">
          <div className="absolute inset-x-0 h-1.5 bg-surface-deep rounded-full" />
          <div className="absolute inset-x-0">
            <NeonBar pct={pct} color={config.color} height={6} glow />
          </div>
          <input
            type="range" min={0} max={100} step={1} value={pct}
            onChange={(e) => onChange(parseInt(e.target.value) / 100)}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface shadow-md pointer-events-none"
            style={{ left: `calc(${Math.min(pct, 100)}% - 5px)`, backgroundColor: config.color }}
          />
        </div>
        <input
          type="number" min={0} max={100} step={1} value={Math.round(pct)}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) onChange(Math.max(0, Math.min(100, v)) / 100);
          }}
          className="w-12 text-xs font-mono font-bold text-right px-1 py-0.5 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
        />
        <span className="text-[10px] font-mono text-text-muted/60 w-4">%</span>
      </div>
      {/* Tag badges */}
      <div className="flex gap-1 ml-8 mt-0.5 flex-wrap">
        {gene.affinityTags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono uppercase tracking-[0.15em] px-1 py-0 rounded"
            style={{ backgroundColor: `${config.color}${OPACITY_10}`, color: config.color }}
          >
            {tag.replace('Stat.', '')}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
