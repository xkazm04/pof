'use client';

import { useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  RefreshCw, Loader2, ChevronDown, ChevronRight, Lightbulb,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useGDDComplianceStore } from '@/stores/gddComplianceStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { ComplianceGap, ModuleCompliance, GapSeverity, GapDirection, ReconciliationSuggestion } from '@/types/gdd-compliance';
import {
  MODULE_COLORS, SEVERITY_TOKENS, scoreBandToken, severityAccentCard,
  STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS, ACCENT_VIOLET, ACCENT_CYAN_LIGHT,
  statusBg, statusBorder, type SeverityToken,
} from '@/lib/chart-colors';

// Gap severities use the shared SEVERITY_TOKENS map so a critical gap matches a
// critical finding in Deep Eval / the Archeologist (major→high, minor→low).
const SEVERITY_CONFIG: Record<GapSeverity, SeverityToken & { icon: typeof AlertTriangle; label: string }> = {
  critical: { icon: AlertCircle, label: 'Critical', ...SEVERITY_TOKENS.critical },
  major: { icon: AlertTriangle, label: 'Major', ...SEVERITY_TOKENS.major },
  minor: { icon: Info, label: 'Minor', ...SEVERITY_TOKENS.minor },
  info: { icon: Info, label: 'Info', ...SEVERITY_TOKENS.info },
};

const EFFORT_LABELS: Record<string, string> = {
  trivial: '< 1h',
  small: '1-4h',
  medium: '1-3 days',
  large: '1+ week',
};

/** Compliance score → shared score-band color (green / amber / orange / red). */
function scoreColor(score: number): string {
  return scoreBandToken(score).color;
}

// ── Design-vs-code split visual language ─────────────────────────────────────
//
// Every gap has two sides — what the GDD (design) specifies vs. what the code
// implements — and a *lean* showing which side is ahead. Each side gets one fixed
// semantic color: violet = design / intent, cyan = code / implementation. Both are
// drawn from *outside* the severity ramp (red/orange/amber/blue) so a split never
// reads as a severity. The same `GapSplitIndicator` + side colors are reused on the
// collapsed row and the expanded panel (incl. the Design says / Code says cards), so
// the directional metaphor repeats and every gap is legible at a glance.

type GapSide = 'design' | 'code';

const SIDE: Record<GapSide, { color: string; label: string }> = {
  design: { color: ACCENT_VIOLET, label: 'Design' },
  code: { color: ACCENT_CYAN_LIGHT, label: 'Code' },
};

const DIRECTION_META: Record<GapDirection, {
  ahead: GapSide;
  short: string;
  /** Full sentence — drives the indicator's aria-label + the panel banner. */
  label: string;
  /** Plain-language consequence, for non-technical triage. */
  consequence: string;
}> = {
  'design-ahead': {
    ahead: 'design',
    short: 'Design ahead',
    label: 'Design is ahead of code',
    consequence: 'The design specifies more than the code implements — code needs to catch up.',
  },
  'code-ahead': {
    ahead: 'code',
    short: 'Code ahead',
    label: 'Code is ahead of design',
    consequence: 'The code implements more than the design documents — update the GDD to match.',
  },
};

/**
 * Two-sided gap indicator. A Design▕Code split bar whose fuller, brighter half is
 * the side that's ahead, with a double-chevron leaning toward it. `variant='full'`
 * adds the Design / Code end labels (expanded-panel header); the compact variant is
 * row-sized. Carries a directional `aria-label` so the lean is not color-only.
 */
function GapSplitIndicator({ direction, variant = 'compact' }: {
  direction: GapDirection;
  variant?: 'compact' | 'full';
}) {
  const meta = DIRECTION_META[direction];
  const designAhead = meta.ahead === 'design';
  const designPct = designAhead ? 66 : 34;
  const aheadColor = SIDE[meta.ahead].color;
  const Lean = designAhead ? ChevronsLeft : ChevronsRight;
  const full = variant === 'full';

  return (
    <span
      className={`inline-flex items-center ${full ? 'gap-2' : 'gap-1.5'}`}
      role="img"
      aria-label={meta.label}
    >
      {full && (
        <span
          className="text-2xs font-medium"
          style={{ color: SIDE.design.color, opacity: designAhead ? 1 : 0.55 }}
        >
          {SIDE.design.label}
        </span>
      )}
      <span
        className={`relative ${full ? 'w-24' : 'w-12'} h-1.5 rounded-full overflow-hidden flex bg-surface`}
        aria-hidden="true"
      >
        <span
          className="h-full transition-all duration-slow"
          style={{ width: `${designPct}%`, backgroundColor: SIDE.design.color }}
        />
        <span
          className="h-full transition-all duration-slow"
          style={{ width: `${100 - designPct}%`, backgroundColor: SIDE.code.color }}
        />
      </span>
      {full && (
        <span
          className="text-2xs font-medium"
          style={{ color: SIDE.code.color, opacity: designAhead ? 0.55 : 1 }}
        >
          {SIDE.code.label}
        </span>
      )}
      {!full && (
        <span
          className="inline-flex items-center text-2xs font-medium flex-shrink-0"
          style={{ color: aheadColor }}
        >
          <Lean className="w-3 h-3" aria-hidden="true" />
          {meta.short}
        </span>
      )}
    </span>
  );
}

/** One side of the gap — the "Design says" / "Code says" card, tinted to its side color. */
function GapSideCard({ side, state, ahead }: { side: GapSide; state: string; ahead: boolean }) {
  const { color, label } = SIDE[side];
  return (
    <div
      className="p-2 rounded border bg-surface border-l-2"
      style={{ borderColor: ahead ? statusBorder(color) : 'var(--border)', borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="inline-flex items-center gap-1 font-medium" style={{ color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          {label} says
        </span>
        {ahead && (
          <span
            className="text-2xs px-1 py-px rounded font-medium flex-shrink-0"
            style={{ color, backgroundColor: statusBg(color), border: `1px solid ${statusBorder(color)}` }}
          >
            Ahead
          </span>
        )}
      </div>
      <p className="text-text mt-0.5">{state}</p>
    </div>
  );
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
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: STATUS_ERROR }} />
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
                <span className="ml-1" style={{ color: SEVERITY_TOKENS.critical.color }}>
                  ({report.criticalGaps} critical)
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleAudit}
          disabled={isAuditing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-red-subtle border border-status-red-strong hover:bg-status-red-medium transition-colors disabled:opacity-50"
          style={{ color: STATUS_ERROR }}
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
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Compliance score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
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
  const detailId = `gdd-module-detail-${module.moduleId}`;

  return (
    <button
      onClick={onClick}
      aria-expanded={isSelected}
      aria-controls={isSelected ? detailId : undefined}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-status-red-subtle'
          : 'border-border bg-surface hover:bg-surface-hover'
      }`}
      style={isSelected ? { borderColor: STATUS_ERROR } : undefined}
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
          <span className="flex items-center gap-0.5" style={{ color: STATUS_WARNING }}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {unresolvedGaps}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end mt-1">
        {isSelected ? (
          <ChevronDown className="w-3 h-3 text-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted" aria-hidden="true" />
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
    <div id={`gdd-module-detail-${module.moduleId}`} className="border border-border rounded-lg bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{module.moduleName} Gaps</h3>
        <span className="text-2xs text-text-muted">
          {unresolvedGaps.length} open · {resolvedGaps.length} resolved
        </span>
      </div>

      {unresolvedGaps.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: STATUS_SUCCESS }}>
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
  const { open, toggle, buttonProps, panelProps } = useDisclosure(false);
  const config = SEVERITY_CONFIG[gap.severity];
  const SeverityIcon = config.icon;
  const meta = DIRECTION_META[gap.direction];
  const designAhead = meta.ahead === 'design';

  return (
    <div
      className="border border-border border-l-[3px] rounded-md bg-surface-deep"
      style={severityAccentCard(config)}
    >
      <button
        onClick={toggle}
        {...buttonProps}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <SeverityIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: config.color }} aria-hidden="true" />
        <span className="text-xs text-text flex-1 truncate">{gap.title}</span>
        <GapSplitIndicator direction={gap.direction} />
        {open ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div {...panelProps} className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          {/* Direction banner — the same split language, full-size, with a plain-language consequence. */}
          <div className="flex items-center gap-2 flex-wrap">
            <GapSplitIndicator direction={gap.direction} variant="full" />
            <span className="text-2xs text-text-muted flex-1 min-w-[12rem]">{meta.consequence}</span>
          </div>

          <p className="text-xs text-text-muted">{gap.description}</p>

          <div className="grid grid-cols-2 gap-2 text-2xs">
            <GapSideCard side="design" state={gap.designState} ahead={designAhead} />
            <GapSideCard side="code" state={gap.codeState} ahead={!designAhead} />
          </div>

          {/* Suggestion gets its own full-width line — never truncated behind a tooltip. */}
          <div className="flex items-start gap-1.5 p-2 rounded bg-surface border border-border">
            <Lightbulb className="w-3 h-3 flex-shrink-0 mt-px" style={{ color: STATUS_WARNING }} aria-hidden="true" />
            <p className="text-2xs text-text-muted italic flex-1">{gap.suggestion}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <span
                className="px-1.5 py-0.5 rounded text-2xs font-medium"
                style={{
                  color: config.color,
                  backgroundColor: config.bg,
                  border: `1px solid ${config.border}`,
                }}
              >
                {config.label}
              </span>
              <span>Effort: {EFFORT_LABELS[gap.effort] ?? gap.effort}</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onResolve(); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium bg-accent-subtle border border-accent-strong hover:bg-accent-medium transition-colors"
              style={{ color: STATUS_SUCCESS }}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              Resolve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggestions Panel ──────────────────────────────────────────────────────

function SuggestionsPanel({ suggestions }: { suggestions: ReconciliationSuggestion[] }) {
  const { open, toggle, buttonProps, panelProps } = useDisclosure(true);

  const typeConfig: Record<string, { color: string; label: string }> = {
    'update-gdd': { color: MODULE_COLORS.core, label: 'Update GDD' },
    'implement-feature': { color: MODULE_COLORS.content, label: 'Implement' },
  };

  return (
    <div className="border border-border rounded-lg bg-surface">
      <button
        onClick={toggle}
        {...buttonProps}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Lightbulb className="w-4 h-4" style={{ color: STATUS_WARNING }} aria-hidden="true" />
        <span className="text-xs font-semibold text-text flex-1">
          Reconciliation Suggestions ({suggestions.length})
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div {...panelProps} className="border-t border-border">
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
