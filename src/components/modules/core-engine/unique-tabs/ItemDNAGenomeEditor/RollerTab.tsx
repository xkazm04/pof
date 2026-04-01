'use client';

import { Shuffle } from 'lucide-react';
import {
  ACCENT_PINK, STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, CornerBrackets } from '@/components/modules/core-engine/unique-tabs/_design';
import type { ItemGenome, DNARollResult } from '@/types/item-genome';
import { ACCENT } from './data';
import { DNAStrand } from './DNAStrand';
import { DistributionBar } from './DistributionBar';
import { RollResultCard } from './RollResultCard';

/* ── Affix Roller Tab ──────────────────────────────────────────────────── */

interface RollerTabProps {
  selected: ItemGenome;
  rollRarity: string;
  setRollRarity: (r: string) => void;
  rollLevel: number;
  setRollLevel: (l: number) => void;
  rollResult: DNARollResult | null;
  doRoll: () => void;
}

export function RollerTab({
  selected, rollRarity, setRollRarity, rollLevel, setRollLevel, rollResult, doRoll,
}: RollerTabProps) {
  return (
    <div className="space-y-3">
      {/* Controls */}
      <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
        <SectionHeader icon={Shuffle} label="DNA-Biased Roller" color={ACCENT} />
        <div className="flex items-center gap-3">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Rarity</span>
            <select
              value={rollRarity}
              onChange={(e) => setRollRarity(e.target.value)}
              className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text"
            >
              {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Item Level</span>
            <input
              type="number" min={1} max={100} value={rollLevel}
              onChange={(e) => setRollLevel(parseInt(e.target.value) || 1)}
              className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none"
            />
          </div>
          <div className="flex-1" />
          <button
            onClick={doRoll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
            style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <Shuffle className="w-3.5 h-3.5" /> Roll Affixes
          </button>
        </div>
      </BlueprintPanel>

      {/* DNA being used */}
      <div className="grid grid-cols-2 gap-3">
        <BlueprintPanel color={selected.color} className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selected.color }} />
            <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text">{selected.name}</span>
            <span className="text-xs font-mono text-text-muted">({selected.itemType})</span>
          </div>
          <DNAStrand genome={selected} />
          <DistributionBar genome={selected} rarity={rollRarity} />
        </BlueprintPanel>

        <div className="space-y-3">
          {rollResult ? (
            <RollResultCard result={rollResult} genome={selected} />
          ) : (
            <BlueprintPanel color={ACCENT} className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Shuffle className="w-8 h-8 text-text-muted/30 mx-auto" />
                <p className="text-xs text-text-muted">Click &ldquo;Roll Affixes&rdquo; to generate DNA-biased affixes</p>
              </div>
            </BlueprintPanel>
          )}

          {/* Rolling pipeline visualization */}
          <BlueprintPanel color={ACCENT} className="p-3 space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted font-bold">Rolling Pipeline</span>
            {[
              { step: '1. Roll Count', desc: `${rollRarity} = ${({'Common': '0', 'Uncommon': '1-2', 'Rare': '3-4', 'Epic': '4-5', 'Legendary': '5-6'} as Record<string, string>)[rollRarity] ?? '?'} affixes`, color: ACCENT },
              { step: '2. Rarity Gate', desc: 'Filter pool by MinRarity', color: STATUS_WARNING },
              { step: '3. DNA Bias', desc: 'Weight by genome traits + tag affinity', color: selected.color },
              { step: '4. Mutation Check', desc: `${(selected.mutation.mutationRate * 100).toFixed(0)}% chance per slot`, color: ACCENT_PINK },
              { step: '5. Scale by Level', desc: `Base * (1 + 0.1 * ${rollLevel})`, color: STATUS_SUCCESS },
            ].map((s, i) => (
              <div key={i} className="relative flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded overflow-hidden" style={{ backgroundColor: `${s.color}${OPACITY_10}` }}>
                <CornerBrackets color={s.color} size={5} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-bold" style={{ color: s.color }}>{s.step}</span>
                <span className="text-text-muted ml-auto">{s.desc}</span>
              </div>
            ))}
          </BlueprintPanel>
        </div>
      </div>
    </div>
  );
}
