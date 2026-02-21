'use client';

import { useEffect } from 'react';
import {
  ShieldCheck, AlertTriangle, AlertCircle, Info, CheckCircle2,
  RefreshCw, Loader2, ChevronDown, ChevronRight, Lightbulb,
  ArrowUpRight, ArrowDownRight, X,
} from 'lucide-react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import { useModuleStore } from '@/stores/moduleStore';
import type { ComplianceGap, ModuleCompliance, GapSeverity, ReconciliationSuggestion } from '@/types/gdd-compliance';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useState } from 'react';

const SEVERITY_CONFIG: Record<GapSeverity, { icon: typeof AlertTriangle; color: string; label: string }> = {
  critical: { icon: AlertCircle, color: MODULE_COLORS.evaluator, label: 'Critical' },
  major: { icon: AlertTriangle, color: MODULE_COLORS.content, label: 'Major' },
  minor: { icon: Info, color: MODULE_COLORS.core, label: 'Minor' },
  info: { icon: Info, color: 'var(--text-muted)', label: 'Info' },
};

const EFFORT_LABELS: Record<string, string> = {
  trivial: '< 1h',
  small: '1-4h',
  medium: '1-3 days',
  large: '1+ week',
};

function scoreColor(score: number): string {
  if (score >= 80) return MODULE_COLORS.setup;
  if (score >= 60) return MODULE_COLORS.content;
  return MODULE_COLORS.evaluator;
}

export function GDDComplianceView() {
  const report = useGDDComplianceStore((s) => s.report);
  const modules = useGDDComplianceStore((s) => s.modules);
  const suggestions = useGDDComplianceStore((s) => s.suggestions);
  const isAuditing = useGDDComplianceStore((s) => s.isAuditing);
  const error = useGDDComplianceStore((s) => s.error);
  const runAudit = useGDDComplianceStore((s) => s.runAudit);
  const selectedModuleId = useGDDComplianceStore((s) => s.selectedModuleId);
  const selectModule = useGDDComplianceStore((s) => s.selectModule);
  const resolveGap = useGDDComplianceStore((s) => s.resolveGap);
  const checklistProgress = useModuleStore((s) => s.checklistProgress);

  const handleAudit = () => runAudit(checklistProgress);

  // Auto-run audit on mount if no report
  useEffect(() => {
    if (!report && !isAuditing) handleAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!report && isAuditing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#ef4444] animate-spin" />
          <span className="text-xs text-text-muted">Running compliance audit...</span>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-6 h-6 text-[#ef4444]" />
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={handleAudit} className="text-xs text-[#ef4444] hover:underline">
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

  return (
    <div className="space-y-6">
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing score={report.overallScore} size={56} />
          <div>
            <h2 className="text-sm font-semibold text-text">GDD Compliance</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {report.totalGaps} gap{report.totalGaps !== 1 ? 's' : ''} detected
              {report.criticalGaps > 0 && (
                <span className="text-red-400 ml-1">
                  ({report.criticalGaps} critical)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleAudit}
          disabled={isAuditing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-red-subtle text-[#ef4444] border border-status-red-strong hover:bg-status-red-medium transition-colors disabled:opacity-50"
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
            onClick={() => selectModule(mod.moduleId === selectedModuleId ? null : mod.moduleId)}
          />
        ))}
      </div>

      {/* Selected module detail */}
      {selectedModule && (
        <ModuleDetail module={selectedModule} onResolve={resolveGap} />
      )}

      {/* Reconciliation suggestions */}
      {suggestions.length > 0 && (
        <SuggestionsPanel suggestions={suggestions} />
      )}

      <p className="text-2xs text-text-muted text-center">
        Last audit: {new Date(report.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score, size }: { score: number; size: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-slow"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Module Card ────────────────────────────────────────────────────────────

function ModuleCard({ module, isSelected, onClick }: {
  module: ModuleCompliance;
  isSelected: boolean;
  onClick: () => void;
}) {
  const unresolvedGaps = module.gaps.filter((g) => !g.resolved).length;
  const color = scoreColor(module.score);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'border-[#ef4444] bg-status-red-subtle'
          : 'border-border bg-surface hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text truncate">{module.moduleName}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {module.score}%
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="w-full h-1 rounded-full bg-border overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-slow"
          style={{ width: `${module.score}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex items-center gap-3 text-2xs text-text-muted">
        <span>{module.implemented}/{module.totalFeatures} features</span>
        <span>{module.checklistDone}/{module.checklistTotal} checklist</span>
        {unresolvedGaps > 0 && (
          <span className="text-[#f59e0b] flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            {unresolvedGaps}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end mt-1">
        {isSelected ? (
          <ChevronDown className="w-3 h-3 text-text-muted" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted" />
        )}
      </div>
    </button>
  );
}

// ─── Module Detail ──────────────────────────────────────────────────────────

function ModuleDetail({ module, onResolve }: {
  module: ModuleCompliance;
  onResolve: (gapId: string) => void;
}) {
  const unresolvedGaps = module.gaps.filter((g) => !g.resolved);
  const resolvedGaps = module.gaps.filter((g) => g.resolved);

  return (
    <div className="border border-border rounded-lg bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{module.moduleName} Gaps</h3>
        <span className="text-2xs text-text-muted">
          {unresolvedGaps.length} open · {resolvedGaps.length} resolved
        </span>
      </div>

      {unresolvedGaps.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-xs text-[#00ff88]">
          <CheckCircle2 className="w-4 h-4" />
          No compliance gaps
        </div>
      ) : (
        <div className="space-y-2">
          {unresolvedGaps.map((gap) => (
            <GapRow key={gap.id} gap={gap} onResolve={() => onResolve(gap.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gap Row ────────────────────────────────────────────────────────────────

function GapRow({ gap, onResolve }: { gap: ComplianceGap; onResolve: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[gap.severity];
  const SeverityIcon = config.icon;
  const DirectionIcon = gap.direction === 'design-ahead' ? ArrowDownRight : ArrowUpRight;
  const directionLabel = gap.direction === 'design-ahead' ? 'Design ahead of code' : 'Code ahead of design';

  return (
    <div className="border border-border rounded-md bg-surface-deep">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <SeverityIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: config.color }} />
        <span className="text-xs text-text flex-1 truncate">{gap.title}</span>
        <span className="text-2xs text-text-muted flex-shrink-0 flex items-center gap-1">
          <DirectionIcon className="w-2.5 h-2.5" />
          {directionLabel}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <p className="text-xs text-text-muted">{gap.description}</p>

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <div className="p-2 rounded bg-surface border border-border">
              <span className="text-text-muted">Design says:</span>
              <p className="text-text mt-0.5">{gap.designState}</p>
            </div>
            <div className="p-2 rounded bg-surface border border-border">
              <span className="text-text-muted">Code says:</span>
              <p className="text-text mt-0.5">{gap.codeState}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-medium"
                style={{
                  color: config.color,
                  backgroundColor: `${config.color}14`,
                  border: `1px solid ${config.color}38`,
                }}
              >
                {config.label}
              </span>
              <span>Effort: {EFFORT_LABELS[gap.effort] ?? gap.effort}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xs text-text-muted italic max-w-[200px] truncate" title={gap.suggestion}>
                {gap.suggestion}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onResolve(); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-[#00ff88] bg-accent-subtle border border-accent-strong hover:bg-accent-medium transition-colors"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggestions Panel ──────────────────────────────────────────────────────

function SuggestionsPanel({ suggestions }: { suggestions: ReconciliationSuggestion[] }) {
  const [collapsed, setCollapsed] = useState(false);

  const typeConfig: Record<string, { color: string; label: string }> = {
    'update-gdd': { color: MODULE_COLORS.core, label: 'Update GDD' },
    'implement-feature': { color: MODULE_COLORS.content, label: 'Implement' },
    'remove-stale': { color: MODULE_COLORS.evaluator, label: 'Remove' },
  };

  return (
    <div className="border border-border rounded-lg bg-surface">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Lightbulb className="w-4 h-4 text-[#f59e0b]" />
        <span className="text-xs font-semibold text-text flex-1">
          Reconciliation Suggestions ({suggestions.length})
        </span>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          {suggestions.map((sug, i) => {
            const cfg = typeConfig[sug.type] ?? { color: 'var(--text-muted)', label: sug.type };
            return (
              <div
                key={sug.id}
                className={`flex items-start gap-3 px-4 py-2.5 ${
                  i < suggestions.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="text-2xs text-text-muted mt-0.5 tabular-nums w-4 text-right flex-shrink-0">
                  #{sug.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">{sug.title}</span>
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{
                        color: cfg.color,
                        backgroundColor: `${cfg.color}14`,
                        border: `1px solid ${cfg.color}38`,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">{sug.description}</p>
                </div>
                <span className="text-2xs text-text-muted flex-shrink-0 mt-0.5">
                  {EFFORT_LABELS[sug.effort] ?? sug.effort}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
