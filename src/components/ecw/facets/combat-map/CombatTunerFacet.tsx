'use client';

import { useMemo, useState } from 'react';
import { Target, Clock, Sword, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { asCombo } from '@/lib/combat/combo-analysis';
import { tuneComboToTargetDps } from '@/lib/combat/combo-tuner';
import { buildComboPrompt } from '@/lib/combat/combo-prompt';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

interface Props {
  entity: StoredCatalogEntity;
}

/**
 * Combo Tuner facet (ECW Phase 10-C, idea 0545ec6c). Designer sets a target DPS;
 * `tuneComboToTargetDps` proposes two exact levers (retime vs damage-scale), and
 * the chosen retune dispatches to the CLI. Pure-function + CLI-dispatch combined;
 * the combat analogue of the Loot Goal-Seek Balancer.
 */
export function CombatTunerFacet({ entity }: Props) {
  const combo = useMemo(() => asCombo(entity.data), [entity.data]);
  const [target, setTarget] = useState<number | null>(null);

  const cli = useModuleCLI({
    moduleId: 'arpg-combat',
    sessionKey: `gen-${entity.id}`,
    label: `Tune ${entity.name}`,
    accentColor: MODULE_COLORS.core,
  });

  const effectiveTarget = target ?? (combo?.dps ?? 0);
  const proposal = useMemo(
    () => (combo ? tuneComboToTargetDps(combo, effectiveTarget) : null),
    [combo, effectiveTarget],
  );

  if (!combo || !proposal) {
    return <div className="px-4 py-3 text-xs text-text-muted/70 italic">No combo data to tune.</div>;
  }

  const apply = () => {
    const instruction = `Retune to ~${effectiveTarget} DPS — either shorten the total time to ${proposal.retimeSec.toFixed(2)}s (keep per-hit damage) or scale per-hit damage by ×${proposal.damageScale.toFixed(2)} (keep timing). Pick whichever preserves the weapon's feel.`;
    void cli.execute(
      TaskFactory.quickAction('arpg-combat', buildComboPrompt(entity.name, combo.weaponCategory, instruction), `Tune ${entity.name}`),
    );
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">DPS Tuner</span>
        <span className="ml-auto text-xs text-text-muted">now {proposal.currentDps}</span>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-muted">
        Target DPS
        <input
          type="number"
          value={effectiveTarget}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="focus-ring w-20 bg-surface-deep border border-border/50 rounded px-1.5 py-0.5 text-text"
        />
      </label>

      {proposal.reachable ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-2xs font-mono">
            <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted">Retime to</span>
            <span className="text-text font-semibold">{proposal.retimeSec.toFixed(2)}s</span>
            <span className="text-text-muted/60">(same damage)</span>
          </div>
          <div className="flex items-center gap-2 text-2xs font-mono">
            <Sword className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted">Scale per-hit damage</span>
            <span className="text-text font-semibold">×{proposal.damageScale.toFixed(2)}</span>
            <span className="text-text-muted/60">(same timing)</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-2xs font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-text">{proposal.note}</span>
        </div>
      )}

      {proposal.reachable && (
        <div className="flex items-center gap-2 text-xs text-text-muted/70">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Either lever reaches {effectiveTarget} DPS exactly.</span>
        </div>
      )}

      <button
        onClick={apply}
        disabled={cli.isRunning}
        className="focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border/50 text-text hover:bg-surface/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Target className="w-3.5 h-3.5" />
        <span>{cli.isRunning ? 'Applying…' : 'Apply via Claude'}</span>
      </button>
    </div>
  );
}

registerFacet('combat-map', { id: 'tuner', label: 'Tuner', Component: CombatTunerFacet });
