'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, X, Undo2 } from 'lucide-react';
import { STATUS_ERROR, STATUS_SUCCESS, STATUS_WARNING, withOpacity, OPACITY_20 } from '@/lib/chart-colors';
import type { CombatLever } from '@/lib/combat/goal-seek';
import {
  COMBAT_TUNING_LEVERS,
  solveCellTuning,
  type CellSolveResult,
  type SweepCellRef,
  type SweepDiff,
} from '@/lib/combat/sweep-tuning';
import type { ArchetypeRegistry, EnemySourceReport } from '@/lib/combat/simulation-engine';
import { usePaneHold } from '@/hooks/usePaneHold';
import { logger } from '@/lib/logger';
import { ACCENT, type PredictiveBalanceConfig } from './data';

type SolveState =
  | { kind: 'idle' }
  | { kind: 'solving'; k: number }
  | { kind: 'done'; result: CellSolveResult }
  | { kind: 'error'; message: string };

const IDLE: SolveState = { kind: 'idle' };
const HOLD_REASON = 'Cell tuning solve running';
const num = (x: number) => `${+x.toFixed(3)}`;

/**
 * Tune one heatmap cell: pick a lever and a target survival, Solve (on the
 * sweep's yielding job — 'eval k' + Cancel while it runs), then Apply the solved
 * multiplier. A refusal shows its reason and keeps Apply disabled.
 */
export function CellTuner({ config, enemies, cell, label, onApply, onClose }: {
  /** The config that produced the report on screen (not the live, possibly edited one). */
  config: PredictiveBalanceConfig;
  enemies?: { registry: ArchetypeRegistry; provenance?: EnemySourceReport };
  cell: SweepCellRef;
  /** The encounter's label, e.g. '1x Hollow Knight'. */
  label: string;
  onApply: (next: PredictiveBalanceConfig, applied: { lever: CombatLever; value: number }) => void;
  onClose?: () => void;
}) {
  const [lever, setLever] = useState<CombatLever>('enemyHealthMul');
  const [targetPct, setTargetPct] = useState(80);
  const [state, setState] = useState<SolveState>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);
  const title = `Lv.${cell.level} vs ${label}`;

  usePaneHold(state.kind === 'solving', HOLD_REASON);
  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  const stop = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(IDLE);
  };

  const solve = () => {
    controllerRef.current?.abort();
    const ac = new AbortController();
    controllerRef.current = ac;
    const isCurrent = () => controllerRef.current === ac;
    setState({ kind: 'solving', k: 0 });
    solveCellTuning(config, enemies, cell, lever, targetPct / 100, {
      signal: ac.signal,
      onEval: (k) => { if (isCurrent()) setState({ kind: 'solving', k }); },
    }).then(
      (r) => {
        if (!isCurrent() || 'aborted' in r) return;
        controllerRef.current = null;
        setState({ kind: 'done', result: r });
      },
      (err: unknown) => {
        if (!isCurrent()) return;
        logger.warn('[cell-tuner] solve failed', err);
        controllerRef.current = null;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      },
    );
  };

  const result = state.kind === 'done' ? state.result : null;
  const solvedValue = result?.applicable && result.converged ? result.solvedValue : null;
  const apply = () => {
    if (solvedValue === null) return;
    onApply({ ...config, tuning: { ...config.tuning, [lever]: solvedValue } }, { lever, value: solvedValue });
  };

  const statusColor = result
    ? (solvedValue !== null ? STATUS_SUCCESS : result.applicable ? STATUS_WARNING : STATUS_ERROR)
    : state.kind === 'error' ? STATUS_ERROR : undefined;
  const control = 'px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text';

  return (
    <section
      aria-label={`Tune ${title}`}
      className="space-y-2 px-3 py-2 rounded-lg border text-xs font-mono"
      style={{ borderColor: withOpacity(ACCENT, OPACITY_20) }}
    >
      <div className="flex items-center gap-2">
        <Crosshair className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        <h4 className="font-bold text-text">{title}</h4>
        <span className="text-text-muted">solve one lever for this cell</span>
        {onClose && (
          <button type="button" aria-label="Close tuner" onClick={() => { stop(); onClose(); }}
            className="ml-auto text-text-muted hover:text-text">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Lever" value={lever} className={control}
          onChange={e => { stop(); setLever(e.target.value as CombatLever); }}>
          {COMBAT_TUNING_LEVERS.map(l => (
            <option key={l.lever} value={l.lever}>
              {l.label} ({l.range[0]}–{l.range[1]}×, now {num(config.tuning[l.lever])})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-text-muted">
          target
          <input aria-label="Target survival %" type="number" min={0} max={100} step={1}
            value={targetPct} className={`w-14 text-center ${control}`}
            onChange={e => { stop(); setTargetPct(Math.min(100, Math.max(0, +e.target.value))); }} />
          %
        </label>
        {state.kind === 'solving' ? (
          <button type="button" onClick={stop}
            className="px-2.5 py-1 rounded-md font-bold border border-border/40 text-text-muted hover:text-text">
            Cancel
          </button>
        ) : (
          <button type="button" onClick={solve}
            className="px-2.5 py-1 rounded-md font-bold border border-border/40 text-text hover:brightness-110">
            Solve
          </button>
        )}
        <button type="button" onClick={apply} disabled={solvedValue === null}
          className="px-2.5 py-1 rounded-md font-bold border border-border/40 text-text hover:brightness-110 disabled:opacity-40">
          Apply
        </button>
      </div>

      <div role="status" aria-live="polite" className="tabular-nums" style={{ color: statusColor }}>
        {state.kind === 'solving' && <span className="text-text-muted">eval {state.k}</span>}
        {result && result.reason}
        {state.kind === 'error' && `Solve failed: ${state.message}`}
      </div>
    </section>
  );
}

/**
 * What the last Apply changed against the run before it — survival moves,
 * alert churn, canon flips — with Undo back to that run.
 */
export function SweepDiffBar({ diff, applied, onUndo }: {
  diff: SweepDiff;
  /** e.g. 'Enemy HP 1 → 3.986'. */
  applied: string;
  onUndo: () => void;
}) {
  const moved = diff.cells.filter(c => Math.round(c.survivalDelta * 100) !== 0).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-lg bg-surface-deep border border-border/30 text-xs font-mono tabular-nums">
      <span className="font-bold text-text">Applied {applied}</span>
      <span className="text-text-muted">survival moved in {moved}/{diff.cells.length} cells</span>
      <span className="text-text-muted">alerts +{diff.alertsAdded.length} / −{diff.alertsRemoved.length}</span>
      {diff.canonFlips.map(f => (
        <span key={f.lawId} style={{ color: f.to === 'violation' ? STATUS_ERROR : STATUS_SUCCESS }}>
          canon {f.lawId}: {f.from} → {f.to}
        </span>
      ))}
      <button type="button" onClick={onUndo}
        className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border border-border/40 text-text-muted hover:text-text">
        <Undo2 className="w-3 h-3" /> Undo
      </button>
    </div>
  );
}
