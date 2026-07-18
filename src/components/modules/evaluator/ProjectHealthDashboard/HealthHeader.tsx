import { Play } from 'lucide-react';
import type { EvaluatorReport } from '@/types/evaluator';
import { STATUS_STALE, statusBg, statusBorder } from '@/lib/chart-colors';
import { EVAL_ACCENT } from './constants';
import { RadialScoreGauge } from './RadialScoreGauge';

export function HealthHeader({
  lastScan,
  isScanning,
  scanHistory,
  showHistoryOverlay,
  setShowHistoryOverlay,
}: {
  lastScan: EvaluatorReport | null;
  isScanning: boolean;
  scanHistory: EvaluatorReport[];
  showHistoryOverlay: boolean;
  setShowHistoryOverlay: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-5">
      {/* Radial Score Gauge */}
      <div className="flex-shrink-0">
        <RadialScoreGauge score={lastScan?.overallScore ?? null} isScanning={isScanning} />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-text">
          {lastScan ? 'Project Health' : 'No scans yet'}
        </h3>
        {lastScan ? (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
            {lastScan.summary}
          </p>
        ) : (
          <p className="text-xs text-text-muted mt-0.5">
            Run a scan to analyze your UE5 project structure, code quality, and systems.
          </p>
        )}
        {lastScan && (
          <p className="text-2xs text-text-muted mt-1">
            {new Date(lastScan.timestamp).toLocaleString()} · {lastScan.moduleScores.length} modules · {lastScan.recommendations.length} recommendations
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {/* In-app project scanning has no backing trigger yet (no store action
            or API produces an EvaluatorReport). Render an honest disabled
            affordance instead of a live-looking button that swallows clicks. */}
        <button
          disabled
          aria-disabled="true"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-not-allowed opacity-70"
          style={{
            backgroundColor: `${EVAL_ACCENT}0a`,
            color: EVAL_ACCENT,
            border: `1px dashed ${EVAL_ACCENT}30`,
          }}
          title="Project scanning is not available yet — it requires CLI integration"
        >
          <Play className="w-3.5 h-3.5" />
          Scan Project
          <span
            className="ml-1 px-1.5 py-0.5 rounded text-2xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${EVAL_ACCENT}18`, color: EVAL_ACCENT }}
          >
            Soon
          </span>
        </button>
        <p className="text-2xs text-text-muted text-right">Requires CLI integration</p>
        {scanHistory.length >= 2 && (
          <button
            onClick={() => setShowHistoryOverlay(!showHistoryOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
              showHistoryOverlay
                ? ''
                : 'bg-surface text-text-muted border-border hover:text-text'
            }`}
            style={
              showHistoryOverlay
                ? {
                    backgroundColor: statusBg(STATUS_STALE, 0.12),
                    color: STATUS_STALE,
                    borderColor: statusBorder(STATUS_STALE, 0.12),
                  }
                : undefined
            }
          >
            {showHistoryOverlay ? 'Hide Previous' : 'Compare Previous'}
          </button>
        )}
      </div>
    </div>
  );
}
