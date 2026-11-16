import { Gauge, AlertTriangle } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { QualityPoint } from '@/types/project-health';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import { scoreStatusToken } from '@/lib/status-token';
import { LineChartSimple, ChartEmpty } from './charts';

export function QualityTab({ qualityHistory }: { qualityHistory: QualityPoint[] }) {
  return (
    <div className="space-y-4">
      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          Quality Score Trend
        </h3>
        <LineChartSimple data={qualityHistory.map((q) => ({ label: q.label, value: q.overallScore }))} color={ACCENT_EMERALD} />
      </SurfaceCard>

      <SurfaceCard>
        <h3 className="text-xs font-semibold text-text mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Issues Trend
        </h3>
        {qualityHistory.length === 0 && (
          <ChartEmpty>No scans yet. Run a project scan to track critical and high issues over time.</ChartEmpty>
        )}
        <div className="space-y-1.5">
          {qualityHistory.map((q) => (
            <div key={q.label} className="flex items-center gap-3">
              <span className="text-2xs text-text-muted w-14">{q.label}</span>
              <div className="flex-1 flex items-center gap-2">
                {q.criticalIssues > 0 && (
                  <span className="text-2xs text-red-400">{q.criticalIssues} critical</span>
                )}
                {q.highIssues > 0 && (
                  <span className="text-2xs text-amber-400">{q.highIssues} high</span>
                )}
                {q.criticalIssues === 0 && q.highIssues === 0 && (
                  <span className="text-2xs text-emerald-400">No issues</span>
                )}
              </div>
              <ProgressRing value={q.overallScore} size={24} strokeWidth={2.5} color={scoreStatusToken(q.overallScore).color} />
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
