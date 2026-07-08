import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { ModuleCompliance } from '@/types/gdd-compliance';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import { scoreColor } from './helpers';

export function ModuleCard({ module, isSelected, onClick }: {
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
