'use client';

import { useCallback, useMemo, useState } from 'react';
import { Play, BarChart3, RefreshCw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import type { SimulationConfig } from '@/types/economy-simulator';
import type { SweepResult, SweepOutput } from '@/lib/economy/sensitivity-sweep';
import { ACCENT_EMERALD_DARK, ACCENT_PURPLE_BOLD } from '@/lib/chart-colors';
import { SWEEP_OUTPUT_LABELS } from './constants';
import { formatGold } from './helpers';

// ── Tornado: parameter sensitivity sweep ───────────────────────────────────

export function TornadoSection({ config }: { config: SimulationConfig }) {
  const [output, setOutput] = useState<SweepOutput>('gini');
  const [sweep, setSweep] = useState<SweepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const data = await apiFetch<SweepResult>('/api/economy-simulator/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, output, range: 0.5 }),
      });
      setSweep(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setBusy(false);
    }
  }, [config, output]);

  const bounds = useMemo(() => {
    if (!sweep || sweep.entries.length === 0) return null;
    const vals = sweep.entries.flatMap((e) => [e.low, e.high]).concat(sweep.baseline);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.06 || 1;
    return { min: min - pad, max: max + pad };
  }, [sweep]);
  const pct = (v: number) => (bounds ? ((v - bounds.min) / (bounds.max - bounds.min)) * 100 : 0);
  const fmt = (v: number) => (output === 'gini' ? v.toFixed(3) : output === 'criticalAlerts' ? String(Math.round(v)) : formatGold(v));

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Parameter Sensitivity (tornado)</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {(Object.keys(SWEEP_OUTPUT_LABELS) as SweepOutput[]).map((o) => (
            <button
              key={o}
              onClick={() => setOutput(o)}
              className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
                output === o ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-border text-text-muted bg-surface hover:text-text'
              }`}
            >
              {SWEEP_OUTPUT_LABELS[o]}
            </button>
          ))}
          <button
            onClick={run}
            disabled={busy}
            className="ml-1 flex items-center gap-1.5 px-3 py-1 rounded-lg text-2xs font-medium bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {busy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {busy ? 'Sweeping…' : 'Run sweep'}
          </button>
        </div>
      </div>

      {err && <p className="text-2xs text-red-400 mb-2">{err}</p>}

      {!sweep && !busy && (
        <p className="text-2xs text-text-muted/70">
          Re-runs the deterministic engine while varying each faucet/sink baseAmount ±50%, then ranks parameters by how far they move the chosen output. The few longest bars are the levers that dominate.
        </p>
      )}

      {sweep && sweep.entries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs text-text-muted/60">
            <span>{fmt(bounds!.min)}</span>
            <span className="text-violet-400">baseline {fmt(sweep.baseline)}</span>
            <span>{fmt(bounds!.max)}</span>
          </div>
          {sweep.entries.map((e) => {
            const lo = Math.min(e.low, e.high);
            const hi = Math.max(e.low, e.high);
            const left = pct(lo);
            const width = Math.max(0.5, pct(hi) - pct(lo));
            return (
              <div key={e.paramId} className="flex items-center gap-2 group">
                <span className="w-40 shrink-0 truncate text-2xs text-text-muted" title={e.label}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: e.kind === 'faucet' ? ACCENT_EMERALD_DARK : ACCENT_PURPLE_BOLD }} />
                  {e.label}
                </span>
                <div className="relative flex-1 h-4 rounded bg-surface-deep">
                  <div
                    className="absolute top-0 bottom-0 rounded bg-amber-400/50 group-hover:bg-amber-400/70 transition-colors"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-px bg-violet-400/70" style={{ left: `${pct(sweep.baseline)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-2xs font-mono text-text-muted">{fmt(e.low)} → {fmt(e.high)}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-3 text-2xs text-text-muted mt-2 pt-2 border-t border-border/50">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD_DARK }} /> Faucet</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_PURPLE_BOLD }} /> Sink</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> baseline</span>
            <span className="ml-auto">±{Math.round(sweep.range * 100)}% per parameter · sorted by impact</span>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
