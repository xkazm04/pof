'use client';

import { useEffect } from 'react';
import {
  AlertCircle, RefreshCw, Loader2,
} from 'lucide-react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { SEVERITY_TOKENS, STATUS_ERROR, ACCENT_VIOLET } from '@/lib/chart-colors';
import { evidenceAge } from '@/types/gdd-compliance';
import { CONFIDENCE_META, FRESHNESS_META } from './constants';
import { EvidenceStrip, freshnessSentence } from './EvidenceStrip';
import { ScoreRing } from './ScoreRing';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';
import { SuggestionsPanel } from './SuggestionsPanel';

export function GDDComplianceView() {
  const report = useGDDComplianceStore((s) => s.report);
  const modules = useGDDComplianceStore((s) => s.modules);
  const suggestions = useGDDComplianceStore((s) => s.suggestions);
  const isAuditing = useGDDComplianceStore((s) => s.isAuditing);
  const error = useGDDComplianceStore((s) => s.error);
  const runAudit = useGDDComplianceStore((s) => s.runAudit);
  const ensureAudit = useGDDComplianceStore((s) => s.ensureAudit);
  const selectedModuleId = useGDDComplianceStore((s) => s.selectedModuleId);
  const selectModule = useGDDComplianceStore((s) => s.selectModule);
  const resolveGap = useGDDComplianceStore((s) => s.resolveGap);
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const projectPath = useProjectStore((s) => s.projectPath);

  const handleAudit = () => runAudit(checklistProgress, projectPath);

  // Audit when the project or checklist snapshot changes — never show a stale
  // report from a previously-selected project, and refresh once the new
  // project's checklist hydrates. ensureAudit no-ops when nothing changed.
  useEffect(() => {
    ensureAudit(checklistProgress, projectPath);
  }, [projectPath, checklistProgress, ensureAudit]);

  if (!report && isAuditing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT_VIOLET }} />
          <span className="text-xs text-text-muted">Running compliance audit...</span>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-6 h-6" style={{ color: STATUS_ERROR }} />
          <span className="text-xs" style={{ color: STATUS_ERROR }}>{error}</span>
          <button onClick={handleAudit} className="text-xs hover:underline" style={{ color: STATUS_ERROR }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const selectedModule = selectedModuleId
    ? modules.find((m) => m.moduleId === selectedModuleId)
    : null;
  const unmeasuredModules = report.modulesTotal - report.modulesMeasured;
  const overallAge = evidenceAge(report.evidence, report.generatedAt);

  return (
    <div className="space-y-6">
      {/* Header with score. The ring reports conformance over the MEASURED surface
          only; the evidence strip below it says how much of the project that is, so
          the two halves of the old conflated number are never read as one. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <ScoreRing
            score={report.overallScore}
            size={56}
            measured={report.evidence.measured}
          />
          <div className="flex-1 min-w-0 space-y-1.5">
            <h2 className="text-sm font-semibold text-text">
              GDD Compliance
              <span className="ml-2 text-2xs font-normal text-text-muted">
                {report.evidence.measured
                  ? 'conformance of what was measured'
                  : 'nothing has been measured yet'}
              </span>
            </h2>
            <p className="text-xs text-text-muted">
              {report.totalGaps} gap{report.totalGaps !== 1 ? 's' : ''} detected
              {report.criticalGaps > 0 && (
                <span className="ml-1" style={{ color: SEVERITY_TOKENS.critical.color }}>
                  ({report.criticalGaps} critical)
                </span>
              )}
              {unmeasuredModules > 0 && (
                <span className="ml-1" style={{ color: CONFIDENCE_META.none.color }}>
                  · {unmeasuredModules} of {report.modulesTotal} module
                  {report.modulesTotal !== 1 ? 's' : ''} unmeasured
                </span>
              )}
            </p>
            <EvidenceStrip evidence={report.evidence} now={report.generatedAt} />
          </div>
        </div>
        <button
          onClick={handleAudit}
          disabled={isAuditing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: `${ACCENT_VIOLET}15`, border: `1px solid ${ACCENT_VIOLET}30`, color: ACCENT_VIOLET }}
        >
          {isAuditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Re-audit
        </button>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 gap-2">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.moduleId}
            module={mod}
            isSelected={mod.moduleId === selectedModuleId}
            now={report.generatedAt}
            onClick={() => selectModule(mod.moduleId === selectedModuleId ? null : mod.moduleId)}
          />
        ))}
      </div>

      {/* Selected module detail */}
      {selectedModule && (
        <ModuleDetail module={selectedModule} now={report.generatedAt} onResolve={resolveGap} />
      )}

      {/* Reconciliation suggestions */}
      {suggestions.length > 0 && (
        <SuggestionsPanel suggestions={suggestions} />
      )}

      {/* Audit time and evidence age are two different facts and are printed as two.
          "Last audit" is regenerated on every button press, so on its own it made
          months-old feature verdicts read as freshly established truth. */}
      <div className="text-2xs text-text-muted text-center space-y-0.5">
        <p>Audit ran: {new Date(report.generatedAt).toLocaleString()}</p>
        <p style={{ color: FRESHNESS_META[overallAge.state].color }}>
          {FRESHNESS_META[overallAge.state].label} — {freshnessSentence(overallAge)}
        </p>
      </div>
    </div>
  );
}
