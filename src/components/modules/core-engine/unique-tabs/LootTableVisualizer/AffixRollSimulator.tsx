'use client';

import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_8, OPACITY_30, STATUS_WARNING } from '@/lib/chart-colors';
import { HeatmapGrid } from '../_shared';
import {
  AFFIX_POOL, AFFIX_COOCCURRENCE_ROWS,
  AFFIX_COOCCURRENCE_COLS, AFFIX_COOCCURRENCE_CELLS,
} from './data';
import { BlueprintPanel, SectionHeader } from './design';

export function AffixRollSimulator() {
  const [affixSlots, setAffixSlots] = useState<string[]>(['?', '?', '?']);
  const [affixSpinning, setAffixSpinning] = useState(false);
  const [affixHistory, setAffixHistory] = useState<Record<string, number>>({});
  const [affixRollCount, setAffixRollCount] = useState(0);

  const spinAffixes = useCallback(() => {
    setAffixSpinning(true);
    setTimeout(() => {
      const picks = [0, 1, 2].map(() => AFFIX_POOL[Math.floor(Math.random() * AFFIX_POOL.length)]);
      setAffixSlots(picks);
      setAffixSpinning(false);
      setAffixRollCount((c) => c + 1);
      setAffixHistory((prev) => {
        const next = { ...prev };
        for (const p of picks) next[p] = (next[p] ?? 0) + 1;
        return next;
      });
    }, 600);
  }, []);

  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={Sparkles} label="Affix Roll Simulator" color={STATUS_WARNING} />
      <div className="text-2xs text-text-muted ml-auto font-mono mb-3">Godroll: 0.02%</div>
      {/* Slot machine */}
      <div className="flex items-center justify-center gap-3 mb-3">
        {affixSlots.map((slot, i) => (
          <motion.div
            key={i}
            className="w-24 h-12 rounded-lg border flex items-center justify-center text-xs font-mono font-bold overflow-hidden"
            style={{ borderColor: `${STATUS_WARNING}${OPACITY_30}`, backgroundColor: `${STATUS_WARNING}${OPACITY_8}`, color: STATUS_WARNING }}
            animate={affixSpinning ? { y: [0, -10, 10, -5, 5, 0] } : {}}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {affixSpinning ? '...' : slot}
          </motion.div>
        ))}
        <button
          onClick={spinAffixes}
          disabled={affixSpinning}
          className="text-xs font-semibold px-3 py-2 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: `${STATUS_WARNING}${OPACITY_30}`, backgroundColor: `${STATUS_WARNING}${OPACITY_8}`, color: STATUS_WARNING }}
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
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted">Affix Frequency</div>
          {Object.entries(affixHistory).sort((a, b) => b[1] - a[1]).map(([affix, count]) => (
            <div key={affix} className="flex items-center gap-2">
              <span className="text-2xs font-mono w-20 text-text truncate">{affix}</span>
              <div className="flex-1 h-2 bg-surface-deep rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${(count / (affixRollCount * 3)) * 100}%`, backgroundColor: STATUS_WARNING }} />
              </div>
              <span className="text-2xs font-mono w-6 text-right text-text-muted">{count}</span>
            </div>
          ))}
        </div>
      )}
      {/* Co-occurrence matrix */}
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-1">Affix Co-occurrence Matrix</div>
      <HeatmapGrid
        rows={AFFIX_COOCCURRENCE_ROWS}
        cols={AFFIX_COOCCURRENCE_COLS}
        cells={AFFIX_COOCCURRENCE_CELLS}
        accent={STATUS_WARNING}
      />
    </BlueprintPanel>
  );
}
