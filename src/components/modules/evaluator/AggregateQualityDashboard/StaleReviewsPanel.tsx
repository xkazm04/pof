import { CheckCircle2, Clock, Loader2, Zap } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_SUCCESS, STATUS_STALE, statusBg, statusBorder } from '@/lib/chart-colors';
import type { CellData } from './types';

interface StaleReviewsPanelProps {
  staleModules: CellData[];
  customStaleDays: number;
  setCustomStaleDays: (v: number) => void;
  onBatchReview?: (moduleIds: string[]) => void;
  handleBatchReview: () => void;
  isBatchReviewing: boolean;
  setSelectedModule: (v: string | null) => void;
}

export function StaleReviewsPanel({
  staleModules,
  customStaleDays,
  setCustomStaleDays,
  onBatchReview,
  handleBatchReview,
  isBatchReviewing,
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
          {onBatchReview && (
            <button
              onClick={handleBatchReview}
              disabled={isBatchReviewing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 hover:brightness-125"
              style={{ backgroundColor: statusBg(STATUS_STALE), color: STATUS_STALE, border: `1px solid ${statusBorder(STATUS_STALE)}` }}
            >
              {isBatchReviewing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Queuing reviews...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Review All Stale ({staleModules.length} modules)
                </>
              )}
            </button>
          )}
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
