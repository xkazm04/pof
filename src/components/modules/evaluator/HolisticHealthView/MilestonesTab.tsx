import { TrendingDown } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ProjectHealthSummary, Milestone, BurnChartPoint } from '@/types/project-health';
import { BurndownChart } from './charts';
import { MilestoneDetailCard } from './MilestoneDetailCard';

export function MilestonesTab({
  burnChart,
  summary,
  milestones,
}: {
  burnChart: BurnChartPoint[];
  summary: ProjectHealthSummary;
  milestones: Milestone[];
}) {
  return (
    <div className="space-y-4">
      {/* Burndown chart */}
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
          Burndown Chart
        </h3>
        <BurndownChart data={burnChart} total={summary.totalChecklistItems} />
      </SurfaceCard>

      {/* Detailed milestone cards */}
      <div className="grid grid-cols-2 gap-3">
        {milestones.map((ms) => (
          <MilestoneDetailCard key={ms.id} milestone={ms} />
        ))}
      </div>
    </div>
  );
}
