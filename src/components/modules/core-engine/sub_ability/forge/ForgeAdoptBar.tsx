'use client';

import { Check, Loader2, PackageCheck, Wand2, AlertTriangle } from 'lucide-react';
import { BlueprintPanel } from '../../unique-tabs/_design';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_50,
} from '@/lib/chart-colors';
import { SPELLBOOK_ABILITIES } from '../_shared/data';
import { CodegenStatusLine } from '../_shared/CodegenStatusLine';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AdoptPreview, adoptPreviewLines } from './AdoptPreview';
import { ACCENT } from './constants';
import type { ForgeAdoptBinding } from './useForgeAdopt';

interface Props {
  binding: ForgeAdoptBinding;
}

/**
 * Adopt bridge for a forged ability: pick a target spellbook entity (ranked
 * suggestions first), see what adopting replaces there, adopt the forge output
 * into its EnrichedAbilitySpec (persisted, with C++ provenance) — through a
 * confirmation whenever something real is replaced — and optionally dispatch
 * generateGasEffects to materialize it in UE. The "Adopted" badge reflects the
 * persisted store spec — no fake success.
 */
export function ForgeAdoptBar({ binding }: Props) {
  const {
    entityId, setEntityId, ability, suggestions, preview, targetReadError, adoptState, error, isAdopted,
    adopt, requestAdopt, confirmOpen, cancelAdopt, generateInUE, isRunning, codegen,
  } = binding;
  const targetName = ability?.name ?? entityId;
  const busy = isRunning || adoptState === 'adopting';
  const btn = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-text-muted">Adopt into</span>
        <select
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          disabled={busy}
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
            onClick={requestAdopt}
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

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Suggested targets">
          <span className="text-2xs uppercase tracking-widest text-text-muted">Suggested</span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setEntityId(s.id)}
              disabled={busy}
              aria-pressed={s.id === entityId}
              title={s.reason}
              className="text-2xs font-mono px-1.5 py-0.5 rounded focus-ring disabled:opacity-50"
              style={{
                color: ACCENT,
                border: `1px solid ${withOpacity(ACCENT, s.id === entityId ? OPACITY_50 : OPACITY_20)}`,
                backgroundColor: s.id === entityId ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
              }}
            >
              {s.name} <span className="text-text-muted">{s.reason}</span>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div className="mt-1.5">
          <AdoptPreview preview={preview} targetName={targetName} readError={targetReadError} />
        </div>
      )}

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

      <ConfirmDialog
        open={confirmOpen}
        onClose={cancelAdopt}
        onConfirm={adopt}
        title={`Adopt into ${targetName}?`}
        description={preview ? adoptPreviewLines(preview, targetName, targetReadError).join(' ') : ''}
        confirmLabel="Adopt and replace"
        busyLabel="Adopting…"
      />
    </BlueprintPanel>
  );
}
