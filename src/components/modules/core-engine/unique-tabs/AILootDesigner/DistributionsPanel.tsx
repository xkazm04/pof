'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AffixPoolEntry, DropSimResult } from '@/lib/loot-designer/drop-simulator';
import { BlueprintPanel, SectionHeader, NeonBar } from './design';
import { ACCENT, AXIS_COLORS, ACCENT_EMERALD, STATUS_WARNING } from './constants';

export function DistributionsPanel({ simResult }: { simResult: DropSimResult; affixPool: AffixPoolEntry[] }) {
  const sorted = useMemo(() =>
    [...simResult.affixDistributions]
      .filter((d) => d.frequency > 0)
      .sort((a, b) => b.frequency - a.frequency),
    [simResult.affixDistributions]
  );

  const maxFreq = sorted.length > 0 ? sorted[0].frequency : 1;

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Frequency bar chart */}
      <BlueprintPanel color={ACCENT} className="p-2 space-y-3">
        <SectionHeader icon={BarChart3} label="Affix Frequency" color={ACCENT} />
        <div className="space-y-1">
          {sorted.map((dist) => {
            const barW = (dist.frequency / maxFreq) * 100;
            return (
              <div key={dist.affixId} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: AXIS_COLORS[dist.axis] }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted truncate w-24">{dist.name}</span>
                <div className="flex-1">
                  <NeonBar pct={barW} color={AXIS_COLORS[dist.axis]} height={12} glow />
                </div>
                <span className="text-xs font-mono w-10 text-right" style={{ color: AXIS_COLORS[dist.axis] }}>
                  {(dist.frequency * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>

      {/* Magnitude ranges */}
      <BlueprintPanel color={STATUS_WARNING} className="p-2 space-y-3">
        <SectionHeader icon={BarChart3} label="Magnitude Ranges" color={STATUS_WARNING} />
        <div className="space-y-1">
          {sorted.map((dist) => (
            <div key={dist.affixId} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: AXIS_COLORS[dist.axis] }} />
              <span className="text-text-muted truncate w-24">{dist.name}</span>
              <span className="text-text-muted">{dist.minMagnitude}</span>
              <div className="flex-1 h-2 bg-surface-deep rounded-full overflow-hidden relative">
                <div className="absolute h-full rounded-full opacity-30" style={{ backgroundColor: AXIS_COLORS[dist.axis], left: '0%', width: '100%' }} />
                {dist.maxMagnitude > dist.minMagnitude && (
                  <div
                    className="absolute top-0 bottom-0 w-1 rounded-full"
                    style={{
                      backgroundColor: AXIS_COLORS[dist.axis],
                      left: `${((dist.avgMagnitude - dist.minMagnitude) / (dist.maxMagnitude - dist.minMagnitude)) * 100}%`,
                      boxShadow: `0 0 4px ${AXIS_COLORS[dist.axis]}`,
                    }}
                  />
                )}
              </div>
              <span style={{ color: AXIS_COLORS[dist.axis] }}>{dist.maxMagnitude}</span>
              <span className="text-text-muted opacity-60 w-10 text-right">avg {dist.avgMagnitude}</span>
            </div>
          ))}
        </div>
      </BlueprintPanel>

      {/* Affix count breakdown */}
      <BlueprintPanel color={ACCENT_EMERALD} className="p-2 space-y-3">
        <SectionHeader icon={BarChart3} label="Affix Count Distribution" color={ACCENT_EMERALD} />
        <div className="flex items-end gap-2 h-16">
          {simResult.rarityBreakdown.map((rb) => {
            const maxC = Math.max(...simResult.rarityBreakdown.map((r) => r.count)) || 1;
            const h = (rb.count / maxC) * 100;
            return (
              <div key={rb.affixCount} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-xs font-mono text-text-muted">{rb.count}</span>
                <div className="w-full rounded-t-sm" style={{ height: `${h}%`, backgroundColor: ACCENT_EMERALD, opacity: 0.4 + (h / 100) * 0.6 }} />
                <span className="text-xs font-mono text-text-muted">{rb.affixCount}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted text-center opacity-60">
          number of affixes per item
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
