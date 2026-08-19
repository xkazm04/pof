'use client';

import { BarChart3, Play, ScanSearch, Square } from 'lucide-react';
import { getEvaluableModuleIds } from '@/lib/evaluator/module-eval-prompts';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';
import { ProgressPanel } from './ProgressPanel';
import { ModuleSelectorPanel } from './ModuleSelectorPanel';
import { ResultsSection } from './ResultsSection';
import { useDeepEvalResults } from './useDeepEvalResults';

// ─── Component ───────────────────────────────────────────────────────────────

export function DeepEvalResults() {
  const {
    progress,
    result,
    diff,
    view,
    setView,
    attribution,
    expandedModules,
    expandedCategories,
    selectedModuleIds,
    setSelectedModuleIds,
    showModuleSelector,
    setShowModuleSelector,
    fixCli,
    fixTargetId,
    isRunning,
    handleRunEval,
    handleRunSingle,
    handleCancel,
    handleFix,
    handleBatchFix,
    toggleModule,
    toggleCategory,
    toggleSelectedModule,
    activeFindings,
    taggingActive,
    discardedBaselineProject,
  } = useDeepEvalResults();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Control bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ScanSearch className="w-4 h-4" style={{ color: EVAL_ACCENT }} />
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-125"
              style={{
                backgroundColor: SEVERITY_TOKENS.critical.bg,
                color: SEVERITY_TOKENS.critical.color,
                border: `1px solid ${SEVERITY_TOKENS.critical.border}`,
              }}
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              data-testid="pof-module-evaluator-run-btn"
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
      <ModuleSelectorPanel
        showModuleSelector={showModuleSelector}
        selectedModuleIds={selectedModuleIds}
        setSelectedModuleIds={setSelectedModuleIds}
        toggleSelectedModule={toggleSelectedModule}
      />

      {/* ── Progress panel ────────────────────────────────────────────────── */}
      {progress && isRunning && (
        <ProgressPanel progress={progress} />
      )}

      {/* ── Results summary ───────────────────────────────────────────────── */}
      {result && (
        <ResultsSection
          result={result}
          diff={diff}
          view={view}
          setView={setView}
          attribution={attribution}
          expandedModules={expandedModules}
          expandedCategories={expandedCategories}
          taggingActive={taggingActive}
          discardedBaselineProject={discardedBaselineProject}
          activeFindings={activeFindings}
          toggleModule={toggleModule}
          toggleCategory={toggleCategory}
          onFix={handleFix}
          onBatchFix={handleBatchFix}
          onRunSingle={handleRunSingle}
          isFixRunning={fixCli.isRunning}
          fixTargetId={fixTargetId}
        />
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
