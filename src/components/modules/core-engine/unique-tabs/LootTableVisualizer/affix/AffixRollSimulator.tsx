'use client';

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_8, OPACITY_30, STATUS_WARNING, ACCENT_EMERALD, ACCENT_VIOLET, withOpacity, OPACITY_12 } from '@/lib/chart-colors';
import { HeatmapGrid } from '../../_shared';
import {
  AFFIX_DEFS,
  AFFIX_COOCCURRENCE_ROWS,
  AFFIX_COOCCURRENCE_COLS, AFFIX_COOCCURRENCE_CELLS,
} from '../data';
import type { AffixDef } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';
import { ScalableSelector } from '@/components/shared/ScalableSelector';

const CATEGORY_COLORS: Record<string, string> = {
  Offensive: STATUS_WARNING,
  Defensive: ACCENT_EMERALD,
  Utility: ACCENT_VIOLET,
};

export function AffixRollSimulator() {
  const [affixSlots, setAffixSlots] = useState<string[]>(['?', '?', '?']);
  const [affixSpinning, setAffixSpinning] = useState(false);
  const [affixHistory, setAffixHistory] = useState<Record<string, number>>({});
  const [affixRollCount, setAffixRollCount] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedAffixIds, setSelectedAffixIds] = useState<string[]>(AFFIX_DEFS.map(a => a.id));

  const activePool = useMemo(
    () => AFFIX_DEFS.filter(a => selectedAffixIds.includes(a.id)),
    [selectedAffixIds],
  );

  const spinAffixes = useCallback(() => {
    if (activePool.length === 0) return;
    setAffixSpinning(true);
    setTimeout(() => {
      const totalWeight = activePool.reduce((s, a) => s + a.weight, 0);
      const picks: string[] = [];
      for (let i = 0; i < 3; i++) {
        let roll = Math.random() * totalWeight;
        for (const affix of activePool) {
          roll -= affix.weight;
          if (roll <= 0) { picks.push(affix.name); break; }
        }
        if (picks.length <= i) picks.push(activePool[0].name); // fallback
      }
      setAffixSlots(picks);
      setAffixSpinning(false);
      setAffixRollCount((c) => c + 1);
      setAffixHistory((prev) => {
        const next = { ...prev };
        for (const p of picks) next[p] = (next[p] ?? 0) + 1;
        return next;
      });
    }, 600);
  }, [activePool]);

  const renderAffixItem = useCallback((item: AffixDef, selected: boolean) => {
    const catColor = CATEGORY_COLORS[item.category] ?? STATUS_WARNING;
    return (
      <div className="px-2 py-1.5 rounded text-left transition-all"
        style={{
          backgroundColor: selected ? withOpacity(catColor, OPACITY_12) : 'transparent',
          outline: selected ? `1px solid ${catColor}` : 'none',
        }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold" style={{ color: catColor }}>{item.name}</span>
          <span className="text-2xs font-mono text-text-muted ml-auto">T{item.tier}</span>
        </div>
        <div className="text-2xs text-text-muted mt-0.5">{item.description}</div>
      </div>
    );
  }, []);

  return (
    <BlueprintPanel className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <SectionHeader icon={Sparkles} label="Affix Roll Simulator" color={STATUS_WARNING} />
        <button
          onClick={() => setSelectorOpen(true)}
          className="ml-auto flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded border transition-all hover:opacity-80 cursor-pointer"
          style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_30), color: STATUS_WARNING }}
        >
          <Settings2 className="w-3 h-3" />
          Pool ({activePool.length}/{AFFIX_DEFS.length})
        </button>
      </div>
      <div className="text-2xs text-text-muted font-mono mb-3">
        Godroll: {activePool.length >= 3 ? ((1 / activePool.length) * 100).toFixed(2) : '0'}% &middot; Weighted roll
      </div>

      {/* Category breakdown */}
      <div className="flex gap-2 mb-3">
        {(['Offensive', 'Defensive', 'Utility'] as const).map(cat => {
          const count = activePool.filter(a => a.category === cat).length;
          const color = CATEGORY_COLORS[cat];
          return (
            <span key={cat} className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: withOpacity(color, OPACITY_8), color }}>
              {cat}: {count}
            </span>
          );
        })}
      </div>

      {/* Slot machine */}
      <div className="flex items-center justify-center gap-3 mb-3">
        {affixSlots.map((slot, i) => (
          <motion.div
            key={i}
            className="w-24 h-12 rounded-lg border flex items-center justify-center text-xs font-mono font-bold overflow-hidden"
            style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_30), backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8), color: STATUS_WARNING }}
            animate={affixSpinning ? { y: [0, -10, 10, -5, 5, 0] } : {}}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {affixSpinning ? '...' : slot}
          </motion.div>
        ))}
        <button
          onClick={spinAffixes}
          disabled={affixSpinning || activePool.length === 0}
          className="text-xs font-semibold px-3 py-2 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer"
          style={{ borderColor: withOpacity(STATUS_WARNING, OPACITY_30), backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8), color: STATUS_WARNING }}
        >
          Spin
        </button>
      </div>
      {affixRollCount > 0 && (
        <div className="text-2xs text-text-muted mb-2 text-center font-mono">{affixRollCount} roll{affixRollCount !== 1 ? 's' : ''} performed</div>
      )}
      {/* Frequency table */}
      {Object.keys(affixHistory).length > 0 && (
        <div className="space-y-1 mb-3">
          <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Affix Frequency</div>
          {Object.entries(affixHistory).sort((a, b) => b[1] - a[1]).map(([affix, count]) => {
            const def = AFFIX_DEFS.find(a => a.name === affix);
            const catColor = def ? CATEGORY_COLORS[def.category] ?? STATUS_WARNING : STATUS_WARNING;
            return (
              <div key={affix} className="flex items-center gap-2">
                <span className="text-2xs font-mono w-20 truncate" style={{ color: catColor }}>{affix}</span>
                <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(count / (affixRollCount * 3)) * 100}%`, backgroundColor: catColor }} />
                </div>
                <span className="text-2xs font-mono w-6 text-right text-text-muted">{count}</span>
              </div>
            );
          })}
        </div>
      )}
      {/* Co-occurrence heatmap with legend */}
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Affix Co-occurrence Matrix</div>
      <HeatmapGrid
        rows={AFFIX_COOCCURRENCE_ROWS}
        cols={AFFIX_COOCCURRENCE_COLS}
        cells={AFFIX_COOCCURRENCE_CELLS}
        accent={STATUS_WARNING}
      />
      {/* Color scale legend + conflict flag */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-2xs font-mono text-text-muted">Low</span>
          <div className="flex h-2 rounded overflow-hidden">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
              <div key={v} className="w-5 h-full" style={{ backgroundColor: STATUS_WARNING, opacity: v }} />
            ))}
          </div>
          <span className="text-2xs font-mono text-text-muted">High</span>
        </div>
        <span className="text-2xs font-mono" style={{ color: STATUS_WARNING }}>
          {AFFIX_COOCCURRENCE_CELLS.filter(c => c.value >= 0.7).length} conflict cells (&ge;70%)
        </span>
      </div>

      {/* Affix Pool Selector */}
      <ScalableSelector<AffixDef>
        items={AFFIX_DEFS}
        groupBy="category"
        renderItem={renderAffixItem}
        onSelect={(items) => setSelectedAffixIds(items.map(i => i.id))}
        selected={selectedAffixIds}
        searchKey="name"
        placeholder="Search affixes..."
        mode="multi"
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        title="Affix Pool Selector"
        accent={STATUS_WARNING}
      />
    </BlueprintPanel>
  );
}
