'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, Zap, Coins, Layers, PieChart } from 'lucide-react';
import {
  ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_20,
} from '@/lib/chart-colors';
import { motionSafe, EASE_OUT, STAGGER } from '@/lib/motion';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import type { ItemEconomyConfig, ItemEconomyResult } from '@/lib/economy/item-economy-engine';
import { ACCENT, RARITY_COLORS, RARITY_LABELS } from './constants';
import { PowerCurveChart } from './PowerCurveChart';
import { RarityStackChart, RarityLegend } from './RarityStackChart';

/* ── Stagger helper ─ shared chart entrance rhythm ─────────────────────── */

function StaggerItem({ index, children }: { index: number; children: ReactNode }) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe(
        { duration: 0.22, ease: EASE_OUT, delay: index * STAGGER.fast },
        prefersReduced,
      )}
    >
      {children}
    </motion.div>
  );
}

/* ── Power Curves Tab ─────────────────────────────────────────────────── */

export function PowerTab({ result, config }: {
  result: ItemEconomyResult; config: ItemEconomyConfig;
}) {
  return (
    <div className="space-y-3">
      <StaggerItem index={0}>
        <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
          <SectionHeader icon={TrendingUp} label="Item Power vs. Level" color={ACCENT} />
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Average equipped item power per level bracket. Band shows P10-P90 spread.
          </p>
          <div className="min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
            <PowerCurveChart data={result.powerCurve} />
          </div>
        </BlueprintPanel>
      </StaggerItem>

      <StaggerItem index={1}>
        <BlueprintPanel color={ACCENT_EMERALD} className="p-3 space-y-3">
          <SectionHeader icon={Zap} label="Gear Replacement Cadence" color={ACCENT_EMERALD} />
          <div className="flex gap-1 items-end h-24">
            {result.brackets.map((b) => {
              const maxR = Math.max(...result.brackets.map((br) => br.gearReplacementCount), 1);
              const h = (b.gearReplacementCount / maxR) * 80;
              return (
                <div
                  key={b.level}
                  className="flex-1 rounded-t-sm transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(h, 2)}%`,
                    backgroundColor: b.gearReplacementCount > 0 ? ACCENT_EMERALD : `${withOpacity(ACCENT_EMERALD, OPACITY_20)}`,
                    opacity: b.gearReplacementCount > 0 ? 0.7 : 0.2,
                  }}
                  title={`Lv${b.level}: ${b.gearReplacementCount} upgrades`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            <span>Lv1</span>
            <span>Lv{config.maxLevel}</span>
          </div>
        </BlueprintPanel>
      </StaggerItem>

      <StaggerItem index={2}>
        <BlueprintPanel color={ACCENT_ORANGE} className="p-3 space-y-3">
          <SectionHeader icon={Coins} label="Average Gold by Level" color={ACCENT_ORANGE} />
          <div className="flex gap-1 items-end h-20">
            {result.brackets.map((b) => {
              const maxG = Math.max(...result.brackets.map((br) => br.avgGold), 1);
              const h = (b.avgGold / maxG) * 80;
              return (
                <div
                  key={b.level}
                  className="flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(h, 2)}%`, backgroundColor: ACCENT_ORANGE, opacity: 0.6 }}
                  title={`Lv${b.level}: ${b.avgGold}g avg`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            <span>Lv1</span>
            <span>Lv{config.maxLevel}</span>
          </div>
        </BlueprintPanel>
      </StaggerItem>
    </div>
  );
}

/* ── Rarity Flow Tab ──────────────────────────────────────────────────── */

export function RarityTab({ result, config }: {
  result: ItemEconomyResult; config: ItemEconomyConfig;
}) {
  return (
    <div className="space-y-3">
      <StaggerItem index={0}>
        <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
          <SectionHeader icon={Layers} label="Rarity Distribution by Level" color={ACCENT} />
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            Stacked rarity breakdown showing how item quality shifts as players level up.
          </p>
          <div className="min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
            <RarityStackChart brackets={result.brackets} />
          </div>
          <RarityLegend />
        </BlueprintPanel>
      </StaggerItem>

      <StaggerItem index={1}>
        <BlueprintPanel color={ACCENT_ORANGE} className="p-3 space-y-3">
          <SectionHeader icon={PieChart} label="Rarity Inflation Index" color={ACCENT_ORANGE} />
          <div className="grid grid-cols-3 gap-3">
            <RarityBreakdown
              label="Early Game" sublabel="(Lv 1-5)"
              brackets={result.brackets.slice(0, 5)}
            />
            <GlowStat
              label="Inflation"
              value={`${result.rarityInflation.toFixed(1)}x`}
              color={
                result.rarityInflation > 5 ? STATUS_ERROR
                  : result.rarityInflation > 3 ? STATUS_WARNING
                    : STATUS_SUCCESS
              }
            />
            <RarityBreakdown
              label="Endgame" sublabel={`(Lv ${config.maxLevel - 3}+)`}
              brackets={result.brackets.slice(-4)}
            />
          </div>
        </BlueprintPanel>
      </StaggerItem>
    </div>
  );
}

/* ── Rarity Breakdown helper ──────────────────────────────────────────── */

function RarityBreakdown({ label, sublabel, brackets }: {
  label: string; sublabel: string;
  brackets: { rarityDistribution: Record<string, number> }[];
}) {
  return (
    <BlueprintPanel color={ACCENT} className="p-2 text-center">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block">
        {label}
      </span>
      <span className="text-xs font-mono text-text block">{sublabel}</span>
      <div className="flex gap-1 mt-1 justify-center">
        {RARITY_LABELS.map((r) => {
          const avg = brackets.reduce((s, b) => s + (b.rarityDistribution[r] ?? 0), 0)
            / Math.max(brackets.length, 1);
          return avg > 0.005 ? (
            <span key={r} className="text-xs font-mono font-bold" style={{ color: RARITY_COLORS[r] }}>
              {(avg * 100).toFixed(0)}%
            </span>
          ) : null;
        })}
      </div>
    </BlueprintPanel>
  );
}
