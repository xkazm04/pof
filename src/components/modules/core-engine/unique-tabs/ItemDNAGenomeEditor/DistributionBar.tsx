'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { BarChart3 } from 'lucide-react';
import type { ItemGenome } from '@/types/item-genome';
import { predictDistribution } from '@/lib/item-dna/rolling-engine';
import { AXIS_CONFIGS, DEMO_AFFIX_POOL, ACCENT } from './data';

/* ── Predicted Distribution Bar ────────────────────────────────────────── */

export function DistributionBar({ genome, rarity }: { genome: ItemGenome; rarity: string }) {
  const dist = useMemo(
    () => predictDistribution(genome, DEMO_AFFIX_POOL, rarity),
    [genome, rarity],
  );

  return (
    <div className="space-y-2">
      <SectionHeader label={`Predicted Distribution (${rarity})`} color={ACCENT} icon={BarChart3} />
      <div className="flex h-5 rounded-md overflow-hidden border border-border/40">
        {AXIS_CONFIGS.map((cfg) => {
          const pct = (dist[cfg.axis] * 100);
          if (pct < 1) return null;
          return (
            <motion.div
              key={cfg.axis}
              className="h-full flex items-center justify-center text-xs font-mono font-bold"
              style={{ backgroundColor: `${cfg.color}60`, width: `${pct}%`, color: cfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
              title={`${cfg.label}: ${pct.toFixed(1)}%`}
            >
              {pct > 10 ? `${pct.toFixed(0)}%` : ''}
            </motion.div>
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {AXIS_CONFIGS.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <div key={cfg.axis} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em]">
              <Icon className="w-3 h-3" style={{ color: cfg.color }} />
              <span style={{ color: cfg.color }}>{(dist[cfg.axis] * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
