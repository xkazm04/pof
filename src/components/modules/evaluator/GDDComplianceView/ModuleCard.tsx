import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ModuleCompliance } from '@/types/gdd-compliance';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { scoreColor } from './helpers';
import { CONFIDENCE_META, UNMEASURED_ICON } from './constants';
import { EvidenceStrip } from './EvidenceStrip';

export function ModuleCard({ module, isSelected, onClick }: {
  module: ModuleCompliance;
  isSelected: boolean;
  onClick: () => void;
}) {
  const unresolvedGaps = module.gaps.filter((g) => !g.resolved).length;
  const measured = module.evidence.measured;
  const color = measured ? scoreColor(module.score) : CONFIDENCE_META.none.color;
  const detailId = `gdd-module-detail-${module.moduleId}`;
  const UnmeasuredIcon = UNMEASURED_ICON;

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
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-text truncate">{module.moduleName}</span>
        {measured ? (
          <span className="text-xs font-bold tabular-nums" style={{ color }}>
            {module.score}%
          </span>
        ) : (
          // Never a number here. A module with no verdict on any feature has no
          // conformance score, and printing one (the old 70/100 "neutral") is the
          // exact overclaim this view exists to catch.
          <span
            className="inline-flex items-center gap-1 text-2xs font-semibold tracking-wide flex-shrink-0"
            style={{ color }}
          >
            <UnmeasuredIcon className="w-3 h-3" aria-hidden="true" />
            UNMEASURED
          </span>
        )}
      </div>

      {/* Conformance bar — only drawn when something was measured. A dashed empty
          track stands in otherwise, so "no evidence" never renders as "0% done".
          Deliberately a plain div, not `ui/MeterBar`: the card is a <button>, and
          nesting a role="progressbar" inside it would pollute its accessible name. */}
      {measured ? (
        <div className="w-full h-1 rounded-full bg-border overflow-hidden mb-2" aria-hidden="true">
          <div
            className="h-full rounded-full transition-all duration-slow"
            style={{ width: `${module.score}%`, backgroundColor: color }}
          />
        </div>
      ) : (
        <div className="w-full h-1 rounded-full mb-2 border border-dashed border-border" aria-hidden="true" />
      )}

      <div className="flex items-center gap-3 text-2xs text-text-muted flex-wrap">
        <span>
          {module.implemented + module.improved}/{module.totalFeatures} features
          {module.improved > 0 && <span className="ml-0.5">(+{module.improved} improved)</span>}
        </span>
        <span>{module.checklistDone}/{module.checklistTotal} checklist</span>
        {unresolvedGaps > 0 && (
          <span className="flex items-center gap-0.5" style={{ color: STATUS_WARNING }}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {unresolvedGaps}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <EvidenceStrip evidence={module.evidence} compact />
        {isSelected ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    </button>
  );
}
