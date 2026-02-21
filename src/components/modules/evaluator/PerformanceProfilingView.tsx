'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Gauge, Upload, Play, Cpu, MonitorDot, AlertTriangle,
  ChevronDown, ChevronRight, Zap, MemoryStick, Trash2,
  BarChart3, Activity, RefreshCw, Target, ShieldAlert,
  Copy, Clock, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';
import { useProjectStore } from '@/stores/projectStore';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type {
  ProfilingSession,
  TriageResult,
  PerformanceFinding,
  FrameTimingSample,
  ActorTickProfile,
  MemoryAllocation,
  OptimizationPriority,
} from '@/types/performance-profiling';
import { UI_TIMEOUTS } from '@/lib/constants';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_FINDINGS: PerformanceFinding[] = [];

const PRIORITY_STYLE: Record<OptimizationPriority, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400' },
  high: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400' },
  medium: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400' },
  low: { bg: 'bg-text-muted/10', border: 'border-text-muted/20', text: 'text-text-muted' },
};

const BOTTLENECK_LABELS: Record<string, string> = {
  'game-thread': 'Game Thread Bound',
  'render-thread': 'Render Thread Bound',
  gpu: 'GPU Bound',
  balanced: 'Balanced',
};

const SCENARIO_OPTIONS = [
  { value: 'combat-heavy', label: 'Combat Heavy (50 enemies)' },
  { value: 'exploration', label: 'Exploration (open world)' },
  { value: 'menu', label: 'Menu / Inventory' },
  { value: 'loading', label: 'Level Loading' },
] as const;

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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text">Performance Profiling</h1>
            <p className="text-xs text-text-muted">
              UE5 runtime analysis with AI-powered optimization triage
            </p>
          </div>
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-text-muted text-xs font-medium hover:text-text hover:border-border-bright transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            onClick={handleGenerate}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isImporting ? 'Generating...' : 'Generate Sample'}
          </button>
        </div>

        {/* Import panel */}
        <AnimatePresence>
          {showImport && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
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
            <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: '#f4364c10' }}>
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
                  Score: <ProgressRing value={triage.overallScore} size={20} strokeWidth={2} color={triage.overallScore > 70 ? '#10b981' : triage.overallScore > 40 ? MODULE_COLORS.content : MODULE_COLORS.evaluator} />
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

// ── CSV Import Panel ────────────────────────────────────────────────────────

function CSVImportPanel({ onImport, isImporting }: {
  onImport: (csv: string, name: string) => Promise<void>;
  isImporting: boolean;
}) {
  const [csvText, setCsvText] = useState('');
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name.replace(/\.(csv|txt)$/i, ''));
    const reader = new FileReader();
    reader.onload = () => setCsvText(reader.result as string);
    reader.readAsText(file);
  }, []);

  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-muted hover:text-text transition-colors"
        >
          <Upload className="w-3 h-3" />
          Choose File
        </button>
        <input
          type="text"
          placeholder="Session name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-rose-500/40"
        />
        <button
          onClick={() => onImport(csvText, name || 'Imported Session')}
          disabled={!csvText || isImporting}
          className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          Import & Analyze
        </button>
      </div>
      {csvText && (
        <div className="text-2xs text-text-muted">
          Loaded {csvText.split('\n').length} lines · {(csvText.length / 1024).toFixed(1)}KB
        </div>
      )}
      <p className="text-2xs text-text-muted/60">
        Paste or upload a UE5 stat dump CSV (stat dumpframe, Unreal Insights CSV export)
      </p>
    </SurfaceCard>
  );
}

// ── Frame Time Chart ────────────────────────────────────────────────────────

function FrameTimeChart({ samples, budgetMs }: { samples: FrameTimingSample[]; budgetMs: number }) {
  if (samples.length === 0) return null;

  const step = Math.max(1, Math.floor(samples.length / 60));
  const sampled = samples.filter((_, i) => i % step === 0);
  const maxMs = Math.max(...sampled.map((s) => s.totalFrameMs), budgetMs * 1.5);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-rose-400" />
        <h2 className="text-sm font-medium text-text">Frame Time</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-2xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Game</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Render</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> GPU</span>
        </div>
      </div>

      <div className="relative">
        {/* Budget line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-emerald-500/40 z-10"
          style={{ bottom: `${(budgetMs / maxMs) * 100}%` }}
        >
          <span className="absolute right-0 -top-3.5 text-2xs text-emerald-400/60">
            {budgetMs.toFixed(1)}ms ({Math.round(1000 / budgetMs)}fps)
          </span>
        </div>

        <div className="flex items-end gap-px h-36">
          {sampled.map((s, i) => {
            const gtH = (s.gameThreadMs / maxMs) * 100;
            const rtH = (s.renderThreadMs / maxMs) * 100;
            const gpuH = (s.gpuMs / maxMs) * 100;
            const overBudget = s.totalFrameMs > budgetMs;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                  <div className="bg-surface-deep border border-border rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-lg">
                    <div className="text-text-muted">Frame {s.frameIndex}</div>
                    <div className="text-blue-400">Game: {s.gameThreadMs.toFixed(2)}ms</div>
                    <div className="text-violet-400">Render: {s.renderThreadMs.toFixed(2)}ms</div>
                    <div className="text-orange-400">GPU: {s.gpuMs.toFixed(2)}ms</div>
                    <div className={overBudget ? 'text-red-400' : 'text-emerald-400'}>
                      Total: {s.totalFrameMs.toFixed(2)}ms ({Math.round(1000 / s.totalFrameMs)}fps)
                    </div>
                    <div className="text-text-muted">Draw calls: {s.drawCalls}</div>
                  </div>
                </div>
                <div className="w-full flex flex-col gap-px h-full justify-end">
                  <div className={`w-full rounded-t-sm ${overBudget ? 'bg-blue-400/60' : 'bg-blue-400/40'}`} style={{ height: `${gtH}%` }} />
                  <div className="w-full bg-violet-400/40" style={{ height: `${rtH}%` }} />
                  <div className="w-full bg-orange-400/40" style={{ height: `${gpuH}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Actor Tick Table ────────────────────────────────────────────────────────

function ActorTickTable({ actors, budgetMs }: { actors: ActorTickProfile[]; budgetMs: number }) {
  if (actors.length === 0) return null;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-medium text-text">Actor Tick Costs</h2>
        <Badge>{actors.length} classes</Badge>
      </div>

      <div className="space-y-1.5">
        {actors.slice(0, 10).map((actor) => {
          const barWidth = Math.min((actor.totalTickMs / (budgetMs * 0.5)) * 100, 100);
          const isHot = actor.totalTickMs > budgetMs * 0.1;
          return (
            <div key={actor.className} className="flex items-center gap-3">
              <span className="text-2xs text-cyan-400 font-mono w-40 truncate flex-shrink-0">{actor.className}</span>
              <span className="text-2xs text-text-muted w-12 flex-shrink-0 text-right">×{actor.instanceCount}</span>
              <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${isHot ? 'bg-red-400/50' : 'bg-blue-400/40'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`text-2xs font-mono w-16 text-right flex-shrink-0 ${isHot ? 'text-red-400' : 'text-text-muted'}`}>
                {actor.totalTickMs.toFixed(2)}ms
              </span>
              <span className="text-2xs text-text-muted/60 w-10 flex-shrink-0 text-right">
                {actor.gameThreadPercent.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

// ── Memory Chart ────────────────────────────────────────────────────────────

function MemoryChart({ allocations }: { allocations: MemoryAllocation[] }) {
  if (allocations.length === 0) return null;

  const sorted = [...allocations].sort((a, b) => b.currentMB - a.currentMB);
  const maxMB = Math.max(...sorted.map((a) => a.peakMB), 1);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <MemoryStick className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-medium text-text">Memory Breakdown</h2>
        <Badge>{sorted.reduce((s, a) => s + a.currentMB, 0).toFixed(0)}MB total</Badge>
      </div>

      <div className="space-y-1.5">
        {sorted.slice(0, 10).map((alloc) => {
          const currentW = (alloc.currentMB / maxMB) * 100;
          const peakW = (alloc.peakMB / maxMB) * 100;
          return (
            <div key={alloc.category} className="flex items-center gap-3">
              <span className="text-2xs text-text-muted w-36 truncate flex-shrink-0">{alloc.category}</span>
              <div className="flex-1 h-3 bg-surface-deep rounded overflow-hidden relative">
                <div
                  className="absolute h-full bg-emerald-400/15 rounded"
                  style={{ width: `${peakW}%` }}
                />
                <div
                  className="h-full bg-emerald-400/40 rounded relative z-10"
                  style={{ width: `${currentW}%` }}
                />
              </div>
              <span className="text-2xs font-mono text-text-muted w-20 text-right flex-shrink-0">
                {alloc.currentMB.toFixed(0)}MB
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

// ── Findings Section ────────────────────────────────────────────────────────

function FindingsSection({ findings }: { findings: PerformanceFinding[] }) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">AI Triage Findings</h2>
        <Badge variant={findings.some((f) => f.priority === 'critical') ? 'error' : 'warning'}>
          {findings.length} issues · ~{findings.reduce((s, f) => s + f.estimatedSavingsMs, 0).toFixed(1)}ms savings
        </Badge>
      </div>

      <div className="space-y-2">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function FindingCard({ finding }: { finding: PerformanceFinding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = PRIORITY_STYLE[finding.priority];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finding.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [finding.fixPrompt]);

  return (
    <div className={`rounded-lg border ${style.bg} ${style.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        <span className={`px-1.5 py-0.5 rounded text-2xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
          {finding.priority}
        </span>
        <span className="text-xs font-medium text-text flex-1 truncate">{finding.title}</span>
        <span className="text-2xs text-emerald-400 font-medium flex-shrink-0">
          ~{finding.estimatedSavingsMs.toFixed(1)}ms
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              <p className="text-2xs text-text-muted/80 leading-relaxed">{finding.description}</p>

              {finding.involvedClasses.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {finding.involvedClasses.map((cls) => (
                    <span key={cls} className="px-1.5 py-0.5 bg-cyan-400/5 border border-cyan-400/15 rounded text-2xs text-cyan-400 font-mono">
                      {cls}
                    </span>
                  ))}
                </div>
              )}

              {/* Fix prompt */}
              <div className="relative">
                <div className="text-2xs text-text-muted font-medium mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Fix Prompt (for Claude CLI)
                </div>
                <pre className="px-3 py-2 bg-surface-deep border border-border rounded text-2xs text-text/80 font-mono overflow-x-auto whitespace-pre-wrap">
                  {finding.fixPrompt}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-7 right-2 flex items-center gap-1 px-2 py-1 bg-surface border border-border rounded text-2xs text-text-muted hover:text-text transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Checklist label */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-400/5 border border-emerald-400/15 rounded">
                <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-2xs text-emerald-400">
                  Checklist: {finding.checklistLabel}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}
