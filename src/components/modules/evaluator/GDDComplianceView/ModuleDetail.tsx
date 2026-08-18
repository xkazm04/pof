import {
  CheckCircle2, ChevronDown, ChevronRight, Lightbulb, RotateCcw,
} from 'lucide-react';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { ComplianceGap, ModuleCompliance } from '@/types/gdd-compliance';
import {
  severityAccentCard, STATUS_WARNING, STATUS_SUCCESS,
} from '@/lib/chart-colors';
import { SEVERITY_CONFIG, EFFORT_LABELS, DIRECTION_META } from './constants';
import { EvidenceStrip } from './EvidenceStrip';
import { GapSplitIndicator, GapSideCard } from './GapIndicators';

export function ModuleDetail({ module, now, onResolve, onUnresolve }: {
  module: ModuleCompliance;
  /** The report's `generatedAt` — evidence age is measured against the audit. */
  now: string;
  onResolve: (gapId: string) => void;
  onUnresolve: (gapId: string) => void;
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

      {/* The evidence behind this module's number, stated before any gap is read.
          `conformance` is the raw match rate; `score` is that damped by the
          unresolved conformance gaps below — showing both keeps the damping honest. */}
      <div className="rounded-md border border-border bg-surface-deep p-2.5 space-y-1.5">
        <EvidenceStrip evidence={module.evidence} now={now} />
        {module.evidence.measured && (
          <p className="text-2xs text-text-muted">
            Conformance {module.conformance}% of measured rows · score {module.score}% after gap damping
            {module.unknown > 0 && ` · ${module.unknown} row(s) never evaluated`}
          </p>
        )}
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

      {/* Resolved gaps were counted and then hidden, with no way back — a triage
          decision you could neither review nor undo. They are listed and
          re-openable now, and the resolution itself is durable (SQLite). */}
      {resolvedGaps.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <h4 className="text-2xs font-medium text-text-muted">
            Resolved ({resolvedGaps.length})
          </h4>
          {resolvedGaps.map((gap) => (
            <div
              key={gap.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-surface-deep border border-border"
            >
              <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_SUCCESS }} aria-hidden="true" />
              <span className="text-2xs text-text-muted flex-1 truncate line-through">{gap.title}</span>
              <button
                onClick={() => onUnresolve(gap.id)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium border border-border hover:bg-surface-hover transition-colors text-text-muted flex-shrink-0"
              >
                <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
                Re-open
              </button>
            </div>
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
            {/* `ahead` is asked of each side independently — an `unmeasured` gap has
                no side ahead, and the old `!designAhead` fallback would have crowned
                code the winner of a comparison that never happened. */}
            <GapSideCard side="design" state={gap.designState} ahead={meta.ahead === 'design'} />
            <GapSideCard side="code" state={gap.codeState} ahead={meta.ahead === 'code'} />
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
