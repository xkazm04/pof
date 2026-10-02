'use client';

import { useState, useCallback, useMemo } from 'react';
import { Play, Activity, TrendingUp, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPACITY_20,
  withOpacity, OPACITY_25, STATUS_ERROR,
} from '@/lib/chart-colors';
import {
  ACCENT,
  DEFAULT_PREDICTIVE_CONFIG,
  type BalanceReport,
  type PredictiveBalanceConfig,
} from './data';
import { diffSweeps, leverInfo, type SweepCellRef } from '@/lib/combat/sweep-tuning';
import type { ArchetypeRegistry, EnemySourceReport } from '@/lib/combat/simulation-engine';
import { CellTuner, SweepDiffBar } from './CellTuner';
import { BlueprintPanel, SectionHeader } from './design';
import { ConfigPanel } from './ConfigPanel';
import { ResultsPanel } from './ResultsPanel';
import { EnemySourcePanel } from './EnemySourcePanel';
import { useBestiaryEnemies } from './useBestiaryEnemies';
import { usePredictiveSweep } from './usePredictiveSweep';

/** What produced a report: the config and enemies it ran with. */
interface SweepRun {
  config: PredictiveBalanceConfig;
  enemies: { registry: ArchetypeRegistry; provenance?: EnemySourceReport };
}
/** The run before an Apply, kept so the grid can diff against it and Undo can restore it. */
interface Baseline {
  report: BalanceReport;
  run: SweepRun;
  applied: string;
}
/** The report on screen, the run that produced it, and its baseline (after an Apply). */
interface Shown {
  report: BalanceReport | null;
  run: SweepRun | null;
  baseline: Baseline | null;
}
/** A requested run: it becomes Shown once the job lands a report other than `prevReport`. */
interface Pending extends Omit<Shown, 'report'> {
  run: SweepRun;
  prevReport: BalanceReport | null;
}

const NOTHING_SHOWN: Shown = { report: null, run: null, baseline: null };
const fmt = (x: number) => `${+x.toFixed(3)}`;

export function PredictiveBalanceSimulator() {
  const [config, setConfig] = useState<PredictiveBalanceConfig>(DEFAULT_PREDICTIVE_CONFIG);
  // Enemies come from the REAL bestiary catalog when it holds usable rows, and
  // fall back to the hardcoded fixtures otherwise — the panel says which.
  const enemies = useBestiaryEnemies();
  // The sweep runs as a cancellable job (one engine run per cell, yielding
  // between and inside cells) — never one synchronous block on the UI thread.
  const { report: jobReport, progress, error, running: isRunning, run, cancel } = usePredictiveSweep();

  // Tune-from-the-heatmap state. A run's report is SHOWN only once its job
  // lands (a cancelled run changes nothing); an Apply keeps the previous run as
  // the baseline the grid diffs against and Undo restores.
  const [settled, setSettled] = useState<Shown>(NOTHING_SHOWN);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selected, setSelected] = useState<SweepCellRef | null>(null);
  const landed = pending !== null && jobReport !== null && jobReport !== pending.prevReport;
  const shown = useMemo<Shown>(
    () => (pending && landed ? { report: jobReport, run: pending.run, baseline: pending.baseline } : settled),
    [pending, landed, jobReport, settled],
  );
  const { report, baseline } = shown;

  const startRun = useCallback((next: SweepRun, nextBaseline: Baseline | null) => {
    setSettled(shown);
    setPending({ run: next, prevReport: jobReport, baseline: nextBaseline });
    run(next.config, next.enemies);
  }, [shown, jobReport, run]);

  const runSim = useCallback(() => {
    if (isRunning) return;
    startRun({ config, enemies: { registry: enemies.registry, provenance: enemies.provenance } }, null);
  }, [isRunning, startRun, config, enemies.registry, enemies.provenance]);

  const cancelRun = useCallback(() => {
    cancel();
    // A cancelled Apply leaves the tuning it started from.
    if (pending?.baseline && !landed) {
      const before = pending.baseline.run.config.tuning;
      setConfig(c => ({ ...c, tuning: before }));
    }
    setPending(null);
    setSettled(shown);
  }, [cancel, pending, landed, shown]);

  const applyTuning = useCallback((next: PredictiveBalanceConfig, applied: { lever: keyof PredictiveBalanceConfig['tuning']; value: number }) => {
    if (!shown.report || !shown.run || isRunning) return;
    const from = shown.run.config.tuning[applied.lever];
    setConfig(c => ({ ...c, tuning: next.tuning }));
    startRun({ config: next, enemies: shown.run.enemies }, {
      report: shown.report,
      run: shown.run,
      applied: `${leverInfo(applied.lever).label} ${fmt(from)} → ${fmt(applied.value)}`,
    });
  }, [shown, isRunning, startRun]);

  const undo = useCallback(() => {
    if (!baseline) return;
    setConfig(c => ({ ...c, tuning: baseline.run.config.tuning }));
    setPending(null);
    setSettled({ report: baseline.report, run: baseline.run, baseline: null });
  }, [baseline]);

  const diff = useMemo(() => (baseline && report ? diffSweeps(baseline.report, report) : null), [baseline, report]);
  const levelCount = Math.max(0, Math.floor((config.levelRange[1] - config.levelRange[0]) / config.levelStep) + 1);
  const selectedEncounter = selected && report?.heatmap.some(
    c => c.playerLevel === selected.level && c.encounterIndex === selected.encounterIndex,
  ) ? report.encounters.find(e => e.index === selected.encounterIndex) : undefined;

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <SectionHeader icon={TrendingUp} label="Predictive Balance Simulator" color={ACCENT} />
        <button
          onClick={runSim}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
          style={{
            backgroundColor: `${ACCENT}${OPACITY_20}`,
            color: ACCENT,
            border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}`,
          }}
        >
          {isRunning ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Activity className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? 'Simulating...' : 'Run Simulation'}
        </button>
      </div>

      <div className="p-3 space-y-3">
        <EnemySourcePanel
          provenance={enemies.provenance}
          loading={enemies.loading}
          error={enemies.error}
        />

        <ConfigPanel
          config={config}
          setConfig={setConfig}
          registry={enemies.registry}
          catalogSourced={new Set(enemies.provenance.hydrated.map(h => h.archetypeId))}
        />

        {/* Empty state */}
        {!report && !isRunning && (
          <div className="text-center py-8 text-text-muted text-xs font-mono">
            Click &quot;Run Simulation&quot; to sweep Lv.{config.levelRange[0]}&ndash;{config.levelRange[1]} across {config.enemyConfigs.length} encounter types
          </div>
        )}

        {/* Loading state */}
        {isRunning && (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="inline-block"
            >
              <Activity className="w-6 h-6" style={{ color: ACCENT }} />
            </motion.div>
            <div className="text-xs text-text-muted font-mono mt-2">
              Running {config.iterations} iterations x {levelCount} levels x {config.enemyConfigs.length} encounters...
            </div>
            <div className="text-xs text-text-muted font-mono mt-1" aria-live="polite">
              {progress ? `cell ${progress.done}/${progress.total}` : 'starting…'}
            </div>
            <button
              type="button"
              onClick={cancelRun}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-border/40 text-text-muted hover:text-text hover:brightness-110"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}

        {error && !isRunning && (
          <div className="text-xs font-mono text-center" style={{ color: STATUS_ERROR }}>
            Simulation failed: {error}
          </div>
        )}

        {/* Results */}
        {report && !isRunning && (
          <ResultsPanel
            report={report}
            diff={diff}
            diffBar={diff && baseline ? <SweepDiffBar diff={diff} applied={baseline.applied} onUndo={undo} /> : null}
            selectedCell={selected}
            onSelectCell={c => setSelected({ level: c.playerLevel, encounterIndex: c.encounterIndex })}
            tuner={selected && selectedEncounter && shown.run ? (
              <CellTuner
                key={`${selected.level}|${selected.encounterIndex}`}
                config={shown.run.config}
                enemies={shown.run.enemies}
                cell={selected}
                label={selectedEncounter.label}
                onApply={applyTuning}
                onClose={() => setSelected(null)}
              />
            ) : null}
          />
        )}
      </div>
    </BlueprintPanel>
  );
}
