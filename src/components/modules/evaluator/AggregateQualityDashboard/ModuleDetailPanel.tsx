import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Star } from 'lucide-react';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, RATING_EMPTY, qualityAccentColor,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { MOTION } from '@/lib/constants';
import { StatusRow } from './StatusRow';
import { Sparkline } from './Sparkline';
import type { CellData } from './types';

interface ModuleDetailPanelProps {
  selected: CellData | null | undefined;
  historyMap: Record<string, ReviewSnapshot[]>;
  onReviewModule?: (moduleId: SubModuleId) => void;
}

export function ModuleDetailPanel({ selected, historyMap, onReviewModule }: ModuleDetailPanelProps) {
  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: MOTION.base }}
          className="overflow-hidden"
        >
          <SurfaceCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: qualityAccentColor(
                      selected.avgQuality,
                      selected.pctReviewed,
                    ),
                  }}
                />
                <span className="text-sm font-semibold text-text">
                  {selected.label}
                </span>
                <span className="text-xs text-text-muted">
                  {selected.moduleId}
                </span>
              </div>
              {onReviewModule && (
                <button
                  onClick={() => onReviewModule(selected.moduleId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/20"
                >
                  <RefreshCw className="w-3 h-3" />
                  Review Module
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Status breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Feature Status
                </span>
                <div className="space-y-1">
                  <StatusRow
                    label="Implemented"
                    count={selected.implemented}
                    total={selected.total}
                    color={STATUS_SUCCESS}
                  />
                  <StatusRow
                    label="Partial"
                    count={selected.partial}
                    total={selected.total}
                    color={STATUS_WARNING}
                  />
                  <StatusRow
                    label="Missing"
                    count={selected.missing}
                    total={selected.total}
                    color={STATUS_ERROR}
                  />
                  <StatusRow
                    label="Unknown"
                    count={selected.unknown}
                    total={selected.total}
                    color="var(--text-muted)"
                  />
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Quality Score
                </span>
                {selected.avgQuality !== null ? (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-2xl font-bold"
                        style={{
                          color: qualityAccentColor(
                            selected.avgQuality,
                            selected.pctReviewed,
                          ),
                        }}
                      >
                        {selected.avgQuality}
                      </span>
                      <span className="text-xs text-text-muted">/ 5</span>
                    </div>
                    <div className="flex items-center gap-px mt-1">
                      {Array.from({ length: 5 }, (_, si) => (
                        <Star
                          key={si}
                          className="w-4 h-4"
                          style={{
                            color:
                              si < Math.round(selected.avgQuality!)
                                ? qualityAccentColor(
                                    selected.avgQuality,
                                    selected.pctReviewed,
                                  )
                                : RATING_EMPTY,
                            fill:
                              si < Math.round(selected.avgQuality!)
                                ? qualityAccentColor(
                                    selected.avgQuality,
                                    selected.pctReviewed,
                                  )
                                : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    No quality data yet
                  </p>
                )}
              </div>

              {/* Review info + trend chart */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Review History
                </span>
                <div className="space-y-1.5">
                  <div className="text-xs text-text-muted">
                    <span className="text-text-muted">Last reviewed: </span>
                    {selected.lastReviewedAt
                      ? new Date(selected.lastReviewedAt).toLocaleDateString()
                      : 'Never'}
                  </div>
                  {selected.daysSinceReview !== null && (
                    <div className="text-xs text-text-muted">
                      <span className="text-text-muted">Days ago: </span>
                      {selected.daysSinceReview}
                    </div>
                  )}
                  <div className="text-xs text-text-muted">
                    <span className="text-text-muted">Reviews: </span>
                    {historyMap[selected.moduleId]?.length ?? 0} snapshots
                  </div>
                </div>
                {(historyMap[selected.moduleId]?.length ?? 0) >= 2 && (
                  <Sparkline
                    snapshots={historyMap[selected.moduleId]}
                    color={qualityAccentColor(selected.avgQuality, selected.pctReviewed)}
                    width={160}
                    height={48}
                    pad={4}
                    domainCeil={5.5}
                    strokeWidth={1.5}
                    areaFill="gradient"
                    gradientId="trend-grad"
                    markers="all"
                    gridValues={[1, 2, 3, 4, 5]}
                    showDelta
                  />
                )}
              </div>
            </div>
          </SurfaceCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
