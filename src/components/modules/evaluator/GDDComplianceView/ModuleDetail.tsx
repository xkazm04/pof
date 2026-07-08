import {
  CheckCircle2, ChevronDown, ChevronRight, Lightbulb,
} from 'lucide-react';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { ComplianceGap, ModuleCompliance } from '@/types/gdd-compliance';
import {
  severityAccentCard, STATUS_WARNING, STATUS_SUCCESS,
} from '@/lib/chart-colors';
import { SEVERITY_CONFIG, EFFORT_LABELS, DIRECTION_META } from './constants';
import { GapSplitIndicator, GapSideCard } from './GapIndicators';

export function ModuleDetail({ module, onResolve }: {
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
