import { AlertTriangle, Loader2, X, Zap } from 'lucide-react';
import type { EvaluatorReport, Recommendation } from '@/types/evaluator';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { EVAL_ACCENT, PRIORITY_COLORS } from './constants';
import { scoreColor, scoreBg } from './helpers';
import { ModuleScoreTrend } from './ModuleScoreTrend';
import type { SelectedModuleDetailData } from './types';

export function SelectedModuleDetail({
  selectedDetail,
  setSelectedModule,
  handleFix,
  fixCli,
  scanHistory,
}: {
  selectedDetail: SelectedModuleDetailData;
  setSelectedModule: (v: string | null) => void;
  handleFix: (rec: Recommendation) => void;
  fixCli: { isRunning: boolean };
  scanHistory: EvaluatorReport[];
}) {
  return (
    <SurfaceCard level={3} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: scoreColor(selectedDetail.score) }}
          />
          <span className="text-sm font-semibold text-text">{selectedDetail.label}</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{
              color: scoreColor(selectedDetail.score),
              backgroundColor: scoreBg(selectedDetail.score),
            }}
          >
            {selectedDetail.score}/100
          </span>
        </div>
        <button
          onClick={() => setSelectedModule(null)}
          className="p-1 rounded-md hover:bg-border transition-colors"
        >
          <X className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>

      {/* Issues */}
      {selectedDetail.issues.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Issues ({selectedDetail.issues.length})
          </h4>
          <div className="space-y-1">
            {selectedDetail.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1.5 rounded-md bg-surface-deep">
                <AlertTriangle className="w-3 h-3 text-[#fbbf24] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-text-muted">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations with fix buttons */}
      {selectedDetail.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Recommendations
          </h4>
          <div className="space-y-2">
            {selectedDetail.recommendations.map((rec) => {
              const pc = PRIORITY_COLORS[rec.priority] ?? PRIORITY_COLORS.low;
              return (
                <div
                  key={rec.id}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ backgroundColor: pc.bg, borderColor: pc.border }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: pc.text, backgroundColor: `${pc.text}15` }}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-xs font-semibold text-text">{rec.title}</span>
                  </div>
                  <p className="text-xs text-text-muted-hover mb-2">{rec.description}</p>
                  <button
                    onClick={() => handleFix(rec)}
                    disabled={fixCli.isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: `${EVAL_ACCENT}12`,
                      color: EVAL_ACCENT,
                      border: `1px solid ${EVAL_ACCENT}25`,
                    }}
                  >
                    {fixCli.isRunning ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    Fix with Claude
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score trend from history */}
      <ModuleScoreTrend moduleId={selectedDetail.moduleId} scanHistory={scanHistory} />
    </SurfaceCard>
  );
}
