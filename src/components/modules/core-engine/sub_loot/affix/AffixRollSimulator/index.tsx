'use client';

import { Sparkles, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_8, OPACITY_30, STATUS_WARNING, withOpacity, OPACITY_0, OPACITY_80 } from '@/lib/chart-colors';
import { EASE_OUT } from '@/lib/motion';
import { HeatmapGrid } from '../../../unique-tabs/_shared';
import {
  AFFIX_DEFS,
  AFFIX_COOCCURRENCE_ROWS,
  AFFIX_COOCCURRENCE_COLS, AFFIX_COOCCURRENCE_CELLS,
} from '../../_shared/data';
import type { AffixDef } from '../../_shared/data';
import { BlueprintPanel, SectionHeader } from '../../_shared/design';
import { ScalableSelector } from '@/components/shared/ScalableSelector';
import { CATEGORY_COLORS, REEL_CYCLE_MS } from './constants';
import { useAffixRollSimulator } from './useAffixRollSimulator';

export function AffixRollSimulator() {
  const {
    reelText,
    spinningSlots,
    winSlots,
    affixSpinning,
    affixHistory,
    affixRollCount,
    selectorOpen,
    setSelectorOpen,
    selectedAffixIds,
    setSelectedAffixIds,
    prefersReducedMotion,
    colorForAffixName,
    activePool,
    godrollPct,
    spinAffixes,
    frequencyRows,
    renderAffixItem,
  } = useAffixRollSimulator();

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
        Godroll: {godrollPct.toFixed(2)}% &middot; Weighted roll
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
        {reelText.map((text, i) => {
          const spinning = spinningSlots[i];
          const win = winSlots[i];
          // Spinning reels stay neutral amber; a landed reel takes its affix's
          // category color, so a godroll's glow flash reads in the right hue.
          const color = spinning ? STATUS_WARNING : colorForAffixName(text);
          return (
            <motion.div
              key={i}
              className="w-24 h-12 rounded-lg border flex items-center justify-center text-center px-1 text-xs font-mono font-bold overflow-hidden"
              style={{ borderColor: withOpacity(color, OPACITY_30), backgroundColor: withOpacity(color, OPACITY_8), color }}
              animate={
                prefersReducedMotion
                  ? undefined
                  : spinning
                    ? { y: [0, -6, 0] }
                    : win
                      ? {
                          scale: [1, 1.15, 1],
                          boxShadow: [
                            `0 0 0px ${withOpacity(color, OPACITY_0)}`,
                            `0 0 16px ${withOpacity(color, OPACITY_80)}`,
                            `0 0 0px ${withOpacity(color, OPACITY_0)}`,
                          ],
                        }
                      : { y: 0, scale: 1 }
              }
              transition={
                spinning
                  ? { duration: REEL_CYCLE_MS / 1000, ease: 'easeInOut', repeat: Infinity }
                  : win
                    ? { duration: 0.45, ease: EASE_OUT, times: [0, 0.4, 1] }
                    : { duration: 0.3, ease: EASE_OUT }
              }
            >
              {text}
            </motion.div>
          );
        })}
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
          {frequencyRows.map(({ affix, count, catColor }) => {
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
