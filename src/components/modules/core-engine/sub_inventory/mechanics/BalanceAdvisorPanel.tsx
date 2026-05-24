'use client';

import { Scale, Loader2 } from 'lucide-react';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import {
  ACCENT, AFFIX_EXAMPLES, ITEM_SETS, RARITY_DIST, SCALING_LINES,
} from '../_shared/data';
import { withOpacity, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_37 } from '@/lib/chart-colors';

interface Props {
  itemsCount: number;
  isRunning: boolean;
  onAnalyze: () => void;
}

export function BalanceAdvisorPanel({ itemsCount, isRunning, onAnalyze }: Props) {
  return (
    <BlueprintPanel color={ACCENT} className="p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT, OPACITY_37)}, transparent)` }} />
      <div className="flex items-center justify-between">
        <div>
          <SectionHeader icon={Scale} label="AI Balance Advisor" color={ACCENT} />
          <p className="text-xs font-mono text-text-muted">
            Analyze power budgets, affix scaling, DPS outliers, set bonus balance, and rarity distribution health.
          </p>
        </div>
        <button onClick={onAnalyze} disabled={isRunning}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer"
          style={{ backgroundColor: isRunning ? `${withOpacity(ACCENT, OPACITY_8)}` : `${withOpacity(ACCENT, OPACITY_12)}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}`, boxShadow: isRunning ? 'none' : `0 0 12px ${withOpacity(ACCENT, OPACITY_10)}` }}>
          {isRunning
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analyzing...</>
            : <><Scale className="w-3.5 h-3.5" />Analyze Balance</>}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Items', value: `${itemsCount}`, sub: 'catalog entries' },
          { label: 'Affixes', value: `${AFFIX_EXAMPLES.length}`, sub: 'pool definitions' },
          { label: 'Scaling', value: `${SCALING_LINES.length}`, sub: 'stat curves' },
          { label: 'Sets', value: `${ITEM_SETS.length}`, sub: 'bonus sets' },
          { label: 'Rarities', value: `${RARITY_DIST.length}`, sub: 'tiers tracked' },
        ].map((metric, i) => (
          <GlowStat key={metric.label} label={metric.label} value={metric.value} color={ACCENT} delay={i * 0.05} />
        ))}
      </div>
    </BlueprintPanel>
  );
}
