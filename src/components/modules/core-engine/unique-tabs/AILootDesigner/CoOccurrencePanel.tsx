'use client';

import { useMemo } from 'react';
import { Grid3X3, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_10 } from '@/lib/chart-colors';
import type { AffixPoolEntry, DropSimResult } from '@/lib/loot-designer/drop-simulator';
import type { HeatmapCell } from '@/types/unique-tab-improvements';
import { HeatmapGrid } from '../_shared';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT, AXIS_COLORS, ACCENT_VIOLET } from './constants';

export function CoOccurrencePanel({ simResult, affixPool }: { simResult: DropSimResult; affixPool: AffixPoolEntry[] }) {
  const activeAffixes = useMemo(() =>
    affixPool.filter((a) =>
      simResult.affixDistributions.some((d) => d.affixId === a.id && d.frequency > 0)
    ),
    [affixPool, simResult.affixDistributions]
  );

  const coMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const cell of simResult.coOccurrence) {
      m.set(`${cell.affixA}|${cell.affixB}`, cell.probability);
      m.set(`${cell.affixB}|${cell.affixA}`, cell.probability);
    }
    return m;
  }, [simResult.coOccurrence]);

  const rows = activeAffixes.map((a) => a.name);
  const cols = activeAffixes.map((a) => a.name);

  const cells = useMemo((): HeatmapCell[] => {
    const result: HeatmapCell[] = [];
    for (let ri = 0; ri < activeAffixes.length; ri++) {
      for (let ci = 0; ci < activeAffixes.length; ci++) {
        if (ri === ci) {
          const dist = simResult.affixDistributions.find((d) => d.affixId === activeAffixes[ri].id);
          result.push({
            row: ri, col: ci, value: dist?.frequency ?? 0,
            tooltip: `${activeAffixes[ri].name}: ${((dist?.frequency ?? 0) * 100).toFixed(0)}% occurrence`,
          });
        } else {
          const key = `${activeAffixes[ri].id}|${activeAffixes[ci].id}`;
          const prob = coMap.get(key) ?? 0;
          result.push({
            row: ri, col: ci, value: prob,
            tooltip: `${activeAffixes[ri].name} + ${activeAffixes[ci].name}: ${(prob * 100).toFixed(1)}%`,
          });
        }
      }
    }
    return result;
  }, [activeAffixes, coMap, simResult.affixDistributions]);

  const topPairs = useMemo(() =>
    [...simResult.coOccurrence]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 8),
    [simResult.coOccurrence]
  );

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <BlueprintPanel color={ACCENT} className="p-2 space-y-3">
        <SectionHeader icon={Grid3X3} label="Affix Co-Occurrence Matrix" color={ACCENT} />
        <div className="overflow-x-auto custom-scrollbar">
          <HeatmapGrid rows={rows} cols={cols} cells={cells} accent={ACCENT} />
        </div>
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT_VIOLET} className="p-2 space-y-3">
        <SectionHeader icon={BarChart3} label="Top Affix Pairs" color={ACCENT_VIOLET} />
        <div className="space-y-1">
          {topPairs.map((pair, i) => {
            const nameA = affixPool.find((a) => a.id === pair.affixA)?.name ?? pair.affixA;
            const nameB = affixPool.find((a) => a.id === pair.affixB)?.name ?? pair.affixB;
            const axisA = affixPool.find((a) => a.id === pair.affixA)?.axis ?? 'offensive';
            const axisB = affixPool.find((a) => a.id === pair.affixB)?.axis ?? 'offensive';
            return (
              <div key={`${pair.affixA}-${pair.affixB}`} className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-text-muted w-4">{i + 1}.</span>
                <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${AXIS_COLORS[axisA]}${OPACITY_10}`, color: AXIS_COLORS[axisA] }}>
                  {nameA}
                </span>
                <span className="text-text-muted">+</span>
                <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${AXIS_COLORS[axisB]}${OPACITY_10}`, color: AXIS_COLORS[axisB] }}>
                  {nameB}
                </span>
                <span className="ml-auto" style={{ color: ACCENT_VIOLET }}>
                  {(pair.probability * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
