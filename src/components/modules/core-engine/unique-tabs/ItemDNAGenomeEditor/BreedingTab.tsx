'use client';

import { GitMerge } from 'lucide-react';
import { ACCENT_PINK, OPACITY_20 } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { RadarChart } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome } from '@/types/item-genome';
import { genomeToRadar } from './data';

/* ── Breeding Lab Tab ──────────────────────────────────────────────────── */

interface BreedingTabProps {
  genomes: ItemGenome[];
  breedParentA: string | null;
  breedParentB: string | null;
  setBreedParentA: (id: string | null) => void;
  setBreedParentB: (id: string | null) => void;
  doBreed: () => void;
}

export function BreedingTab({
  genomes, breedParentA, breedParentB, setBreedParentA, setBreedParentB, doBreed,
}: BreedingTabProps) {
  return (
    <div className="space-y-3">
      <BlueprintPanel color={ACCENT_PINK} className="p-3 space-y-3">
        <SectionHeader icon={GitMerge} label="Inheritance Breeding" color={ACCENT_PINK} />
        <p className="text-xs text-text-muted leading-relaxed">
          Select two parent genomes to breed. The offspring inherits blended traits from both parents
          with random crossover. Dominant parent contributes slightly more to the blend.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Parent A</span>
            <select
              value={breedParentA ?? ''}
              onChange={(e) => setBreedParentA(e.target.value || null)}
              className="w-full text-xs font-mono px-2 py-1.5 rounded bg-surface-deep border border-border/40 text-text"
            >
              <option value="">Select genome...</option>
              {genomes.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">Parent B</span>
            <select
              value={breedParentB ?? ''}
              onChange={(e) => setBreedParentB(e.target.value || null)}
              className="w-full text-xs font-mono px-2 py-1.5 rounded bg-surface-deep border border-border/40 text-text"
            >
              <option value="">Select genome...</option>
              {genomes.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={doBreed}
          disabled={!breedParentA || !breedParentB || breedParentA === breedParentB}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
          style={{ backgroundColor: `${ACCENT_PINK}${OPACITY_20}`, color: ACCENT_PINK, border: `1px solid ${ACCENT_PINK}40` }}
        >
          <GitMerge className="w-3.5 h-3.5" /> Breed Offspring
        </button>
      </BlueprintPanel>

      {/* Visual comparison of parents */}
      {breedParentA && breedParentB && breedParentA !== breedParentB && (
        <div className="grid grid-cols-3 gap-3">
          {[breedParentA, breedParentB].map((pid, idx) => {
            const parent = genomes.find((g) => g.id === pid);
            if (!parent) return null;
            return (
              <BlueprintPanel key={pid} color={parent.color} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parent.color }} />
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold text-text">
                    Parent {idx === 0 ? 'A' : 'B'}: {parent.name}
                  </span>
                </div>
                <div className="flex justify-center">
                  <RadarChart data={genomeToRadar(parent)} accent={parent.color} size={100} />
                </div>
              </BlueprintPanel>
            );
          })}
          <BlueprintPanel color={ACCENT_PINK} className="p-3 flex flex-col items-center justify-center">
            <GitMerge className="w-6 h-6 text-text-muted/30 mb-2" />
            <span className="text-xs text-text-muted">Offspring will appear after breeding</span>
          </BlueprintPanel>
        </div>
      )}
    </div>
  );
}
