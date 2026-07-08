'use client';

import { useState, useCallback } from 'react';
import {
  Gauge, Upload, Play, Cpu, MonitorDot,
  Zap, Activity, RefreshCw, Target, ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { useProjectStore } from '@/stores/projectStore';
import { MODULE_COLORS, ACCENT_EMERALD_DARK, ACCENT_RED, OPACITY_8 } from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { EMPTY_FINDINGS, BOTTLENECK_LABELS, SCENARIO_OPTIONS } from './constants';
import { CSVImportPanel } from './CSVImportPanel';
import { FrameTimeChart } from './FrameTimeChart';
import { ActorTickTable } from './ActorTickTable';
import { MemoryChart } from './MemoryChart';
import { FindingsSection } from './FindingsSection';
import { StatCard } from './StatCard';

// ── Main Component ──────────────────────────────────────────────────────────

export function PerformanceProfilingView() {
  const activeSession = usePerformanceProfilingStore((s) => s.activeSession);
  const triage = usePerformanceProfilingStore((s) => s.triage);
  const findings = usePerformanceProfilingStore((s) => s.findings) ?? EMPTY_FINDINGS;
  const isLoading = usePerformanceProfilingStore((s) => s.isLoading);
  const isImporting = usePerformanceProfilingStore((s) => s.isImporting);
  const isTriaging = usePerformanceProfilingStore((s) => s.isTriaging);
  const error = usePerformanceProfilingStore((s) => s.error);

  const generateSample = usePerformanceProfilingStore((s) => s.generateSample);
  const importCSV = usePerformanceProfilingStore((s) => s.importCSV);
  const runTriage = usePerformanceProfilingStore((s) => s.runTriage);

  const projectPath = useProjectStore((s) => s.projectPath);

  const [showImport, setShowImport] = useState(false);
  const [scenario, setScenario] = useState<string>('combat-heavy');
  const [enemyCount, setEnemyCount] = useState(50);
  const [targetFPS, setTargetFPS] = useState(60);

  const handleGenerate = useCallback(async () => {
    const session = await generateSample(scenario, enemyCount, targetFPS, projectPath);
    if (session) {
      await runTriage(session.id);
    }
  }, [generateSample, runTriage, scenario, enemyCount, targetFPS, projectPath]);

  const handleTriage = useCallback(async () => {
    if (activeSession) await runTriage(activeSession.id);
  }, [runTriage, activeSession]);

  const summary = activeSession?.summary;
  const critCount = findings.filter((f) => f.priority === 'critical').length;
  const highCount = findings.filter((f) => f.priority === 'high').length;
  const totalSavings = findings.reduce((s, f) => s + f.estimatedSavingsMs, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <DashboardHeader
          icon={Gauge}
          title="Performance Profiling"
          subtitle="UE5 runtime analysis with AI-powered optimization triage"
          accent="rose"
          accentTo="orange"
          className="mb-4"
          secondaryAction={
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-text-muted text-xs font-medium hover:text-text hover:border-border-bright transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
          }
          action={
            <button
              onClick={handleGenerate}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
            >
              {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isImporting ? 'Generating...' : 'Generate Sample'}
            </button>
          }
        />

        {/* Import panel */}
        <AnimatePresence>
          {showImport && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: MOTION.base }}
              className="overflow-hidden mb-3"
            >
              <CSVImportPanel
                onImport={async (csv, name) => {
                  const session = await importCSV(csv, name, projectPath);
                  if (session) {
                    await runTriage(session.id);
                    setShowImport(false);
                  }
                }}
                isImporting={isImporting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scenario config */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1">
            {SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setScenario(opt.value);
                  if (opt.value === 'combat-heavy') setEnemyCount(50);
                  else if (opt.value === 'exploration') setEnemyCount(10);
                  else setEnemyCount(0);
                }}
                className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
                  scenario === opt.value
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-surface border-border text-text-muted hover:text-text'
                }`}
              >
                {opt.label.split(' (')[0]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-2xs text-text-muted">Enemies:</label>
            <input
              type="number"
              value={enemyCount}
              onChange={(e) => setEnemyCount(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
              className="w-16 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-rose-500/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-2xs text-text-muted">Target FPS:</label>
            <input
              type="number"
              value={targetFPS}
              onChange={(e) => setTargetFPS(Math.max(30, Math.min(144, Number(e.target.value) || 60)))}
              className="w-16 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-rose-500/40"
            />
          </div>
        </div>

        {/* Stats bar */}
        {summary && (
          <div className="flex gap-3">
            <StatCard
              icon={<Target className="w-4 h-4 text-rose-400" />}
              value={`${summary.avgFPS.toFixed(0)} fps`}
              label={`Budget: ${summary.budgetHitRate.toFixed(0)}% hit`}
              color={summary.avgFPS >= 1000 / summary.frameBudgetMs * 0.9 ? 'text-emerald-400' : 'text-rose-400'}
            />
            <StatCard
              icon={<Cpu className="w-4 h-4 text-blue-400" />}
              value={`${summary.avgGameThreadMs.toFixed(1)}ms`}
              label="Game Thread"
              color={summary.avgGameThreadMs > summary.frameBudgetMs * 0.7 ? 'text-amber-400' : 'text-blue-400'}
            />
            <StatCard
              icon={<MonitorDot className="w-4 h-4 text-violet-400" />}
              value={`${summary.avgGpuMs.toFixed(1)}ms`}
              label="GPU"
              color={summary.avgGpuMs > summary.frameBudgetMs * 0.8 ? 'text-amber-400' : 'text-violet-400'}
            />
            <StatCard
              icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
              value={`${critCount}/${highCount}`}
              label={`Savings: ~${totalSavings.toFixed(1)}ms`}
              color={critCount > 0 ? 'text-red-400' : 'text-amber-400'}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Loading profiling data...</span>
          </div>
        )}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!isLoading && !activeSession && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: `${ACCENT_RED}${OPACITY_8}` }}>
              <Gauge className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-sm font-semibold text-text mb-1">No Profiling Data</h3>
            <p className="text-xs text-text-muted max-w-xs leading-relaxed">
              Import a UE5 stat CSV export or generate a sample session to analyze frame timing, thread budgets, and actor tick costs.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isImporting}
              className="flex items-center gap-1.5 mt-4 px-4 py-2 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Generate Sample Session
            </button>
          </div>
        )}

        {activeSession && (
          <div className="space-y-5">
            {/* Session info */}
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <Zap className="w-3 h-3" />
              {activeSession.name} · {activeSession.frameCount} frames · {(activeSession.durationMs / 1000).toFixed(1)}s
              {triage && (
                <>
                  <span className="text-text-muted/50">|</span>
                  Score: <ProgressRing value={triage.overallScore} size={20} strokeWidth={2} color={triage.overallScore > 70 ? ACCENT_EMERALD_DARK : triage.overallScore > 40 ? MODULE_COLORS.content : MODULE_COLORS.evaluator} />
                  <span className="text-text-muted/50">|</span>
                  {BOTTLENECK_LABELS[triage.bottleneck]}
                </>
              )}
              {!triage && (
                <button
                  onClick={handleTriage}
                  disabled={isTriaging}
                  className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-2xs hover:bg-rose-500/20 transition-colors"
                >
                  {isTriaging ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Activity className="w-2.5 h-2.5" />}
                  Run Triage
                </button>
              )}
            </div>

            {/* Frame Time Chart */}
            <FrameTimeChart samples={activeSession.frameSamples} budgetMs={activeSession.summary.frameBudgetMs} />

            {/* Actor Tick Costs */}
            <ActorTickTable actors={activeSession.actorProfiles} budgetMs={activeSession.summary.frameBudgetMs} />

            {/* Memory Breakdown */}
            <MemoryChart allocations={activeSession.memoryAllocations} />

            {/* Triage Findings */}
            {findings.length > 0 && (
              <FindingsSection findings={findings} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
