import { TrendingDown, TrendingUp } from 'lucide-react';
import type { EvaluatorReport } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';
import { scoreColor } from './helpers';
import { OverallScoreSparkline } from './OverallScoreSparkline';

export function ScanHistoryTimeline({ scanHistory }: { scanHistory: EvaluatorReport[] }) {
  return (
    <SurfaceCard level={3} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-[#4ade80]" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Scan History
        </span>
        <span className="text-2xs text-text-muted ml-auto">
          {scanHistory.length} scans
        </span>
      </div>

      {/* Sparkline of overall scores */}
      <OverallScoreSparkline scanHistory={scanHistory} accent={EVAL_ACCENT} />

      {/* History list */}
      <div className="mt-3 space-y-1">
        {[...scanHistory].reverse().slice(0, 5).map((scan, idx) => {
          const prev = idx < scanHistory.length - 1 ? [...scanHistory].reverse()[idx + 1] : null;
          const delta = prev ? scan.overallScore - prev.overallScore : 0;
          return (
            <div
              key={scan.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: scoreColor(scan.overallScore) }}
              />
              <span className="text-xs font-bold" style={{ color: scoreColor(scan.overallScore) }}>
                {scan.overallScore}
              </span>
              {delta !== 0 && (
                <span
                  className="text-2xs font-medium flex items-center gap-0.5"
                  style={{ color: delta > 0 ? STATUS_SUCCESS : STATUS_ERROR }}
                >
                  {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
              <span className="text-xs text-text-muted flex-1">
                {new Date(scan.timestamp).toLocaleDateString()} {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-2xs text-text-muted">
                {scan.moduleScores.length} modules
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
