'use client';

import { useMemo } from 'react';
import { Scale, Loader2 } from 'lucide-react';
import { BlueprintPanel, SectionHeader, GlowStat } from '../../unique-tabs/_design';
import { ACCENT, ITEM_SETS, SCALING_LINES, type ItemData } from '../_shared/data';
import { deriveAffixPool, deriveDpsTable } from '../_shared/balance-evidence';
import { withOpacity, OPACITY_8, OPACITY_10, OPACITY_12, OPACITY_25, OPACITY_37 } from '@/lib/chart-colors';

interface Props {
  /** The item set the advisor prompt is built from. */
  items: ItemData[];
  isRunning: boolean;
  onAnalyze: () => void;
}

export function BalanceAdvisorPanel({ items, isRunning, onAnalyze }: Props) {
  // The tiles count the same derived evidence the prompt quotes.
  const counts = useMemo(() => {
    const weapons = items.filter(i => i.type === 'Weapon');
    const dps = deriveDpsTable(weapons);
    return { affixes: deriveAffixPool(items).length, dpsParsed: dps.rows.length, dpsUnparsed: dps.unparsed.length };
  }, [items]);
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
          { label: 'Items', value: `${items.length}`, unit: 'entries' },
          { label: 'Affixes', value: `${counts.affixes}`, unit: 'carried' },
          { label: 'DPS', value: `${counts.dpsParsed}`, unit: `${counts.dpsUnparsed} unparsed` },
          { label: 'Scaling', value: `${SCALING_LINES.length}`, unit: 'curves' },
          { label: 'Sets', value: `${ITEM_SETS.length}`, unit: 'bonus sets' },
        ].map((metric, i) => (
          <GlowStat key={metric.label} label={metric.label} value={metric.value} unit={metric.unit} color={ACCENT} delay={i * 0.05} />
        ))}
      </div>
    </BlueprintPanel>
  );
}
