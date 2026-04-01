'use client';

import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { KILL_DEATH_STATS, MAX_KILLS_ON_PLAYER, DEATH_CAUSES } from './data';
import { STATUS_ERROR } from '@/lib/chart-colors';

interface KillDeathStatsProps {
  accent: string;
}

export function KillDeathStats({ accent }: KillDeathStatsProps) {
  return (
    <BlueprintPanel color={accent} className="p-3">
      <SectionHeader icon={BarChart3} label="Kill/Death Statistics" color={STATUS_ERROR} />
      <div className="mt-3 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {KILL_DEATH_STATS.map((arch, i) => (
            <motion.div
              key={arch.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-surface-deep rounded-lg border p-3 space-y-3 relative overflow-hidden"
              style={{ borderColor: `${arch.color}30` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{arch.label}</span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${arch.color}15`,
                    borderColor: `${arch.color}40`,
                    color: arch.color,
                  }}
                >
                  #{arch.dangerRank}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Spawned</span>
                  <span className="font-mono font-bold text-text">{arch.timesSpawned.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Killed</span>
                  <span className="font-mono font-bold text-text">{arch.timesKilled.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Avg Life</span>
                  <span className="font-mono font-bold text-text">{arch.avgLifespan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Player Kills</span>
                  <span className="font-mono font-bold" style={{ color: arch.color }}>{arch.killsOnPlayer}</span>
                </div>
                <div className="col-span-2 flex justify-between">
                  <span className="text-text-muted">Total Dmg</span>
                  <span className="font-mono font-bold text-text">{arch.totalDmgDealt.toLocaleString()}</span>
                </div>
              </div>
              <NeonBar pct={(arch.killsOnPlayer / MAX_KILLS_ON_PLAYER) * 100} color={arch.color} height={4} />
            </motion.div>
          ))}
        </div>

        {/* Death causes + Danger ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DeathCausesPie />
          <DangerRanking />
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* ── Death causes pie chart ───────────────────────────────────────────── */

function DeathCausesPie() {
  return (
    <div className="bg-surface-deep rounded-lg border border-border/30 p-3">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
        Death Causes
      </div>
      <div className="flex items-center gap-3">
        <svg width={200} height={200} viewBox="0 0 64 64" className="flex-shrink-0">
          {(() => {
            let cumAngle = 0;
            return DEATH_CAUSES.map(dc => {
              const startAngle = cumAngle;
              const sliceAngle = (dc.pct / 100) * 360;
              cumAngle += sliceAngle;
              const startRad = (startAngle - 90) * (Math.PI / 180);
              const endRad = (startAngle + sliceAngle - 90) * (Math.PI / 180);
              const largeArc = sliceAngle > 180 ? 1 : 0;
              const x1 = 32 + 28 * Math.cos(startRad);
              const y1 = 32 + 28 * Math.sin(startRad);
              const x2 = 32 + 28 * Math.cos(endRad);
              const y2 = 32 + 28 * Math.sin(endRad);
              return (
                <path
                  key={dc.cause}
                  d={`M 32 32 L ${x1} ${y1} A 28 28 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={dc.color} opacity={0.8}
                />
              );
            });
          })()}
        </svg>
        <div className="space-y-1">
          {DEATH_CAUSES.map(dc => (
            <div key={dc.cause} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: dc.color }} />
              <span className="text-text-muted font-medium">{dc.cause}</span>
              <span className="font-mono font-bold text-text ml-auto">{dc.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Danger ranking bar chart ─────────────────────────────────────────── */

function DangerRanking() {
  return (
    <div className="bg-surface-deep rounded-lg border border-border/30 p-3">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
        Danger Ranking (Player Kills)
      </div>
      <div className="space-y-3">
        {[...KILL_DEATH_STATS].sort((a, b) => a.dangerRank - b.dangerRank).map(arch => (
          <div key={arch.id} className="space-y-0.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-text">{arch.label}</span>
              <span className="font-mono font-bold" style={{ color: arch.color }}>
                {arch.killsOnPlayer} kills
              </span>
            </div>
            <NeonBar pct={(arch.killsOnPlayer / MAX_KILLS_ON_PLAYER) * 100} color={arch.color} glow />
          </div>
        ))}
      </div>
    </div>
  );
}
