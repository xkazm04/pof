import { BarChart3, TrendingUp } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ProjectHealthSummary, VelocityPoint, BurnChartPoint } from '@/types/project-health';
import { STATUS_INFO } from '@/lib/chart-colors';
import { BarChartSimple, AreaChartSimple } from './charts';

export function VelocityTab({
  velocityHistory,
  burnChart,
  summary,
}: {
  velocityHistory: VelocityPoint[];
  burnChart: BurnChartPoint[];
  summary: ProjectHealthSummary;
}) {
  return (
    <div className="space-y-4">
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
          Weekly Velocity (Items Completed)
        </h3>
        <BarChartSimple data={velocityHistory.map((v) => ({ label: v.weekLabel, value: v.itemsCompleted }))} color={STATUS_INFO} />
      </SurfaceCard>

      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          Cumulative Progress (Burnup)
        </h3>
        <AreaChartSimple
          data={burnChart.map((b) => ({
            label: b.weekLabel,
            completed: b.completed,
            ideal: summary.totalChecklistItems - b.idealRemaining,
          }))}
          total={summary.totalChecklistItems}
        />
      </SurfaceCard>
    </div>
  );
}
