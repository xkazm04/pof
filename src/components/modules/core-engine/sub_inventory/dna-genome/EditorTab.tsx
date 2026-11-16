'use client';

import { useId, useState } from 'react';
import { Dna, Trash2, Target, FlaskConical } from 'lucide-react';
import {
  ACCENT_PINK, STATUS_SUCCESS, OPACITY_10, OPACITY_20,
  withOpacity, OPACITY_37,
} from '@/lib/chart-colors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { focusRingStyle } from '@/lib/ui/focus-ring';
import { BlueprintPanel, SectionHeader } from '@/components/modules/core-engine/unique-tabs/_design';
import { RadarChart } from '@/components/modules/core-engine/unique-tabs/_shared';
import type { ItemGenome, TraitAxis } from '@/types/item-genome';
import type { RadarDataPoint } from '@/types/unique-tab-improvements';
import { ITEM_TYPES, RARITY_ORDER } from '@/lib/item-dna/rules';
import { AXIS_CONFIGS } from './data';
import { DNAStrand } from './DNAStrand';
import { TraitSlider } from './TraitSlider';
import { DistributionBar } from './DistributionBar';

/** Typed integer clamped to [lo, hi]; null for a cleared / non-numeric field (ignore it). */
function parseClampedInt(raw: string, lo: number, hi: number): number | null {
  const v = parseInt(raw, 10);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;
}

/* ── Editor Tab ────────────────────────────────────────────────────────── */

interface EditorTabProps {
  selected: ItemGenome;
  radarData: RadarDataPoint[];
  genomeCount: number;
  updateGenome: (id: string, updater: (g: ItemGenome) => ItemGenome) => void;
  updateTrait: (axis: TraitAxis, weight: number) => void;
  deleteGenome: (id: string) => void;
}

export function EditorTab({ selected, radarData, genomeCount, updateGenome, updateTrait, deleteGenome }: EditorTabProps) {
  // Visible captions become the controls' programmatic labels (same as RollerTab).
  const uid = useId();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nameId = `${uid}-name`;
  const typeId = `${uid}-type`;
  const rarityId = `${uid}-rarity`;
  const rateId = `${uid}-rate`;
  const maxId = `${uid}-max`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Left: DNA strand + radar */}
      <BlueprintPanel color={selected.color} className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <SectionHeader label="DNA Strand" color={selected.color} icon={Dna} />
          {/* Presets are sticky (the store refuses to delete them), so no Delete for one. */}
          {genomeCount > 1 && !selected.isPreset && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete genome ${selected.name}`}
              title="Delete genome"
              className="text-xs text-text-muted hover:text-red-400 transition-colors p-1"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="min-h-[200px] bg-surface-deep/30 rounded-lg p-2">
          <DNAStrand genome={selected} />
          <div className="flex justify-center">
            <RadarChart data={radarData} accent={selected.color} size={140} />
          </div>
        </div>
        {/* Genome metadata */}
        <div className="space-y-1.5" style={focusRingStyle(selected.color)}>
          <div className="flex items-center gap-2">
            <label htmlFor={nameId} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-14">Name</label>
            <input
              id={nameId}
              type="text" value={selected.name}
              onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, name: e.target.value }))}
              className="flex-1 text-xs font-mono font-bold px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={typeId} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-14">Type</label>
            <select
              id={typeId}
              value={selected.itemType}
              onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, itemType: e.target.value as ItemGenome['itemType'] }))}
              className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={rarityId} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted w-14">MinRar</label>
            <select
              id={rarityId}
              value={selected.minRarity}
              onChange={(e) => updateGenome(selected.id, (g) => ({ ...g, minRarity: e.target.value as ItemGenome['minRarity'] }))}
              className="text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset"
            >
              {RARITY_ORDER.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Tags */}
        {selected.tags && selected.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {selected.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${selected.color}${OPACITY_10}`, color: selected.color }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </BlueprintPanel>

      {/* Right: Trait sliders + mutation config */}
      <div className="space-y-3">
        <BlueprintPanel color={selected.color} className="space-y-3 p-3">
          <SectionHeader icon={Target} label="Trait Weights" color={selected.color} />
          {AXIS_CONFIGS.map((cfg) => {
            const gene = selected.traits.find((g) => g.axis === cfg.axis);
            if (!gene) return null;
            return (
              <TraitSlider
                key={cfg.axis}
                gene={gene}
                config={cfg}
                onChange={(w) => updateTrait(cfg.axis, w)}
              />
            );
          })}
        </BlueprintPanel>

        <BlueprintPanel color={ACCENT_PINK} className="space-y-3 p-3">
          <SectionHeader icon={FlaskConical} label="Mutation Config" color={ACCENT_PINK} />
          <div className="grid grid-cols-3 gap-2" style={focusRingStyle(ACCENT_PINK)}>
            <div>
              <label htmlFor={rateId} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Rate</label>
              <input
                id={rateId}
                type="number" min={0} max={100} step={1}
                value={Math.round(selected.mutation.mutationRate * 100)}
                onChange={(e) => {
                  const pct = parseClampedInt(e.target.value, 0, 100);
                  if (pct === null) return;
                  updateGenome(selected.id, (g) => ({
                    ...g,
                    mutation: { ...g.mutation, mutationRate: pct / 100 },
                  }));
                }}
                className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset"
              />
            </div>
            <div>
              <label htmlFor={maxId} className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Max</label>
              <input
                id={maxId}
                type="number" min={0} max={6} step={1}
                value={selected.mutation.maxMutations}
                onChange={(e) => {
                  const n = parseClampedInt(e.target.value, 0, 6);
                  if (n === null) return;
                  updateGenome(selected.id, (g) => ({
                    ...g,
                    mutation: { ...g.mutation, maxMutations: n },
                  }));
                }}
                className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus-ring-inset"
              />
            </div>
            <div>
              <span aria-hidden="true" className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">Wild</span>
              <button
                type="button"
                aria-label="Wild mutation"
                aria-pressed={selected.mutation.wildMutation}
                onClick={() => updateGenome(selected.id, (g) => ({
                  ...g,
                  mutation: { ...g.mutation, wildMutation: !g.mutation.wildMutation },
                }))}
                className="w-full text-xs font-mono font-bold px-1.5 py-1 rounded border transition-colors"
                style={{
                  backgroundColor: selected.mutation.wildMutation ? `${STATUS_SUCCESS}${OPACITY_20}` : 'transparent',
                  borderColor: selected.mutation.wildMutation ? `${withOpacity(STATUS_SUCCESS, OPACITY_37)}` : 'var(--border)',
                  color: selected.mutation.wildMutation ? STATUS_SUCCESS : 'var(--text-muted)',
                }}
              >
                {selected.mutation.wildMutation ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </BlueprintPanel>

        <DistributionBar genome={selected} rarity="Rare" />
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => deleteGenome(selected.id)}
        title="Delete this genome?"
        description={`"${selected.name}" will be removed permanently. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
