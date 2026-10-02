'use client';

import { useMemo, useState } from 'react';
import { SlidersHorizontal, Undo2, RotateCcw, Crosshair } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, withOpacity, OPACITY_5, OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { lootTierOf } from '@/lib/loot/economy';
import { solveWeightsForTargetEV } from '@/lib/loot/auto-balancer';
import { ACCENT, RARITY_TIERS } from '../_shared/data';
import { BlueprintPanel, SectionHeader } from '../_shared/design';
import { useLootTuningStore } from '../_shared/lootTuningStore';
import {
  findBinding, goalSeekWeights, killsToLegendary, rosterFindings, tunedSummary, type TunerField,
} from '../_shared/bindingTuner';

const INPUT = 'w-16 bg-surface-deep/50 border border-border/40 rounded px-1.5 py-0.5 text-xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-current/50';
const SEVERITY_COLOR = { ok: STATUS_SUCCESS, warn: STATUS_WARNING, error: STATUS_ERROR } as const;

const fmtKills = (k: number) => (Number.isFinite(k) ? Math.round(k).toLocaleString() : '∞');

function NumField({ label, value, was, step, onChange }: {
  label: string; value: number; was: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
      <span className="w-20 truncate">{label}</span>
      <input type="number" min={0} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} className={INPUT} />
      {value !== was && <span className="text-2xs">was {was}</span>}
    </label>
  );
}

/**
 * Tune one enemy's drops: edit drop chance / bonus gold / rarity weights, or type a
 * gold-per-kill target and Apply the goal-seek. EV delta, tier-peer lint and the
 * kills-to-first-Legendary shift update live; every Core panel reads the same store.
 */
export function BindingTuner() {
  const state = useLootTuningStore();
  const { dispatch, selectedId, rarityGold, history } = state;
  const [target, setTarget] = useState('');

  const tuned = findBinding(state.bindings, selectedId);
  const base = findBinding(state.baseline, selectedId);
  const summary = selectedId ? tunedSummary(state, selectedId) : null;
  const findings = useMemo(() => (selectedId ? rosterFindings(state)[selectedId] ?? [] : []), [state, selectedId]);

  const targetEV = Number(target);
  const proposal = useMemo(() => {
    if (!tuned || target.trim() === '' || !Number.isFinite(targetEV)) return null;
    const solved = solveWeightsForTargetEV(tuned, targetEV, rarityGold);
    return { reachable: solved.reachable, note: solved.note, weights: goalSeekWeights(tuned, targetEV, rarityGold) };
  }, [tuned, target, targetEV, rarityGold]);

  const setField = (field: TunerField, value: number) => {
    if (selectedId) dispatch({ type: 'setField', id: selectedId, field, value });
  };

  return (
    <BlueprintPanel className="p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <SectionHeader icon={SlidersHorizontal} label="Binding Tuner" color={ACCENT} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={history.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-mono font-bold border disabled:opacity-40"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}>
            <Undo2 className="w-3 h-3" /> Undo
          </button>
          <button type="button" onClick={() => dispatch({ type: 'reset' })}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-mono font-bold border"
            style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}>
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {!tuned || !base || !summary ? (
        <p className="text-xs font-mono text-text-muted">
          Pick an enemy in the header Enemy Source (or click a binding card below) to tune its drops.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: tuned.color }}>{`${tuned.archetypeName} · ${tuned.lootTableName}`}</span>
            <span className="text-2xs font-mono px-1.5 py-0.5 rounded" style={{ color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_10) }}>
              {lootTierOf(base.dropChance)} tier peers
            </span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <NumField label="Drop chance" value={tuned.dropChance} was={base.dropChance} step={0.01} onChange={(v) => setField('dropChance', v)} />
            <NumField label="Bonus gold" value={tuned.bonusGold} was={base.bonusGold} step={1} onChange={(v) => setField('bonusGold', v)} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {RARITY_TIERS.map((tier, i) => (
              <NumField key={tier.name} label={`${tier.name} weight`} value={tuned.rarityWeights[i] ?? 0} was={base.rarityWeights[i] ?? 0} step={1}
                onChange={(v) => dispatch({ type: 'setWeight', id: tuned.archetypeId, index: i, value: v })} />
            ))}
          </div>

          <div className="rounded-lg border p-2.5 flex flex-wrap items-center gap-2" style={{ borderColor: withOpacity(ACCENT, OPACITY_20), backgroundColor: withOpacity(ACCENT, OPACITY_5) }}>
            <Crosshair className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            <label className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
              Target gold / kill
              <input type="number" min={0} step={1} value={target} aria-label="Target gold per kill"
                onChange={(e) => setTarget(e.target.value)} className={INPUT} />
            </label>
            <button type="button" disabled={!proposal}
              onClick={() => proposal && dispatch({ type: 'goalSeek', id: tuned.archetypeId, targetEV })}
              className="px-2 py-1 rounded text-2xs font-mono font-bold border disabled:opacity-40"
              style={{ borderColor: withOpacity(ACCENT, OPACITY_20), color: ACCENT }}>
              Apply
            </button>
            {proposal && (
              <span className="text-2xs font-mono" style={{ color: proposal.reachable ? STATUS_SUCCESS : STATUS_WARNING }}>
                {`weights ${proposal.weights.join(' / ')} — ${proposal.note}`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <span className="text-text-muted">EV / kill{' '}
              <span className="text-text font-bold">{summary.evBefore}g → {summary.evAfter}g</span>{' '}
              <span style={{ color: summary.delta === 0 ? undefined : summary.delta > 0 ? STATUS_SUCCESS : STATUS_WARNING }}>
                ({summary.delta >= 0 ? '+' : ''}{summary.delta}g)
              </span>
            </span>
            <span className="text-text-muted">Kills to first Legendary{' '}
              <span className="text-text font-bold">{fmtKills(killsToLegendary(base))} → {fmtKills(killsToLegendary(tuned))}</span>
            </span>
          </div>

          <ul className="space-y-1">
            {findings.map((f) => (
              <li key={f.rule} className="text-xs font-mono" style={{ color: SEVERITY_COLOR[f.severity] }}>
                {f.severity === 'ok' ? `In line with ${lootTierOf(base.dropChance)} peers. ${f.message}` : `${f.rule}: ${f.message}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlueprintPanel>
  );
}
