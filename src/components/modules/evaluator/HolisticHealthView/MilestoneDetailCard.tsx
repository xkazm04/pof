import { Target, CheckCircle2, Clock } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { Milestone } from '@/types/project-health';
import { milestoneProgressDisplay } from '@/lib/roadmap/milestone-progress';

export function MilestoneDetailCard({ milestone: ms }: { milestone: Milestone }) {
  const isAchieved = ms.predictedWeeks !== null && ms.predictedWeeks === 0;
  // Unmeasured progress renders as words, not as a bar at 0 — see
  // `@/lib/roadmap/milestone-progress`.
  const progress = milestoneProgressDisplay(ms.currentProgress, ms.progressNote);
  return (
    <SurfaceCard level={2}>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ms.color}15` }}>
          {isAchieved ? (
            <CheckCircle2 className="w-4 h-4" style={{ color: ms.color }} />
          ) : (
            <Target className="w-4 h-4" style={{ color: ms.color }} />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-text">{ms.name}</p>
          <p className="text-2xs text-text-muted mt-0.5">{ms.targetCompletion}% completion target</p>
          {progress.measured ? (
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mt-2">
              <div
                data-testid="milestone-progress-bar"
                className="h-full rounded-full transition-all"
                style={{ width: `${progress.pct}%`, backgroundColor: ms.color }}
              />
            </div>
          ) : progress.note ? (
            <p className="text-2xs text-text-muted mt-2 leading-snug">{progress.note}</p>
          ) : null}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-2xs text-text-muted">
              {progress.measured ? `${progress.pct}% progress` : progress.label}
            </span>
            {ms.predictedWeeks !== null && ms.predictedWeeks > 0 && (
              <span className="text-2xs font-medium flex items-center gap-0.5" style={{ color: ms.color }}>
                <Clock className="w-3 h-3" />
                {ms.predictedWeeks} weeks
              </span>
            )}
            {isAchieved && (
              <Badge variant="success">Achieved</Badge>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
