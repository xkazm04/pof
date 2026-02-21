'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode2,
  Info,
  Loader2,
  Play,
  ScanSearch,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { runDeepEval, runSingleModuleEval, cancelDeepEval } from '@/lib/evaluator/deep-eval-engine';
import { generateFixPlan, generateBatchFixPlan } from '@/lib/evaluator/fix-plan-generator';
import { getEvaluableModuleIds, EVAL_PASSES, PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import { MODULE_LABELS } from '@/lib/module-registry';
import type { EvalProgress, DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import type { EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { EvalFinding, FindingSeverity, ScanFindings, ModuleFindings } from '@/lib/evaluator/finding-collector';
import type { FixPlan } from '@/lib/evaluator/fix-plan-generator';
import type { SubModuleId } from '@/types/modules';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, OPACITY_8 } from '@/lib/chart-colors';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVAL_ACCENT = MODULE_COLORS.evaluator;

const SEVERITY_CONFIG: Record<FindingSeverity, { label: string; color: string; bg: string; icon: typeof AlertOctagon }> = {
  critical: { label: 'Critical', color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_8}`, icon: AlertOctagon },
  high: { label: 'High', color: STATUS_BLOCKER, bg: `${STATUS_BLOCKER}${OPACITY_8}`, icon: AlertTriangle },
  medium: { label: 'Medium', color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, icon: Info },
  low: { label: 'Low', color: 'var(--text-muted)', bg: 'var(--text-muted)12', icon: Info },
};

const EFFORT_LABELS: Record<string, string> = {
  trivial: '< 5 min',
  small: '< 30 min',
  medium: '< 2 hours',
  large: '> 2 hours',
};

const PASS_STATUS_ICONS = {
  pending: <span className="w-2 h-2 rounded-full bg-border-bright" />,
  running: <Loader2 className="w-3 h-3 animate-spin text-[#fbbf24]" />,
  done: <Check className="w-3 h-3 text-[#4ade80]" />,
  error: <X className="w-3 h-3 text-[#f87171]" />,
  skipped: <span className="w-2 h-2 rounded-full bg-border" />,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DeepEvalResults() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const [progress, setProgress] = useState<EvalProgress | null>(null);
  const [result, setResult] = useState<DeepEvalResult | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set(getEvaluableModuleIds()));
  const [showModuleSelector, setShowModuleSelector] = useState(false);

  const fixCli = useModuleCLI({
    moduleId: 'ai-behavior',
    sessionKey: 'deep-eval-fix',
    label: 'Deep Eval Fix',
    accentColor: EVAL_ACCENT,
  });

  const isRunning = progress?.status === 'running';

  // ── Run evaluation ─────────────────────────────────────────────────────────

  const handleRunEval = useCallback(async () => {
    if (isRunning) return;

    const moduleIds = Array.from(selectedModuleIds);
    if (moduleIds.length === 0) return;

    setResult(null);

    try {
      const evalResult = await runDeepEval({
        moduleIds,
        projectContext: { projectName, projectPath, ueVersion },
        projectPath,
        onProgress: setProgress,
      });
      setResult(evalResult);

      // Auto-expand modules with critical findings
      const expanded = new Set<string>();
      for (const mod of evalResult.findings.modules) {
        if (mod.bySeverity.critical > 0 || mod.bySeverity.high > 0) {
          expanded.add(mod.moduleId);
        }
      }
      setExpandedModules(expanded);
    } catch (err) {
      console.error('Deep eval error:', err);
    }
  }, [isRunning, selectedModuleIds, projectName, projectPath, ueVersion]);

  const handleRunSingle = useCallback(async (moduleId: SubModuleId) => {
    if (isRunning) return;

    setResult(null);

    try {
      const evalResult = await runSingleModuleEval(moduleId, {
        projectContext: { projectName, projectPath, ueVersion },
        projectPath,
        onProgress: setProgress,
      });
      setResult(evalResult);
      setExpandedModules(new Set([moduleId]));
    } catch (err) {
      console.error('Single module eval error:', err);
    }
  }, [isRunning, projectName, projectPath, ueVersion]);

  const handleCancel = useCallback(() => {
    cancelDeepEval();
  }, []);

  // ── Fix handlers ───────────────────────────────────────────────────────────

  const handleFix = useCallback((finding: EvalFinding) => {
    const plan = generateFixPlan(finding, { projectName, projectPath, ueVersion });
    fixCli.sendPrompt(plan.prompt);
  }, [fixCli, projectName, projectPath, ueVersion]);

  const handleBatchFix = useCallback((moduleFindings: ModuleFindings) => {
    const criticalAndHigh = moduleFindings.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    );
    const targets = criticalAndHigh.length > 0 ? criticalAndHigh : moduleFindings.findings.slice(0, 5);
    const plan = generateBatchFixPlan(targets, moduleFindings.moduleId, { projectName, projectPath, ueVersion });
    if (plan) fixCli.sendPrompt(plan.prompt);
  }, [fixCli, projectName, projectPath, ueVersion]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────

  const toggleModule = (moduleId: SubModuleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSelectedModule = (moduleId: SubModuleId) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  // ── Duration formatting ────────────────────────────────────────────────────

  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Control bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ScanSearch className="w-4 h-4 text-[#ef4444]" />
            <h3 className="text-sm font-semibold text-text">Deep Module Evaluation</h3>
          </div>
          <p className="text-xs text-text-muted">
            Multi-pass analysis: structure, quality, and performance checks per module with auto-generated fix plans.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Module selector toggle */}
          <button
            onClick={() => setShowModuleSelector(!showModuleSelector)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all bg-surface text-text-muted border border-border hover:text-text hover:border-border-bright"
          >
            <BarChart3 className="w-3 h-3" />
            {selectedModuleIds.size}/{getEvaluableModuleIds().length} modules
          </button>

          {/* Run / Cancel */}
          {isRunning ? (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[#f8717112] text-[#f87171] border border-[#f8717125] hover:bg-[#f8717120]"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleRunEval}
              disabled={selectedModuleIds.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${EVAL_ACCENT}12`,
                color: EVAL_ACCENT,
                border: `1px solid ${EVAL_ACCENT}25`,
              }}
            >
              <Play className="w-3.5 h-3.5" />
              Run Deep Eval
            </button>
          )}
        </div>
      </div>

      {/* ── Module selector ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModuleSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <SurfaceCard className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Select Modules to Evaluate
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedModuleIds(new Set(getEvaluableModuleIds()))}
                    className="text-2xs text-[#60a5fa] hover:text-[#93bbfd] transition-colors"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedModuleIds(new Set())}
                    className="text-2xs text-text-muted hover:text-text transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {getEvaluableModuleIds().map((id) => {
                  const selected = selectedModuleIds.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleSelectedModule(id as SubModuleId)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all border ${
                        selected
                          ? 'text-text bg-border border-border-bright'
                          : 'text-text-muted bg-background border-border hover:text-text-muted'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-sm border transition-colors ${
                          selected ? 'bg-[#ef4444] border-[#ef4444]' : 'border-border-bright'
                        }`}
                      />
                      {MODULE_LABELS[id] ?? id}
                    </button>
                  );
                })}
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress panel ────────────────────────────────────────────────── */}
      {progress && isRunning && (
        <ProgressPanel progress={progress} />
      )}

      {/* ── Results summary ───────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <SurfaceCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ScanSearch className="w-4 h-4 text-[#ef4444]" />
                <span className="text-xs font-semibold text-text">
                  {result.findings.totalFindings} findings
                </span>
              </div>

              {/* Severity badges */}
              <div className="flex items-center gap-2">
                {(Object.entries(result.findings.bySeverity) as [FindingSeverity, number][])
                  .filter(([, count]) => count > 0)
                  .map(([sev, count]) => {
                    const cfg = SEVERITY_CONFIG[sev];
                    return (
                      <span
                        key={sev}
                        className="text-2xs font-semibold px-2 py-0.5 rounded"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {count} {cfg.label}
                      </span>
                    );
                  })}
              </div>

              <span className="text-2xs text-text-muted ml-auto">
                {result.modulesEvaluated.length} modules / {result.passesRun.length} passes / {formatDuration(result.duration)}
              </span>
            </div>
          </SurfaceCard>

          {/* Module tree */}
          <div className="space-y-2">
            {result.findings.modules.map((mod) => (
              <ModuleSection
                key={mod.moduleId}
                module={mod}
                isExpanded={expandedModules.has(mod.moduleId)}
                expandedCategories={expandedCategories}
                onToggleModule={() => toggleModule(mod.moduleId)}
                onToggleCategory={toggleCategory}
                onFix={handleFix}
                onBatchFix={() => handleBatchFix(mod)}
                onRunSingle={() => handleRunSingle(mod.moduleId)}
                isFixRunning={fixCli.isRunning}
              />
            ))}
          </div>

          {/* Empty results */}
          {result.findings.totalFindings === 0 && (
            <div className="bg-surface border border-[#4ade8020] rounded-lg p-8 text-center">
              <Check className="w-8 h-8 mx-auto text-[#4ade80] mb-3" />
              <h3 className="text-sm font-semibold text-text mb-1">No Issues Found</h3>
              <p className="text-xs text-text-muted">
                All evaluated modules passed the deep analysis checks.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state (no results, not running) ─────────────────────────── */}
      {!result && !isRunning && (
        <SurfaceCard level={3} className="p-8 text-center">
          <ScanSearch className="w-10 h-10 mx-auto text-border-bright mb-3" />
          <h3 className="text-sm font-semibold text-text mb-2">Deep Evaluation</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
            Run a multi-pass deep evaluation to get code-level findings with specific file locations, severity ratings, and one-click fix plans. Each module is analyzed for structure, quality, and performance.
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}

// ─── Progress Panel ──────────────────────────────────────────────────────────

function ProgressPanel({ progress }: { progress: EvalProgress }) {
  const pct = progress.totalSteps > 0
    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-lg p-4"
    >
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-[#fbbf24]" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text">
              {progress.currentModule
                ? `Evaluating ${MODULE_LABELS[progress.currentModule] ?? progress.currentModule} — ${PASS_LABELS[progress.currentPass!] ?? progress.currentPass}`
                : 'Starting...'}
            </span>
            <span className="text-xs text-text-muted">
              {progress.completedSteps}/{progress.totalSteps} passes ({pct}%)
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#ef4444]"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.22 }}
            />
          </div>
        </div>
      </div>

      {/* Per-module pass status grid */}
      <div className="grid grid-cols-6 gap-1.5 text-2xs">
        {/* Header row */}
        <span className="text-text-muted font-semibold">Module</span>
        {EVAL_PASSES.map((pass) => (
          <span key={pass} className="text-text-muted font-semibold text-center">
            {PASS_LABELS[pass]}
          </span>
        ))}
        <span />
        <span />

        {/* Module rows */}
        {Object.entries(progress.passStatuses).map(([moduleId, passes]) => (
          <ModuleProgressRow key={moduleId} moduleId={moduleId as SubModuleId} passes={passes} />
        ))}
      </div>

      {/* Live finding count */}
      {progress.findings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {progress.findings.length} findings so far
          </span>
        </div>
      )}
    </motion.div>
  );
}

function ModuleProgressRow({
  moduleId,
  passes,
}: {
  moduleId: SubModuleId;
  passes: Record<EvalPass, 'pending' | 'running' | 'done' | 'error' | 'skipped'>;
}) {
  return (
    <>
      <span className="text-text-muted truncate">
        {MODULE_LABELS[moduleId] ?? moduleId}
      </span>
      {EVAL_PASSES.map((pass) => (
        <span key={pass} className="flex items-center justify-center">
          {PASS_STATUS_ICONS[passes[pass] ?? 'pending']}
        </span>
      ))}
      <span />
      <span />
    </>
  );
}

// ─── Module Section ──────────────────────────────────────────────────────────

function ModuleSection({
  module: mod,
  isExpanded,
  expandedCategories,
  onToggleModule,
  onToggleCategory,
  onFix,
  onBatchFix,
  onRunSingle,
  isFixRunning,
}: {
  module: ModuleFindings;
  isExpanded: boolean;
  expandedCategories: Set<string>;
  onToggleModule: () => void;
  onToggleCategory: (key: string) => void;
  onFix: (finding: EvalFinding) => void;
  onBatchFix: () => void;
  onRunSingle: () => void;
  isFixRunning: boolean;
}) {
  const totalFindings = mod.findings.length;
  const hasCritical = mod.bySeverity.critical > 0;
  const hasHigh = mod.bySeverity.high > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Module header */}
      <button
        onClick={onToggleModule}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface bg-surface-deep"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}

        <span className="text-xs font-semibold text-text flex-1">
          {MODULE_LABELS[mod.moduleId] ?? mod.moduleId}
        </span>

        {/* Severity counts */}
        <div className="flex items-center gap-1.5">
          {(Object.entries(mod.bySeverity) as [FindingSeverity, number][])
            .filter(([, count]) => count > 0)
            .map(([sev, count]) => {
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <span
                  key={sev}
                  className="text-2xs font-bold px-1.5 py-0.5 rounded"
                  style={{ color: cfg.color, backgroundColor: cfg.bg }}
                >
                  {count}
                </span>
              );
            })}
        </div>

        <span className="text-xs text-text-muted">{totalFindings} findings</span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {/* Action bar */}
              <div className="flex items-center gap-2 pt-2">
                {(hasCritical || hasHigh) && (
                  <button
                    onClick={onBatchFix}
                    disabled={isFixRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: `${EVAL_ACCENT}12`,
                      color: EVAL_ACCENT,
                      border: `1px solid ${EVAL_ACCENT}25`,
                    }}
                  >
                    <Zap className="w-3 h-3" />
                    Fix Critical/High ({mod.bySeverity.critical + mod.bySeverity.high})
                  </button>
                )}
                <button
                  onClick={onRunSingle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-surface text-text-muted border border-border hover:text-text"
                >
                  <Play className="w-3 h-3" />
                  Re-evaluate
                </button>
              </div>

              {/* Category groups */}
              {Object.entries(mod.byCategory).map(([category, findings]) => {
                const catKey = `${mod.moduleId}::${category}`;
                const isCatExpanded = expandedCategories.has(catKey);

                return (
                  <div key={catKey} className="rounded-md border border-border/50">
                    <button
                      onClick={() => onToggleCategory(catKey)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface"
                    >
                      {isCatExpanded ? (
                        <ChevronDown className="w-3 h-3 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-muted" />
                      )}
                      <span className="text-xs font-medium text-text-muted">{category}</span>
                      <span className="text-2xs text-text-muted">{findings.length}</span>
                    </button>

                    <AnimatePresence>
                      {isCatExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.12 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-2 space-y-1.5">
                            {findings.map((finding) => (
                              <FindingRow
                                key={finding.id}
                                finding={finding}
                                onFix={() => onFix(finding)}
                                isFixRunning={isFixRunning}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Finding Row ─────────────────────────────────────────────────────────────

function FindingRow({
  finding,
  onFix,
  isFixRunning,
}: {
  finding: EvalFinding;
  onFix: () => void;
  isFixRunning: boolean;
}) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  const SeverityIcon = cfg.icon;

  return (
    <div
      className="rounded-md border px-3 py-2.5 transition-colors"
      style={{ backgroundColor: cfg.bg, borderColor: `${cfg.color}15` }}
    >
      <div className="flex items-start gap-2.5">
        <SeverityIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />

        <div className="flex-1 min-w-0">
          {/* Description */}
          <p className="text-xs text-text leading-relaxed mb-1.5">
            {finding.description}
          </p>

          {/* File location */}
          {finding.file && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileCode2 className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-muted font-mono">
                {finding.file}{finding.line ? `:${finding.line}` : ''}
              </span>
            </div>
          )}

          {/* Suggested fix */}
          {finding.suggestedFix && (
            <div className="bg-background/50 rounded px-2.5 py-1.5 mb-2">
              <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold block mb-0.5">
                Suggested Fix
              </span>
              <p className="text-xs text-text-muted-hover leading-relaxed">
                {finding.suggestedFix}
              </p>
            </div>
          )}

          {/* Footer: severity badge, effort, pass, fix button */}
          <div className="flex items-center gap-2">
            <span
              className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}
            >
              {cfg.label}
            </span>
            <span className="text-2xs text-text-muted flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {EFFORT_LABELS[finding.effort] ?? finding.effort}
            </span>
            <span className="text-2xs text-text-muted">
              {PASS_LABELS[finding.pass]}
            </span>

            <button
              onClick={onFix}
              disabled={isFixRunning}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${EVAL_ACCENT}12`,
                color: EVAL_ACCENT,
                border: `1px solid ${EVAL_ACCENT}25`,
              }}
            >
              {isFixRunning ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Zap className="w-2.5 h-2.5" />
              )}
              Fix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
