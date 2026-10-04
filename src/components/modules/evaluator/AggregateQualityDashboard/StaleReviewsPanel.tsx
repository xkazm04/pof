import { CheckCircle2, Clock, Loader2, Zap } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_STALE, STATUS_ERROR, statusBg, statusBorder } from '@/lib/chart-colors';
import type { CellData } from './types';

interface StaleReviewsPanelProps {
  staleModules: CellData[];
  customStaleDays: number;
  setCustomStaleDays: (v: number) => void;
  handleBatchReview: () => void;
  /** A review is starting or a batch is running — the action is unavailable. */
  isBatchReviewing: boolean;
  /** Why the last review start was refused (e.g. 409 already running), else null. */
  reviewError: string | null;
  setSelectedModule: (v: string | null) => void;
}

export function StaleReviewsPanel({
  staleModules,
  customStaleDays,
  setCustomStaleDays,
  handleBatchReview,
  isBatchReviewing,
  reviewError,
  setSelectedModule,
}: StaleReviewsPanelProps) {
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" style={{ color: STATUS_STALE }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: STATUS_STALE }}>
            Stale Reviews
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Threshold:</span>
          <input
            type="number"
            min={1}
            max={90}
            value={customStaleDays}
            onChange={(e) => setCustomStaleDays(Math.max(1, parseInt(e.target.value) || 7))}
            className="w-12 px-1.5 py-1 bg-background border border-border rounded text-xs text-text text-center outline-none focus:border-border-bright transition-colors"
          />
          <span className="text-xs text-text-muted">days</span>
        </div>
      </div>

      {reviewError && (
        <div
          role="alert"
          className="text-xs rounded-md px-3 py-2 mb-3"
          style={{ color: STATUS_ERROR, backgroundColor: statusBg(STATUS_ERROR), border: `1px solid ${statusBorder(STATUS_ERROR)}` }}
        >
          {reviewError}
        </div>
      )}

      {staleModules.length > 0 ? (
        <>
          <div className="space-y-1 mb-3">
            {staleModules.map((m) => (
              <div
                key={m.moduleId}
                className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                onClick={() => setSelectedModule(m.moduleId)}
              >
                <Clock className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_STALE }} />
                <span className="text-xs text-text flex-1">{m.label}</span>
                <span className="text-xs text-text-muted">
                  {m.lastReviewedAt
                    ? `${m.daysSinceReview}d ago`
                    : 'Never reviewed'}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleBatchReview}
            disabled={isBatchReviewing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 hover:brightness-125"
            style={{ backgroundColor: statusBg(STATUS_STALE), color: STATUS_STALE, border: `1px solid ${statusBorder(STATUS_STALE)}` }}
          >
            {isBatchReviewing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Zap className="w-3.5 h-3.5" />}
            Review {staleModules.length} stale {staleModules.length === 1 ? 'module' : 'modules'}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3">
          <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
          <span className="text-xs" style={{ color: STATUS_SUCCESS }}>
            All modules reviewed within {customStaleDays} days
          </span>
        </div>
      )}
    </SurfaceCard>
  );
}
