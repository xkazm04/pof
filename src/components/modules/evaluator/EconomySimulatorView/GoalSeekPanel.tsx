'use client';

import { useCallback, useMemo, useState } from 'react';
import { Target, Crosshair, RefreshCw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { SimulationConfig } from '@/types/economy-simulator';
import type { EconomyGoalSeekResult } from '@/lib/economy/goal-seek';
import { STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { formatGold } from './helpers';

// ── Goal-seek: auto-balance one faucet/sink to a target ─────────────────────
// Wires the generalized `solveFor` bisection (economy lever) into the UI: pick a
// flow + a target net-flow/Gini, and the solver reports the baseAmount that hits
// it (+ achieved metric, iterations, convergence) over the SEEDED engine.

type GoalOutput = 'netFlow' | 'gini';

const OUTPUT_LABELS: Record<GoalOutput, string> = { netFlow: 'Net Flow /hr', gini: 'Gini' };

export function GoalSeekPanel({ config }: { config: SimulationConfig }) {
  const flows = useEconomySimulatorStore((s) => s.defaultFlows);

  const [flowId, setFlowId] = useState<string>('');
  const [output, setOutput] = useState<GoalOutput>('netFlow');
  const [target, setTarget] = useState<string>('0');
  const [result, setResult] = useState<EconomyGoalSeekResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Default the flow selection to the first available flow.
  const effectiveFlowId = flowId || flows[0]?.id || '';
  const selectedFlow = useMemo(() => flows.find((f) => f.id === effectiveFlowId), [flows, effectiveFlowId]);

  const run = useCallback(async () => {
    const targetNum = Number(target);
    if (!Number.isFinite(targetNum)) { setErr('Enter a numeric target'); return; }
    if (!effectiveFlowId) { setErr('No flow selected'); return; }
    setBusy(true); setErr(null);
    try {
      const data = await apiFetch<EconomyGoalSeekResult>('/api/economy-simulator/goal-seek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, flowId: effectiveFlowId, target: targetNum, output }),
      });
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Goal-seek failed');
    } finally {
      setBusy(false);
    }
  }, [config, effectiveFlowId, output, target]);

  const fmtMetric = (v: number) => (output === 'gini' ? v.toFixed(3) : `${v >= 0 ? '+' : ''}${formatGold(v)}/hr`);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Target className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Auto-balance to target</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {(Object.keys(OUTPUT_LABELS) as GoalOutput[]).map((o) => (
            <button
              key={o}
              onClick={() => setOutput(o)}
              className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
                output === o ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-border text-text-muted bg-surface hover:text-text'
              }`}
            >
              {OUTPUT_LABELS[o]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <label className="flex flex-col gap-1 text-2xs text-text-muted">
          Lever (faucet/sink)
          <select
            value={effectiveFlowId}
            onChange={(e) => setFlowId(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs text-text min-w-44"
          >
            <optgroup label="Faucets">
              {flows.filter((f) => f.type === 'faucet').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
            <optgroup label="Sinks">
              {flows.filter((f) => f.type === 'sink').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-2xs text-text-muted">
          Target {OUTPUT_LABELS[output]}
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-surface border border-border text-xs text-text w-28"
          />
        </label>
        <button
          onClick={run}
          disabled={busy || !effectiveFlowId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
          {busy ? 'Solving…' : 'Auto-balance'}
        </button>
      </div>

      {err && <p className="text-2xs text-red-400 mb-2">{err}</p>}

      {!result && !busy && !err && (
        <p className="text-2xs text-text-muted/70">
          Bisects the seeded engine on the chosen flow&apos;s baseAmount until the metric hits your target. Reports the solved amount, the achieved metric, and how many iterations it took — or, if the target is unreachable by this lever alone, the nearest value and why.
        </p>
      )}

      {result && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-2xs font-medium"
              style={{
                color: result.converged ? STATUS_SUCCESS : STATUS_WARNING,
                backgroundColor: `${result.converged ? STATUS_SUCCESS : STATUS_WARNING}1a`,
              }}
            >
              {result.converged ? 'Converged' : 'Out of range'}
            </span>
            <span className="text-text-muted">{result.iterations} iterations</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-deep px-3 py-2">
              <div className="text-2xs text-text-muted">Solve {selectedFlow?.name ?? 'flow'} baseAmount →</div>
              <div className="text-sm font-mono text-amber-400">{formatGold(Math.round(result.solvedValue))}</div>
              <div className="text-2xs text-text-muted/60">was {formatGold(result.baseValue)}</div>
            </div>
            <div className="rounded-lg bg-surface-deep px-3 py-2">
              <div className="text-2xs text-text-muted">Achieved {OUTPUT_LABELS[output]}</div>
              <div className="text-sm font-mono text-text">{fmtMetric(result.achievedMetric)}</div>
              <div className="text-2xs text-text-muted/60">target {fmtMetric(result.target)}</div>
            </div>
          </div>
          <p className="text-2xs text-text-muted/70">{result.reason}</p>
        </div>
      )}
    </SurfaceCard>
  );
}
