'use client';

import { useMemo } from 'react';
import { Timer, Skull, Swords, Footprints } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_ERROR,
  ACCENT_ORANGE, ACCENT_VIOLET, ACCENT_EMERALD,
  OPACITY_8, OPACITY_12, OPACITY_25,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  ZONE_PLAYTIME, CRITICAL_PATH, ALL_PATHS, formatPlaytime,
} from '../_shared/data';
import type { PlaytimePathMode } from '../_shared/data';

export function PlaytimeBreakdownTable({ mode }: { mode: PlaytimePathMode }) {
  const pathData = mode === 'critical' ? CRITICAL_PATH : ALL_PATHS;
  const nodesOnPath = useMemo(() => new Set(pathData.nodes.map(n => n.zoneId)), [pathData]);

  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-3">
      <SectionHeader icon={Timer} label="Per-Zone Time Breakdown" color={ACCENT_ORANGE} />
      <div className="space-y-1.5">
        {ZONE_PLAYTIME.map((zp) => {
          const onPath = nodesOnPath.has(zp.zoneId);
          const maxSec = Math.max(...ZONE_PLAYTIME.map(z => z.totalSec));
          const barPct = maxSec > 0 ? (zp.totalSec / maxSec) * 100 : 0;
          return (
            <div key={zp.zoneId} className="flex items-center gap-3" style={{ opacity: onPath ? 1 : 0.4 }}>
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate text-right flex-shrink-0">{zp.zoneName}</span>
              <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ duration: 0.6 }}
                  className="absolute top-0 bottom-0 rounded-md"
                  style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT_ORANGE, OPACITY_25)}, ${withOpacity(ACCENT_ORANGE, OPACITY_12)})`, borderRight: `2px solid ${ACCENT_ORANGE}` }}
                />
                <div className="absolute inset-0 flex items-center">
                  {zp.combatSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.combatSec / zp.totalSec) * barPct}%`, color: STATUS_ERROR, backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8) }}>
                      <Swords className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.combatSec)}
                    </div>
                  )}
                  {zp.bossSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.bossSec / zp.totalSec) * barPct}%`, color: ACCENT_VIOLET, backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_8) }}>
                      <Skull className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.bossSec)}
                    </div>
                  )}
                  {zp.explorationSec > 0 && (
                    <div className="h-full flex items-center justify-center text-[9px] font-mono" style={{ width: `${(zp.explorationSec / zp.totalSec) * barPct}%`, color: ACCENT_EMERALD, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_8) }}>
                      <Footprints className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />{formatPlaytime(zp.explorationSec)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold w-14 text-right flex-shrink-0" style={{ color: onPath ? ACCENT_ORANGE : 'var(--text-muted)' }}>
                {formatPlaytime(zp.totalSec)}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          <Swords className="w-3 h-3" style={{ color: STATUS_ERROR }} /> Combat
        </span>
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          <Skull className="w-3 h-3" style={{ color: ACCENT_VIOLET }} /> Boss
        </span>
        <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
          <Footprints className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> Exploration
        </span>
        <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] text-text-muted opacity-60">
          Faded zones = off {mode === 'critical' ? 'critical path' : 'selected path'}
        </span>
      </div>
    </BlueprintPanel>
  );
}
