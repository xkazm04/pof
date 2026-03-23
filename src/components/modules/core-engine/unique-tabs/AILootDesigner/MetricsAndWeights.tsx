'use client';

import { Settings2, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { TraitAxis } from '@/types/item-genome';
import type { Rarity, AffixPoolEntry, DropSimResult } from '@/lib/loot-designer/drop-simulator';
import { BlueprintPanel, SectionHeader, GlowStat, NeonBar } from './design';
import {
  ACCENT, AXIS_COLORS, AXIS_ICONS, AXIS_LABELS,
  RARITIES, STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO,
  ACCENT_EMERALD, ACCENT_ORANGE,
} from './constants';

/* -- Live metrics ---------------------------------------------------------- */

export function LiveMetrics({ simResult, rollCount, itemLevel }: { simResult: DropSimResult; rollCount: number; itemLevel: number }) {
  return (
    <BlueprintPanel color={STATUS_SUCCESS} className="p-2 space-y-3">
      <SectionHeader icon={Play} label="Live Results" color={STATUS_SUCCESS} />
      <div className="grid grid-cols-4 gap-1.5">
        <GlowStat label="Avg Affixes" value={simResult.avgAffixCount.toFixed(1)} color={ACCENT} delay={0} />
        <GlowStat label="Avg Power" value={simResult.avgPower.toFixed(0)} color={STATUS_WARNING} delay={0.05} />
        <GlowStat label="Items Rolled" value={rollCount.toLocaleString()} color={STATUS_INFO} delay={0.1} />
        <GlowStat label="Level Scale" value={`${(1 + 0.1 * Math.max(1, itemLevel)).toFixed(1)}x`} color={ACCENT_EMERALD} delay={0.15} />
      </div>

      {/* Axis coverage */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Axis Coverage</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(simResult.axisCoverage) as TraitAxis[]).map((ax) => {
            const pct = simResult.axisCoverage[ax];
            const Icon = AXIS_ICONS[ax];
            return (
              <div key={ax} className="space-y-0.5">
                <div className="flex items-center gap-1 text-xs font-mono">
                  <Icon className="w-3 h-3" style={{ color: AXIS_COLORS[ax] }} />
                  <span style={{ color: AXIS_COLORS[ax] }}>{AXIS_LABELS[ax]}</span>
                  <span className="ml-auto text-text-muted">{(pct * 100).toFixed(0)}%</span>
                </div>
                <NeonBar pct={pct * 100} color={AXIS_COLORS[ax]} height={6} glow />
              </div>
            );
          })}
        </div>
      </div>

      {/* Power histogram */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Power Distribution</span>
        <div className="flex items-end gap-px h-12">
          {simResult.powerHistogram.map((count, i) => {
            const maxH = Math.max(...simResult.powerHistogram) || 1;
            const h = (count / maxH) * 100;
            return (
              <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${h}%`, backgroundColor: ACCENT, opacity: 0.3 + (h / 100) * 0.7 }} title={`Bucket ${i + 1}: ${count} items`} />
            );
          })}
        </div>
      </div>
    </BlueprintPanel>
  );
}

/* -- Weight tuning --------------------------------------------------------- */

interface WeightTuningProps {
  affixPool: AffixPoolEntry[];
  customWeights: Record<string, number>;
  onUpdateWeight: (id: string, val: number) => void;
  onResetWeights: () => void;
  rarity: Rarity;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function WeightTuning({
  affixPool, customWeights, onUpdateWeight, onResetWeights,
  rarity, showAdvanced, onToggleAdvanced,
}: WeightTuningProps) {
  return (
    <BlueprintPanel color={ACCENT_ORANGE} className="p-2 space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Settings2} label="Affix Weights" color={ACCENT_ORANGE} />
        <div className="flex items-center gap-1.5">
          <button onClick={onResetWeights} className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50">
            Reset
          </button>
          <button onClick={onToggleAdvanced} className="flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-surface/50">
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAdvanced ? 'Less' : 'More'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {affixPool
          .filter((_, i) => showAdvanced || i < 8)
          .map((affix) => {
            const w = affix.designerWeight ?? affix.baseWeight;
            const isCustom = customWeights[affix.id] !== undefined;
            const eligible = RARITIES.indexOf(affix.minRarity as Rarity) <= RARITIES.indexOf(rarity);
            return (
              <div key={affix.id} className={`flex items-center gap-1.5 ${eligible ? '' : 'opacity-30'}`}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: AXIS_COLORS[affix.axis] }} />
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted truncate w-20">{affix.name}</span>
                <input type="range" min={0} max={50} step={1} value={Math.round(w * 10)} onChange={(e) => onUpdateWeight(affix.id, Number(e.target.value) / 10)} className="flex-1 h-1 accent-blue-500" disabled={!eligible} />
                <span className="text-xs font-mono w-8 text-right" style={{ color: isCustom ? STATUS_WARNING : 'var(--text-muted)' }}>
                  {w.toFixed(1)}
                </span>
              </div>
            );
          })}
      </div>
    </BlueprintPanel>
  );
}
