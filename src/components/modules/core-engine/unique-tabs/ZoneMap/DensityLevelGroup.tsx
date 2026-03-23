'use client';

import { Target, TrendingUp, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_PINK,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../_design';
import { HeatmapGrid } from '../_shared';
import {
  ENEMY_DENSITY_CONFIG, LEVEL_RANGE_BARS, PLAYER_LEVEL, MAX_LEVEL,
  STREAMING_BUDGETS,
} from './data';

const ACCENT = ACCENT_CYAN;

export function DensityLevelGroup() {
  return (
    <>
      {/* Enemy Density Heatmap */}
      <BlueprintPanel color={STATUS_ERROR} className="p-3">
        <SectionHeader icon={Target} label="Enemy Density Heatmap" color={STATUS_ERROR} />
        <HeatmapGrid
          rows={ENEMY_DENSITY_CONFIG.rows}
          cols={ENEMY_DENSITY_CONFIG.cols}
          cells={ENEMY_DENSITY_CONFIG.cells}
          lowColor="#1e3a5f"
          highColor={STATUS_ERROR}
          accent={STATUS_ERROR}
        />
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/40 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#1e3a5f' }} /> Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: STATUS_ERROR }} /> High
          </span>
          <span className="ml-auto opacity-70">Values = enemy count per sector</span>
        </div>
      </BlueprintPanel>

      {/* Level Range Flow */}
      <BlueprintPanel color={ACCENT} className="p-3">
        <SectionHeader icon={TrendingUp} label="Level Range Flow" color={ACCENT} />
        <div className="relative">
          {/* Player level indicator */}
          <div
            className="absolute top-0 bottom-0 w-[2px] z-10"
            style={{
              left: `${((PLAYER_LEVEL - 0.5) / MAX_LEVEL) * 100}%`,
              backgroundColor: ACCENT_PINK,
              boxShadow: `0 0 8px ${ACCENT_PINK}80`,
            }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${ACCENT_PINK}20`, color: ACCENT_PINK, border: `1px solid ${ACCENT_PINK}40` }}>
              Player Lvl {PLAYER_LEVEL}
            </div>
          </div>

          <div className="space-y-3 pt-6">
            {LEVEL_RANGE_BARS.map((bar) => {
              const leftPct = ((bar.min - 0.5) / MAX_LEVEL) * 100;
              const widthPct = ((bar.max - bar.min + 1) / MAX_LEVEL) * 100;
              return (
                <div key={bar.zone} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted w-28 truncate text-right flex-shrink-0">{bar.zone}</span>
                  <div className="relative flex-1 h-6 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6 }}
                      className="absolute top-0 bottom-0 rounded-md"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: `${bar.color}40`,
                        border: `1px solid ${bar.color}60`,
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold" style={{ color: bar.color }}>
                        {bar.min === bar.max ? `Lv${bar.min}` : `Lv${bar.min}-${bar.max}`}
                      </span>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Level axis */}
          <div className="flex items-center gap-3 mt-2">
            <span className="w-28 flex-shrink-0" />
            <div className="flex-1 flex justify-between text-[11px] font-mono text-text-muted px-1">
              {Array.from({ length: MAX_LEVEL }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
          </div>
        </div>
      </BlueprintPanel>

      {/* World Streaming Budget */}
      <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
        <SectionHeader icon={Gauge} label="World Streaming Budget" color={ACCENT_VIOLET} />
        <div className="space-y-3">
          {STREAMING_BUDGETS.map((budget) => {
            const pct = (budget.current / budget.max) * 100;
            const warnPct = budget.threshold ? (budget.threshold.warn / budget.max) * 100 : 80;
            const dangerPct = budget.threshold ? (budget.threshold.danger / budget.max) * 100 : 90;
            const barColor = pct >= dangerPct ? STATUS_ERROR : pct >= warnPct ? STATUS_WARNING : (budget.color ?? ACCENT);
            return (
              <div key={budget.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em]">
                  <span className="font-bold text-text-muted">{budget.label}</span>
                  <span className="font-bold" style={{ color: barColor }}>
                    {budget.current}{budget.unit} <span className="text-text-muted opacity-60">/ {budget.max}{budget.unit}</span>
                  </span>
                </div>
                <div className="relative h-5 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                  {budget.threshold && (
                    <>
                      <div className="absolute top-0 bottom-0 w-[1px] opacity-40" style={{ left: `${warnPct}%`, backgroundColor: STATUS_WARNING }} />
                      <div className="absolute top-0 bottom-0 w-[1px] opacity-40" style={{ left: `${dangerPct}%`, backgroundColor: STATUS_ERROR }} />
                    </>
                  )}
                  <NeonBar pct={pct} color={barColor} height={20} />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-text">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </BlueprintPanel>
    </>
  );
}
