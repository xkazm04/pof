'use client';

import { FlaskConical } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_MUTED,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_25, OPACITY_37,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, NeonBar } from '../../unique-tabs/_design';
import {
  ACCENT, RARITY_COLORS,
  SAMPLE_RECIPE,
} from '../_shared/data';

/* ── Crafting Recipe Section ───────────────────────────────────────────── */

export function CraftingRecipeSection() {
  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${withOpacity(ACCENT, OPACITY_37)}, transparent)` }} />
      <SectionHeader icon={FlaskConical} label="Crafting Recipe Preview" color={ACCENT} />
      <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-3">Recipe card showing materials, output, and affix probability ranges.</p>
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-3">
            {SAMPLE_RECIPE.materials.map(mat => (
              <div key={mat.name} className="flex items-center gap-2 text-sm font-mono px-3 py-1.5 rounded-lg border"
                style={{ borderColor: `${withOpacity(RARITY_COLORS[mat.rarity] ?? STATUS_MUTED, OPACITY_25)}`, backgroundColor: `${withOpacity(RARITY_COLORS[mat.rarity] ?? STATUS_MUTED, OPACITY_5)}` }}>
                <span className="text-text font-bold">{mat.quantity}x</span>
                <span className="text-text-muted">{mat.name}</span>
                <span className="text-xs opacity-60" style={{ color: RARITY_COLORS[mat.rarity] }}>{mat.rarity}</span>
              </div>
            ))}
          </div>
          <div className="text-text-muted text-lg font-bold">&rarr;</div>
          <div className="p-3 rounded-lg border-2 text-center min-w-[120px]"
            style={{ borderColor: `${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_37)}`, backgroundColor: `${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_8)}` }}>
            <p className="text-sm font-bold text-text" style={{ textShadow: `0 0 12px ${withOpacity(RARITY_COLORS[SAMPLE_RECIPE.outputRarity], OPACITY_25)}` }}>{SAMPLE_RECIPE.output}</p>
            <p className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: RARITY_COLORS[SAMPLE_RECIPE.outputRarity] }}>{SAMPLE_RECIPE.outputRarity}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[150px]">
          <div className="space-y-1">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-text-muted">Success Rate</span>
              <span className="font-bold" style={{ color: STATUS_SUCCESS }}>{(SAMPLE_RECIPE.successRate * 100).toFixed(0)}%</span>
            </div>
            <NeonBar pct={SAMPLE_RECIPE.successRate * 100} color={STATUS_SUCCESS} glow />
          </div>
          <p className="text-sm font-mono text-text-muted">Cost: <span className="font-bold" style={{ color: STATUS_WARNING, textShadow: `0 0 12px ${withOpacity(STATUS_WARNING, OPACITY_25)}` }}>{SAMPLE_RECIPE.cost}g</span></p>
          <div className="mt-1 space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">Output Affixes</p>
            {SAMPLE_RECIPE.affixChances.map(ac => (
              <div key={ac.affix} className="flex items-center gap-2 text-sm font-mono">
                <div className="flex-1">
                  <NeonBar pct={ac.chance * 100} color={ac.color} height={4} />
                </div>
                <span className="text-text-muted w-20 truncate">{ac.affix}</span>
                <span style={{ color: ac.color }}>{(ac.chance * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-surface-hover/30 cursor-pointer"
          style={{ borderColor: `${withOpacity(ACCENT, OPACITY_25)}`, color: ACCENT, backgroundColor: `${withOpacity(ACCENT, OPACITY_8)}` }}
          onClick={() => { }}>Simulate 100 Crafts</button>
        <span className="text-xs font-mono text-text-muted italic">(Static preview)</span>
      </div>
    </BlueprintPanel>
  );
}
