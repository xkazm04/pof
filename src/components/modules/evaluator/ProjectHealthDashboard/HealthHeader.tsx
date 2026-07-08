import { Loader2, Play } from 'lucide-react';
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

      <div className="flex flex-col gap-2 flex-shrink-0">
        <button
          disabled={isScanning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${EVAL_ACCENT}12`,
            color: EVAL_ACCENT,
            border: `1px solid ${EVAL_ACCENT}25`,
          }}
          title="Scan functionality requires CLI integration"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Scan Project
            </>
          )}
        </button>
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
