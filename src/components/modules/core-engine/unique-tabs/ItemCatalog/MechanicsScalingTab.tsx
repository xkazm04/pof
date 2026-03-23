'use client';

import { useCallback } from 'react';
import { Layers, Target, TreePine, TrendingUp, Scale, Loader2 } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { motion } from 'framer-motion';
import type { SubModuleId } from '@/types/modules';
import type { FeatureStatus, FeatureRow } from '@/types/feature-matrix';
import { PipelineFlow, STATUS_COLORS, RadarChart } from '../_shared';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { AffixSunburst } from './AffixSunburst';
import { ItemScalingChart } from './ItemScalingChart';
import { buildBalancePrompt } from './balance-prompt';
import {
  ACCENT, RARITY_COLORS, SYSTEM_PIPELINE, POWER_BUDGET_AXES,
  IRON_LONGSWORD_RADAR, VOID_DAGGERS_RADAR, AFFIX_PROB_TREE,
  SCALING_LINES, DUMMY_ITEMS, AFFIX_EXAMPLES, ITEM_SETS, RARITY_DIST,
} from './data';

/* ── MechanicsScalingTab ───────────────────────────────────────────────── */

interface MechanicsScalingTabProps {
  moduleId: SubModuleId;
  featureMap: Map<string, FeatureRow>;
}

export function MechanicsScalingTab({ moduleId, featureMap }: MechanicsScalingTabProps) {
  const { execute: executeBalanceAdvisor, isRunning: isBalanceRunning } = useModuleCLI({
    moduleId, sessionKey: 'item-balance-advisor', label: 'Balance Advisor', accentColor: ACCENT,
  });

  const items = DUMMY_ITEMS;

  const handleAnalyzeBalance = useCallback(() => {
    const prompt = buildBalancePrompt(items);
    executeBalanceAdvisor({ type: 'ask-claude', moduleId, prompt, label: 'Affix Balance Advisor' });
  }, [items, moduleId, executeBalanceAdvisor]);

  return (
    <motion.div key="mechanics-scaling" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* System pipeline */}
      <BlueprintPanel color={ACCENT} className="p-3 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent pointer-events-none" />
        <SectionHeader icon={Layers} label="System Pipeline" color={ACCENT} />
        <div className="mt-2.5 relative z-10">
          <PipelineFlow
            steps={SYSTEM_PIPELINE.map(n => ({ label: n.label, status: (featureMap.get(n.featureName)?.status ?? 'unknown') as FeatureStatus }))}
            accent={ACCENT} showStatus />
        </div>
      </BlueprintPanel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Power Budget Radar */}
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader icon={Target} label="Item Power Budget Radar" color={ACCENT} />
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Compare item power distribution across 5 budget axes.</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex flex-col items-center gap-2">
              <RadarChart data={IRON_LONGSWORD_RADAR} size={180} accent={RARITY_COLORS.Common}
                overlays={[{ data: VOID_DAGGERS_RADAR, color: RARITY_COLORS.Legendary, label: 'Void Daggers' }]} showLabels />
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: RARITY_COLORS.Common }} />
                <span className="text-text-muted font-mono">Iron Longsword</span>
                <span className="text-text-muted opacity-50">(Common)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 rounded border-b border-dashed" style={{ borderColor: RARITY_COLORS.Legendary, backgroundColor: 'transparent' }} />
                <span className="text-text-muted font-mono">Void Daggers</span>
                <span className="font-medium" style={{ color: RARITY_COLORS.Legendary }}>(Legendary)</span>
              </div>
              <div className="mt-2 p-2 rounded-lg bg-surface-deep border" style={{ borderColor: `${ACCENT}20` }}>
                {POWER_BUDGET_AXES.map((axis, i) => {
                  const a = IRON_LONGSWORD_RADAR[i].value;
                  const b = VOID_DAGGERS_RADAR[i].value;
                  const delta = ((b - a) * 100).toFixed(0);
                  return (
                    <div key={axis} className="flex items-center gap-2 font-mono text-sm">
                      <span className="w-14 text-text-muted">{axis}</span>
                      <span className="text-text">{(a * 100).toFixed(0)}%</span>
                      <span className="text-text-muted">vs</span>
                      <span className="text-text">{(b * 100).toFixed(0)}%</span>
                      <span className={Number(delta) > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {Number(delta) > 0 ? '+' : ''}{delta}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </BlueprintPanel>

        {/* Affix Probability Tree */}
        <BlueprintPanel color={ACCENT} className="p-4">
          <SectionHeader icon={TreePine} label="Affix Probability Tree" color={ACCENT} />
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Sunburst view: center = Rare rarity, first ring = prefix count, second ring = specific affixes.</p>
          <div className="flex items-center justify-center">
            <AffixSunburst tree={AFFIX_PROB_TREE} size={260} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {AFFIX_PROB_TREE.children?.map(c => (
              <span key={c.id} className="text-sm font-mono px-2 py-0.5 rounded border" style={{ color: c.color, borderColor: `${c.color}40`, backgroundColor: `${c.color}10` }}>
                {c.label}: {(c.probability * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </BlueprintPanel>
      </div>

      {/* Item Level Scaling */}
      <BlueprintPanel color={ACCENT} className="p-4">
        <SectionHeader icon={TrendingUp} label="Item Level Scaling Preview" color={ACCENT} />
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Stat values across item levels 1-50 with min-max bands.</p>
        <div className="flex justify-center">
          <ItemScalingChart lines={SCALING_LINES} width={280} height={110} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 justify-center">
          {SCALING_LINES.map(line => (
            <span key={line.label} className="flex items-center gap-1.5 text-sm font-mono">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: line.color }} />
              <span style={{ color: line.color }}>{line.label}</span>
            </span>
          ))}
        </div>
      </BlueprintPanel>

      {/* AI Balance Advisor */}
      <BlueprintPanel color={ACCENT} className="p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}60, transparent)` }} />
        <div className="flex items-center justify-between">
          <div>
            <SectionHeader icon={Scale} label="AI Balance Advisor" color={ACCENT} />
            <p className="text-[10px] font-mono text-text-muted">
              Analyze power budgets, affix scaling, DPS outliers, set bonus balance, and rarity distribution health.
            </p>
          </div>
          <button onClick={handleAnalyzeBalance} disabled={isBalanceRunning}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: isBalanceRunning ? `${ACCENT}10` : `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40`, boxShadow: isBalanceRunning ? 'none' : `0 0 12px ${ACCENT}15` }}>
            {isBalanceRunning
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing...</>
              : <><Scale className="w-3.5 h-3.5" />Analyze Balance</>}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: 'Items', value: `${items.length}`, sub: 'catalog entries' },
            { label: 'Affixes', value: `${AFFIX_EXAMPLES.length}`, sub: 'pool definitions' },
            { label: 'Scaling', value: `${SCALING_LINES.length}`, sub: 'stat curves' },
            { label: 'Sets', value: `${ITEM_SETS.length}`, sub: 'bonus sets' },
            { label: 'Rarities', value: `${RARITY_DIST.length}`, sub: 'tiers tracked' },
          ].map((metric, i) => (
            <GlowStat key={metric.label} label={metric.label} value={metric.value} color={ACCENT} delay={i * 0.05} />
          ))}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
