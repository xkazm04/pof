'use client';

import { GitMerge, Check, RefreshCw, X } from 'lucide-react';
import { ACCENT_PINK, OPACITY_20,
  withOpacity, OPACITY_25, STATUS_SUCCESS, OPACITY_10,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { RadarChart } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome } from '@/types/item-genome';
import { genomeToRadar } from './data';
import { DistributionBar } from './DistributionBar';

/* ── Breeding Lab Tab ──────────────────────────────────────────────────── */

interface BreedingTabProps {
  genomes: ItemGenome[];
  breedParentA: string | null;
  breedParentB: string | null;
  setBreedParentA: (id: string | null) => void;
  setBreedParentB: (id: string | null) => void;
  /** Rolled offspring awaiting a decision; nothing is in the library until Keep */
  breedPreview: ItemGenome | null;
  onPreview: () => void;
  onReroll: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}

const SELECT_CLASS = 'w-full text-xs font-mono px-2 py-1.5 rounded bg-surface-deep border border-border/40 text-text';
const ACTION_CLASS = 'flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all';

function ParentSelect({ label, value, genomes, onChange }: {
  label: string; value: string | null; genomes: ItemGenome[]; onChange: (id: string | null) => void;
}) {
  const id = `breed-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-1">{label}</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={SELECT_CLASS}>
        <option value="">Select genome...</option>
        {genomes.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>
  );
}

function OffspringPreview({ child, onReroll, onKeep, onDiscard }: {
  child: ItemGenome; onReroll: () => void; onKeep: () => void; onDiscard: () => void;
}) {
  return (
    <div data-testid="breed-preview">
    <BlueprintPanel color={child.color} className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color }} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text">Offspring preview</span>
      </div>
      <div className="flex justify-center">
        <RadarChart data={genomeToRadar(child)} accent={child.color} size={100} />
      </div>
      <p className="text-xs font-mono text-text-muted text-center">
        {child.itemType} · floor {child.minRarity}
      </p>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={onKeep}
          className={ACTION_CLASS}
          style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_10), color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}` }}
        >
          <Check className="w-3 h-3" /> Keep
        </button>
        <button
          onClick={onReroll}
          className={ACTION_CLASS}
          style={{ backgroundColor: withOpacity(ACCENT_PINK, OPACITY_10), color: ACCENT_PINK, border: `1px solid ${withOpacity(ACCENT_PINK, OPACITY_25)}` }}
        >
          <RefreshCw className="w-3 h-3" /> Re-roll
        </button>
        <button onClick={onDiscard} className={`${ACTION_CLASS} text-text-muted border border-border/40 hover:text-text`}>
          <X className="w-3 h-3" /> Discard
        </button>
      </div>
    </BlueprintPanel>
    </div>
  );
}

export function BreedingTab({
  genomes, breedParentA, breedParentB, setBreedParentA, setBreedParentB,
  breedPreview, onPreview, onReroll, onKeep, onDiscard,
}: BreedingTabProps) {
  const pairReady = !!breedParentA && !!breedParentB && breedParentA !== breedParentB;
  return (
    <div className="space-y-3">
      <BlueprintPanel color={ACCENT_PINK} className="p-3 space-y-3">
        <SectionHeader icon={GitMerge} label="Inheritance Breeding" color={ACCENT_PINK} />
        <p className="text-xs text-text-muted leading-relaxed">
          Select two parent genomes to breed. The offspring inherits blended traits from both parents
          with random crossover; item type and rarity floor come from the dominant parent. Each roll is
          a preview: keep it, re-roll it, or discard it. Nothing enters the library until you keep it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ParentSelect label="Parent A" value={breedParentA} genomes={genomes} onChange={setBreedParentA} />
          <ParentSelect label="Parent B" value={breedParentB} genomes={genomes} onChange={setBreedParentB} />
        </div>
        <button
          onClick={onPreview}
          disabled={!pairReady}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
          style={{ backgroundColor: `${ACCENT_PINK}${OPACITY_20}`, color: ACCENT_PINK, border: `1px solid ${withOpacity(ACCENT_PINK, OPACITY_25)}` }}
        >
          <GitMerge className="w-3.5 h-3.5" /> Preview Offspring
        </button>
      </BlueprintPanel>

      {/* Visual comparison of parents and the previewed offspring */}
      {pairReady && (
        <div className="grid grid-cols-3 gap-3">
          {[breedParentA, breedParentB].map((pid, idx) => {
            const parent = genomes.find((g) => g.id === pid);
            if (!parent) return null;
            return (
              <BlueprintPanel key={pid} color={parent.color} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: parent.color }} />
                  <span className="text-xs font-mono uppercase tracking-[0.15em] font-bold text-text">
                    Parent {idx === 0 ? 'A' : 'B'}: {parent.name}
                  </span>
                </div>
                <div className="flex justify-center">
                  <RadarChart data={genomeToRadar(parent)} accent={parent.color} size={100} />
                </div>
              </BlueprintPanel>
            );
          })}
          {breedPreview ? (
            <OffspringPreview child={breedPreview} onReroll={onReroll} onKeep={onKeep} onDiscard={onDiscard} />
          ) : (
            <BlueprintPanel color={ACCENT_PINK} className="p-3 flex flex-col items-center justify-center">
              <GitMerge className="w-6 h-6 text-text-muted/30 mb-2" />
              <span className="text-xs text-text-muted text-center">Preview an offspring to judge it before it is saved</span>
            </BlueprintPanel>
          )}
        </div>
      )}

      {pairReady && breedPreview && (
        <BlueprintPanel color={breedPreview.color} className="p-3">
          <DistributionBar genome={breedPreview} rarity={breedPreview.minRarity} />
        </BlueprintPanel>
      )}
    </div>
  );
}
