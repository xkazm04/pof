'use client';

import { motion } from 'framer-motion';
import { Sparkles, Dna } from 'lucide-react';
import {
  ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { BlueprintPanel, CornerBrackets } from '@/components/modules/core-engine/unique-tabs/_design';
import { STAGGER_DEFAULT } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome, DNARollResult } from '@/types/item-genome';
import { AXIS_CONFIGS, ACCENT } from './data';

/* ── Roll Result Card ──────────────────────────────────────────────────── */

export function RollResultCard({ result, genome }: { result: DNARollResult; genome: ItemGenome }) {
  return (
    <BlueprintPanel color={genome.color} className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" style={{ color: genome.color }} />
          <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text">Rolled Affixes</span>
          <span className="text-xs font-mono text-text-muted">({result.affixes.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: result.coherenceScore > 0.6 ? STATUS_SUCCESS : result.coherenceScore > 0.3 ? STATUS_WARNING : STATUS_ERROR }}>
            {(result.coherenceScore * 100).toFixed(0)}% coherent
          </span>
          {result.hasMutations && (
            <span className="text-xs font-mono uppercase tracking-[0.15em] px-1 rounded" style={{ backgroundColor: `${ACCENT_PINK}${OPACITY_20}`, color: ACCENT_PINK }}>
              MUTANT
            </span>
          )}
        </div>
      </div>
      {result.affixes.length === 0 ? (
        <p className="text-xs text-text-muted italic">No affixes rolled (Common rarity)</p>
      ) : (
        <div className="space-y-1">
          {result.affixes.map((ra, i) => {
            const cfg = AXIS_CONFIGS.find((c) => c.axis === ra.affix.axis);
            return (
              <motion.div
                key={`${ra.affix.id}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * STAGGER_DEFAULT }}
                className="relative flex items-center gap-2 px-2 py-1 rounded-md text-xs overflow-hidden"
                style={{
                  backgroundColor: ra.isMutation ? `${ACCENT_PINK}${OPACITY_10}` : `${cfg?.color ?? ACCENT}${OPACITY_10}`,
                  border: ra.isMutation ? `1px solid ${ACCENT_PINK}30` : `1px solid ${cfg?.color ?? ACCENT}20`,
                }}
              >
                <CornerBrackets color={ra.isMutation ? ACCENT_PINK : cfg?.color ?? ACCENT} size={6} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg?.color ?? ACCENT }} />
                <span className="font-mono font-bold" style={{ color: cfg?.color ?? ACCENT }}>
                  {ra.affix.isPrefix ? ra.affix.name : ''} Item {ra.affix.isPrefix ? '' : ra.affix.name}
                </span>
                <span className="ml-auto font-mono font-bold text-text">+{ra.rolledValue}</span>
                <span className="font-mono text-text-muted">{ra.affix.tags[0]?.replace('Stat.', '') ?? ''}</span>
                {ra.isMutation && <Dna className="w-3 h-3" style={{ color: ACCENT_PINK }} />}
              </motion.div>
            );
          })}
        </div>
      )}
    </BlueprintPanel>
  );
}
