'use client';

import { Check, Loader2, PackageCheck, Wand2, AlertTriangle } from 'lucide-react';
import { BlueprintPanel } from '../../unique-tabs/_design';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { SPELLBOOK_ABILITIES } from '../_shared/data';
import { CodegenStatusLine } from '../_shared/CodegenStatusLine';
import { ACCENT } from './constants';
import type { ForgeAdoptBinding } from './useForgeAdopt';

interface Props {
  binding: ForgeAdoptBinding;
}

/**
 * Adopt bridge for a forged ability: pick a target spellbook entity, adopt the
 * forge output into its EnrichedAbilitySpec (persisted, with C++ provenance),
 * and optionally dispatch generateGasEffects to materialize it in UE. The
 * "Adopted" badge reflects the persisted store spec — no fake success.
 */
export function ForgeAdoptBar({ binding }: Props) {
  const { entityId, setEntityId, adoptState, error, isAdopted, adopt, generateInUE, isRunning, codegen } = binding;
  const btn = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-text-muted">Adopt into</span>
        <select
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          disabled={isRunning || adoptState === 'adopting'}
          aria-label="Target ability to adopt the forged spec into"
          className="text-xs font-mono rounded-md px-2 py-1 bg-transparent border text-text focus-ring"
          style={{ borderColor: withOpacity(ACCENT, OPACITY_20) }}
        >
          {SPELLBOOK_ABILITIES.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.element})</option>
          ))}
        </select>

        {isAdopted && (
          <span className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded"
            style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_10), color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}` }}>
            <PackageCheck className="w-3 h-3" /> Adopted
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => void adopt()}
            disabled={adoptState === 'adopting'}
            className={btn}
            style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
            title="Persist this forged ability into the target entity's spec (with C++ provenance)"
          >
            {adoptState === 'adopting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isAdopted ? 'Re-adopt' : 'Adopt into spec'}
          </button>
          <button
            onClick={generateInUE}
            disabled={isRunning}
            className={btn}
            style={{ backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_10), color: ACCENT_CYAN, border: `1px solid ${withOpacity(ACCENT_CYAN, OPACITY_20)}` }}
            title="Dispatch the generateGasEffects agent task to materialize this ability in UE"
          >
            <Wand2 className="w-3.5 h-3.5" /> Generate in UE
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-2xs font-mono min-h-[16px]">
        {adoptState === 'adopted' && !error && (
          <span className="flex items-center gap-1" style={{ color: STATUS_SUCCESS }}>
            <Check className="w-3 h-3" /> Persisted to the entity spec — C++ kept as provenance (not written to disk)
          </span>
        )}
        <CodegenStatusLine status={codegen} />
        {error && (
          <span className="flex items-center gap-1" style={{ color: STATUS_ERROR }}>
            <AlertTriangle className="w-3 h-3" /> {error}
          </span>
        )}
      </div>
    </BlueprintPanel>
  );
}
