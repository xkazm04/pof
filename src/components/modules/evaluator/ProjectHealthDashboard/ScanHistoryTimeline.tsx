import { TrendingDown, TrendingUp } from 'lucide-react';
import type { EvaluatorReport } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';
import { scoreColor } from './helpers';
import { OverallScoreSparkline } from './OverallScoreSparkline';

/**
 * Overall-score change between two scans over the modules scored in BOTH. The overall
 * score averages every module covered so far, so a raw difference would read a newly
 * scored weak module as a regression. `added` is the coverage change, reported apart.
 */
export function sharedSetDelta(scan: EvaluatorReport, prev: EvaluatorReport | null): { delta: number; added: number } {
  if (!prev) return { delta: 0, added: 0 };
  const prevScores = new Map(prev.moduleScores.map((m) => [m.moduleId as string, m.score]));
  const shared = scan.moduleScores.filter((m) => prevScores.has(m.moduleId as string));
  const added = scan.moduleScores.length - shared.length;
  if (shared.length === 0) return { delta: 0, added };
  const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  const delta = mean(shared.map((m) => m.score)) - mean(shared.map((m) => prevScores.get(m.moduleId as string) as number));
  return { delta, added };
}

export function ScanHistoryTimeline({ scanHistory }: { scanHistory: EvaluatorReport[] }) {
  return (
    <SurfaceCard level={3} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
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
          const { delta, added } = sharedSetDelta(scan, prev);
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
                {added > 0 && ` (+${added} module${added === 1 ? '' : 's'} scored)`}
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
