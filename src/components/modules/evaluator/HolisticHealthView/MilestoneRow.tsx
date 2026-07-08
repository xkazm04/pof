import { Badge } from '@/components/ui/Badge';
import type { Milestone } from '@/types/project-health';

export function MilestoneRow({ milestone: ms }: { milestone: Milestone }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ms.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text">{ms.name}</span>
          <Badge variant={ms.currentProgress >= 100 ? 'success' : 'default'}>
            {ms.currentProgress >= 100 ? 'Done' : `${ms.currentProgress}%`}
          </Badge>
        </div>
        <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, ms.currentProgress)}%`, backgroundColor: ms.color }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        {ms.predictedWeeks !== null ? (
          ms.predictedWeeks === 0 ? (
            <span className="text-2xs text-emerald-400">Achieved</span>
          ) : (
            <div>
              <span className="text-xs font-medium text-text">{ms.predictedWeeks}w</span>
              <p className="text-xs text-text-muted">
                {ms.predictedDate ? new Date(ms.predictedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </p>
            </div>
          )
        ) : (
          <span className="text-2xs text-text-muted">—</span>
        )}
      </div>
    </div>
  );
}
