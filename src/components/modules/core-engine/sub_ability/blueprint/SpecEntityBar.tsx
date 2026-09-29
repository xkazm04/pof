'use client';

import { Sparkles, Wand2, Save, Loader2, Check, AlertTriangle } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN, ACCENT_VIOLET, STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_25,
} from '@/lib/chart-colors';
import { SPELLBOOK_ABILITIES } from '../_shared/data';
import { CodegenStatusLine } from '../_shared/CodegenStatusLine';
import { GeneratePreflight } from './GeneratePreflight';
import { ACCENT } from './data';
import type { SpecBinding } from './useAbilitySpecBinding';

interface Props {
  binding: SpecBinding;
}

/**
 * Toolbar that binds the GAS Blueprint Editor to a spellbook entity's
 * EnrichedAbilitySpec: pick the ability, Draft a spec (CLI), Generate GAS
 * effects in UE (CLI), or Save the current effects/tagRules to the DB.
 * Generate first runs the preflight: a clean spec dispatches at once, otherwise
 * the run waits behind an inline list of what it would override or TODO.
 */
export function SpecEntityBar({ binding }: Props) {
  const {
    entityId, setEntityId, hydrating, saveState, error, save, draftSpec, isRunning, codegen,
    reviewGenerate, preflight, confirmGenerate, dismissPreflight, applyFix,
  } = binding;

  const btnBase = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <SurfaceCard level={2} className="p-2.5" style={{ borderLeft: `2px solid ${withOpacity(ACCENT_CYAN, OPACITY_25)}` }}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-2xs font-bold uppercase tracking-widest text-text-muted" htmlFor="spec-entity-select">
          Ability
        </label>
        <select
          id="spec-entity-select"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          disabled={isRunning}
          className="text-xs font-mono rounded-md px-2 py-1 bg-transparent border text-text focus-ring"
          style={{ borderColor: withOpacity(ACCENT, OPACITY_25) }}
        >
          {SPELLBOOK_ABILITIES.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.element})</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={draftSpec}
            disabled={isRunning}
            className={btnBase}
            style={{ backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_10), color: ACCENT_VIOLET, border: `1px solid ${withOpacity(ACCENT_VIOLET, OPACITY_20)}` }}
            title="Ask Claude to draft a starter GAS spec for this ability"
          >
            <Sparkles className="w-3.5 h-3.5" /> Draft spec
          </button>
          <button
            onClick={reviewGenerate}
            disabled={isRunning}
            className={btnBase}
            style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_10), color: ACCENT_CYAN, border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_20)}` }}
            title="Check what the run will override, then generate buildable UGameplayEffect C++ from the current effects/tag rules"
          >
            <Wand2 className="w-3.5 h-3.5" /> Generate GAS effects
          </button>
          <button
            onClick={() => void save()}
            // Guarded during hydration: the editor still holds the previous
            // entity's slices until the fetch lands.
            disabled={saveState === 'saving' || hydrating}
            className={btnBase}
            style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
            title="Persist the current effects + tag rules to this ability's spec"
          >
            {saveState === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save spec
          </button>
        </div>
      </div>

      {preflight && !isRunning && (
        <GeneratePreflight preflight={preflight} onFix={applyFix} onConfirm={confirmGenerate} onDismiss={dismissPreflight} />
      )}

      {/* Status line — honest hydration / save / dispatch feedback. */}
      <div className="mt-1.5 flex items-center gap-2 text-2xs font-mono min-h-[16px]">
        {hydrating && <span className="text-text-muted flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading spec…</span>}
        {!hydrating && saveState === 'saved' && <span className="flex items-center gap-1" style={{ color: STATUS_SUCCESS }}><Check className="w-3 h-3" /> Spec saved</span>}
        {isRunning && codegen.state !== 'dispatched' && <span className="flex items-center gap-1" style={{ color: ACCENT_CYAN }}><Loader2 className="w-3 h-3 animate-spin" /> CLI task dispatched…</span>}
        <CodegenStatusLine status={codegen} />
        {error && <span className="flex items-center gap-1" style={{ color: STATUS_ERROR }}><AlertTriangle className="w-3 h-3" /> {error}</span>}
      </div>
    </SurfaceCard>
  );
}
