import { AlertTriangle, Zap } from 'lucide-react';
import type { EvaluatorReport, Recommendation } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_LABELS } from '@/lib/module-registry';
import { EVAL_ACCENT, PRIORITY_COLORS } from './constants';
import { priorityOrder } from './helpers';

export function TopRecommendations({
  lastScan,
  handleFix,
  fixCli,
}: {
  lastScan: EvaluatorReport;
  handleFix: (rec: Recommendation) => void;
  fixCli: { isRunning: boolean };
}) {
  return (
    <SurfaceCard level={3} className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24]" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Top Recommendations
        </span>
        <span className="text-2xs text-text-muted ml-auto">
          {lastScan.recommendations.length} total
        </span>
      </div>
      <div className="space-y-2">
        {lastScan.recommendations
          .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
          .slice(0, 5)
          .map((rec) => {
            const pc = PRIORITY_COLORS[rec.priority] ?? PRIORITY_COLORS.low;
            return (
              <div
                key={rec.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
                style={{ backgroundColor: pc.bg, borderColor: pc.border }}
              >
                <span
                  className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ color: pc.text, backgroundColor: `${pc.text}15` }}
                >
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-text">{rec.title}</span>
                  <span className="text-xs text-text-muted ml-2">
                    {MODULE_LABELS[rec.moduleId] ?? rec.moduleId}
                  </span>
                </div>
                <button
                  onClick={() => handleFix(rec)}
                  disabled={fixCli.isRunning}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all disabled:opacity-50 flex-shrink-0"
                  style={{
                    backgroundColor: `${EVAL_ACCENT}12`,
                    color: EVAL_ACCENT,
                    border: `1px solid ${EVAL_ACCENT}25`,
                  }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  Fix
                </button>
              </div>
            );
          })}
      </div>
    </SurfaceCard>
  );
}
