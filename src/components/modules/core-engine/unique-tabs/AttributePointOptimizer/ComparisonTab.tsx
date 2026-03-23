'use client';

import { ArrowRight, Target, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from './design';
import { DeltaBadge } from './DeltaBadge';
import type { Allocation, BuildStats } from './data';
import { ACCENT, ATTR_COLORS } from './data';

/* ── Comparison Tab ───────────────────────────────────────────────────────── */

interface ComparisonTabProps {
  currentAlloc: Allocation;
  optimalAlloc: Allocation;
  currentStats: BuildStats;
  optimalStats: BuildStats;
  efficiency: number;
}

export function ComparisonTab({
  currentAlloc, optimalAlloc,
  currentStats, optimalStats,
  efficiency,
}: ComparisonTabProps) {
  const effColor = efficiency >= 90 ? STATUS_SUCCESS : efficiency >= 70 ? STATUS_WARNING : STATUS_ERROR;

  return (
    <motion.div key="comparison" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">

      {/* ── Stat Comparison ── */}
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader icon={TrendingUp} label="Stat Comparison" color={ACCENT} />
        <div className="space-y-1.5">
          <DeltaBadge current={currentStats.attackPower} optimal={optimalStats.attackPower} label="Attack Power" unit="" delay={0} />
          <DeltaBadge current={currentStats.critChance} optimal={optimalStats.critChance} label="Crit Chance" unit="%" delay={0.05} />
          <DeltaBadge current={currentStats.effectiveDPS} optimal={optimalStats.effectiveDPS} label="Effective DPS" unit="" delay={0.1} />
          <DeltaBadge current={currentStats.maxHP} optimal={optimalStats.maxHP} label="Max HP" unit="" delay={0.15} />
          <DeltaBadge current={currentStats.maxMana} optimal={optimalStats.maxMana} label="Max Mana" unit="" delay={0.2} />
        </div>
      </BlueprintPanel>

      {/* ── Allocation Delta ── */}
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader icon={Target} label="Allocation Delta" color={ACCENT} />
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'str' as const, label: 'STR' },
            { key: 'dex' as const, label: 'DEX' },
            { key: 'int' as const, label: 'INT' },
          ]).map(({ key, label }, idx) => {
            const color = ATTR_COLORS[key];
            const curr = currentAlloc[key];
            const opt = optimalAlloc[key];
            const delta = opt - curr;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                className="text-center p-3 rounded-lg border"
                style={{ borderColor: `${color}20`, backgroundColor: `${color}08` }}
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">{label}</div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-lg font-mono text-text tabular-nums">{curr}</span>
                  <ArrowRight className="w-3 h-3 text-text-muted" />
                  <span className="text-lg font-mono font-bold tabular-nums" style={{ color }}>{opt}</span>
                </div>
                {delta !== 0 && (
                  <div className="text-xs font-mono mt-1 tabular-nums" style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR }}>
                    {delta > 0 ? '+' : ''}{delta} pts
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </BlueprintPanel>

      {/* ── Efficiency Score ── */}
      <BlueprintPanel color={effColor} className="p-4">
        <SectionHeader icon={Target} label="Build Efficiency" color={effColor} />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <NeonBar pct={Math.min(efficiency, 100)} color={effColor} height={10} glow />
          </div>
          <motion.span
            key={efficiency}
            initial={{ scale: 1.3, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xl font-mono font-bold tabular-nums"
            style={{ color: effColor, textShadow: `0 0 12px ${effColor}40` }}
          >
            {efficiency}%
          </motion.span>
        </div>
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          {efficiency >= 95 ? 'Your allocation is near-optimal for the selected target.'
            : efficiency >= 80 ? 'Good allocation, but there is room for improvement. Consider redistributing points.'
            : 'Significant gains available. Click "Apply Optimal" to see the recommended allocation.'}
        </p>
      </BlueprintPanel>
    </motion.div>
  );
}
