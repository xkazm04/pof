'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Trash2, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import { driftDirection } from '@/lib/balance/baseline';
import { MOTION } from '@/lib/constants';

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.abs(n) < 10 ? n.toFixed(2) : Math.round(n).toString();
}

/** Saved-runs chips + save/baseline/delete controls. Wired to economySimulatorStore. */
export function EconomyRunsStrip() {
  const savedRuns = useEconomySimulatorStore((s) => s.savedRuns);
  const baselineRun = useEconomySimulatorStore((s) => s.baselineRun);
  const result = useEconomySimulatorStore((s) => s.result);
  const isRunsLoading = useEconomySimulatorStore((s) => s.isRunsLoading);

  const listRuns = useEconomySimulatorStore((s) => s.listRuns);
  const saveCurrentRun = useEconomySimulatorStore((s) => s.saveCurrentRun);
  const loadRun = useEconomySimulatorStore((s) => s.loadRun);
  const deleteRun = useEconomySimulatorStore((s) => s.deleteRun);
  const setBaselineRun = useEconomySimulatorStore((s) => s.setBaselineRun);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listRuns();
  }, [listRuns]);

  const canSave = !!result && name.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const run = await saveCurrentRun(name.trim());
    setSaving(false);
    if (run) setName('');
  }

  if (savedRuns.length === 0 && !result) {
    // Nothing to save and nothing saved — keep the strip out of the way.
    return null;
  }

  return (
    <SurfaceCard level={2} className="p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-medium text-text">Saved Runs</span>
        {baselineRun && (
          <Badge variant="success" className="ml-1">Baseline: {baselineRun.name}</Badge>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder={result ? 'Name this run…' : 'Run a simulation to save…'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            disabled={!result || saving}
            className="w-44 px-2 py-1 bg-surface border border-border rounded text-xs text-text focus-ring disabled:opacity-50"
          />
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/25 rounded text-amber-400 text-2xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {isRunsLoading && savedRuns.length === 0 && (
          <span className="text-2xs text-text-muted">Loading…</span>
        )}
        {savedRuns.length === 0 && !isRunsLoading && (
          <span className="text-2xs text-text-muted/70">No runs saved yet — run a simulation and save it.</span>
        )}
        {savedRuns.map((run) => {
          const isBaseline = run.isBaseline;
          return (
            <div
              key={run.id}
              className={`group inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded border text-2xs transition-colors ${
                isBaseline
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-border bg-surface text-text hover:border-amber-500/30'
              }`}
            >
              <button
                onClick={() => loadRun(run.id)}
                title="Load this run (re-simulates with stored config)"
                className="font-medium hover:underline"
              >
                {run.name}
              </button>
              <span className="text-text-muted/60">·</span>
              <span className="text-text-muted/80">{formatNumber(run.metrics.avgGold)}g</span>
              <span className="text-text-muted/80">G{run.metrics.gini.toFixed(2)}</span>
              <button
                onClick={() => setBaselineRun(isBaseline ? null : run.id)}
                title={isBaseline ? 'Clear baseline' : 'Mark as baseline'}
                className={`p-0.5 rounded hover:bg-surface-hover/60 transition-colors ${isBaseline ? 'text-emerald-400' : 'text-text-muted hover:text-amber-400'}`}
              >
                {isBaseline ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
              </button>
              <button
                onClick={() => deleteRun(run.id)}
                title="Delete this run"
                className="p-0.5 rounded text-text-muted hover:text-red-400 hover:bg-surface-hover/60 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {baselineRun && result && (
          <DriftRow />
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

function DriftRow() {
  const drift = useEconomySimulatorStore((s) => s.drift);
  if (!drift || drift.stats.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: MOTION.base }}
        className="overflow-hidden"
      >
        <div className="mt-2 pt-2 border-t border-border/50 text-2xs text-emerald-400/80">
          ✓ No drift vs baseline — current run matches the baseline within tolerance.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: MOTION.base }}
      className="overflow-hidden"
    >
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="text-2xs text-text-muted mb-1.5">Drift vs <span className="text-emerald-400">{drift.baselineName}</span></div>
        <div className="flex flex-wrap gap-1.5">
          {drift.stats.map((s) => {
            const dir = driftDirection(s.delta);
            const sign = s.delta > 0 ? '+' : '';
            const color = dir === 'up' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              : dir === 'down' ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
              : 'text-text-muted border-border bg-surface';
            return (
              <span key={s.label} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-2xs ${color}`}>
                <span className="font-medium">{s.label}</span>
                <span>{sign}{formatNumber(s.delta)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
