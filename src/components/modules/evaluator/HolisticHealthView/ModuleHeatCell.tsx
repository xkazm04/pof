import { Badge } from '@/components/ui/Badge';
import type { ModuleHealthSummary } from '@/types/project-health';
import { STATUS_COLORS, STATUS_BADGE } from './constants';

export function ModuleHeatCell({ module: m }: { module: ModuleHealthSummary }) {
  return (
    <div
      className="rounded-lg border p-2.5 transition-all hover:ring-1"
      style={{
        borderColor: `${STATUS_COLORS[m.status]}30`,
        backgroundColor: `${STATUS_COLORS[m.status]}08`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs font-medium text-text truncate">{m.label}</span>
        <Badge variant={STATUS_BADGE[m.status]}>{m.status === 'not-started' ? 'N/A' : `${m.healthScore}`}</Badge>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${m.checklistCompletion}%`,
            backgroundColor: STATUS_COLORS[m.status],
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-text-muted">{m.checklistCompletion}% done</span>
        {m.issueCount > 0 && <span className="text-xs text-amber-400">{m.issueCount} issues</span>}
      </div>
    </div>
  );
}
