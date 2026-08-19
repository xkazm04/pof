import { Check, ScanSearch } from 'lucide-react';
import type { DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import type { EvalFinding, FindingSeverity, ScanFindings, ModuleFindings } from '@/lib/evaluator/finding-collector';
import type { RegressionDiff } from '@/lib/evaluator/regression-diff';
import type { AttributionMap } from '@/lib/evaluator/git-attribution';
import type { SubModuleId } from '@/types/modules';
import { formatDuration } from '@/lib/format';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { RegressionBanner } from '../RegressionBanner';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_INFO, statusBg, statusBorder } from '@/lib/chart-colors';
import { EVAL_ACCENT, SEVERITY_CONFIG } from './constants';
import { ModuleSection } from './ModuleSection';

export function ResultsSection({
  result,
  diff,
  view,
  setView,
  attribution,
  expandedModules,
  expandedCategories,
  taggingActive,
  discardedBaselineProject,
  activeFindings,
  toggleModule,
  toggleCategory,
  onFix,
  onBatchFix,
  onRunSingle,
  isFixRunning,
  fixTargetId,
}: {
  result: DeepEvalResult;
  diff: RegressionDiff | null;
  view: 'new' | 'all';
  setView: (view: 'new' | 'all') => void;
  attribution: AttributionMap;
  expandedModules: Set<string>;
  expandedCategories: Set<string>;
  taggingActive: boolean;
  /** The project a cached baseline belonged to when it was discarded as cross-project. */
  discardedBaselineProject: string | null;
  activeFindings: ScanFindings | null;
  toggleModule: (moduleId: SubModuleId) => void;
  toggleCategory: (key: string) => void;
  onFix: (finding: EvalFinding) => void;
  onBatchFix: (moduleFindings: ModuleFindings) => void;
  onRunSingle: (moduleId: SubModuleId) => void;
  isFixRunning: boolean;
  /** The finding id or `module:<id>` currently being fixed, or null. */
  fixTargetId: string | null;
}) {
  return (
    <div data-testid="pof-module-evaluator-result-summary" className="space-y-4">
      {/* Regression summary banner — what changed since the last scan */}
      {diff && (
        <RegressionBanner
          diff={diff}
          view={view}
          onViewChange={setView}
          totalFindings={result.findings.totalFindings}
        />
      )}

      {/* The cached baseline described another project — say so, rather than letting
          "no baseline yet" read as "this project was never scanned". */}
      {discardedBaselineProject !== null && (
        <div
          data-testid="pof-baseline-project-mismatch"
          className="px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: statusBg(STATUS_WARNING, 0.05), border: `1px solid ${statusBorder(STATUS_WARNING, 0.20)}`, color: STATUS_WARNING }}
        >
          The stored regression baseline belongs to another project
          {discardedBaselineProject ? ` (${discardedBaselineProject})` : ''} — it was discarded rather than
          diffed against this scan. This scan is the new baseline for the current project.
        </div>
      )}

      {/* Summary bar */}
      <SurfaceCard className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-4 h-4" style={{ color: EVAL_ACCENT }} />
            <span data-testid="pof-module-evaluator-result-findings-count" className="text-xs font-semibold text-text">
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

      {/* Failed modules: their findings are incomplete and were excluded from the baseline merge */}
      {result.failedModules.length > 0 && (
        <div
          className="px-3 py-2 rounded-lg text-xs"
          style={{ backgroundColor: statusBg(STATUS_WARNING, 0.05), border: `1px solid ${statusBorder(STATUS_WARNING, 0.20)}`, color: STATUS_WARNING }}
        >
          {result.failedModules.length} module{result.failedModules.length !== 1 ? 's' : ''} failed to evaluate
          ({result.failedModules.join(', ')}) — excluded from the regression baseline; re-run them to refresh their findings.
        </div>
      )}

      {/* Module tree (filtered to the active New/All view) */}
      <div className="space-y-2">
        {(activeFindings?.modules ?? []).map((mod) => (
          <ModuleSection
            key={mod.moduleId}
            module={mod}
            isExpanded={expandedModules.has(mod.moduleId)}
            expandedCategories={expandedCategories}
            statusById={diff?.statusById}
            attribution={attribution}
            taggingActive={taggingActive}
            onToggleModule={() => toggleModule(mod.moduleId)}
            onToggleCategory={toggleCategory}
            onFix={onFix}
            onBatchFix={() => onBatchFix(mod)}
            onRunSingle={() => onRunSingle(mod.moduleId)}
            isFixRunning={isFixRunning}
            fixTargetId={fixTargetId}
          />
        ))}
      </div>

      {/* Empty: there are findings overall, but none new since last scan */}
      {activeFindings?.totalFindings === 0 && view === 'new' && diff?.hasPrevious && result.findings.totalFindings > 0 && (
        <div className="bg-surface border rounded-lg p-8 text-center" style={{ borderColor: statusBorder(STATUS_SUCCESS, 0.12) }}>
          <Check className="w-8 h-8 mx-auto mb-3" style={{ color: STATUS_SUCCESS }} />
          <h3 className="text-sm font-semibold text-text mb-1">No New Issues</h3>
          <p className="text-xs text-text-muted">
            No regressions since the last scan.{' '}
            <button onClick={() => setView('all')} className="underline hover:brightness-125" style={{ color: STATUS_INFO }}>
              View all {result.findings.totalFindings} findings
            </button>
          </p>
        </div>
      )}

      {/* Empty: the whole scan found nothing */}
      {result.findings.totalFindings === 0 && (
        <div className="bg-surface border rounded-lg p-8 text-center" style={{ borderColor: statusBorder(STATUS_SUCCESS, 0.12) }}>
          <Check className="w-8 h-8 mx-auto mb-3" style={{ color: STATUS_SUCCESS }} />
          <h3 className="text-sm font-semibold text-text mb-1">No Issues Found</h3>
          <p className="text-xs text-text-muted">
            All evaluated modules passed the deep analysis checks.
          </p>
        </div>
      )}
    </div>
  );
}
