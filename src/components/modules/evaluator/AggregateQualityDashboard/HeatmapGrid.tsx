import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Clock, RefreshCw, Star } from 'lucide-react';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_STALE, MODULE_COLORS,
  QUALITY_HEATMAP_LOW, QUALITY_HEATMAP_MID, QUALITY_HEATMAP_HIGH, RATING_EMPTY,
  qualityCellColor, qualityAccentColor,
} from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';
import { Sparkline } from './Sparkline';
import type { CellData } from './types';

interface HeatmapGridProps {
  cells: CellData[];
  historyMap: Record<string, ReviewSnapshot[]>;
  hoveredModule: string | null;
  selectedModule: string | null;
  customStaleDays: number;
  playEntrance: boolean;
  fetchData: () => void;
  setHoveredModule: (v: string | null) => void;
  setSelectedModule: (v: string | null) => void;
}

export function HeatmapGrid({
  cells,
  historyMap,
  hoveredModule,
  selectedModule,
  customStaleDays,
  playEntrance,
  fetchData,
  setHoveredModule,
  setSelectedModule,
}: HeatmapGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: MODULE_COLORS.evaluator }} />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Module Quality Heatmap
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-2 text-2xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: QUALITY_HEATMAP_LOW }} />
              Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: QUALITY_HEATMAP_MID }} />
              Mid
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: QUALITY_HEATMAP_HIGH }} />
              High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--border)' }} />
              Unreviewed
            </span>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cells.map((cell, i) => {
          const bgColor = qualityCellColor(cell.avgQuality, cell.pctReviewed);
          const accentColor = qualityAccentColor(cell.avgQuality, cell.pctReviewed);
          const isHovered = hoveredModule === cell.moduleId;
          const isSelected = selectedModule === cell.moduleId;
          const isWorst =
            cell.avgQuality !== null && cell.avgQuality < 3 && cell.pctReviewed > 0;
          const isStale =
            cell.lastReviewedAt === null || (cell.daysSinceReview ?? Infinity) > customStaleDays;

          return (
            <motion.button
              key={cell.moduleId}
              initial={playEntrance ? { opacity: 0, scale: 0.95 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                playEntrance ? { duration: MOTION.base, delay: i * 0.03 } : { duration: 0 }
              }
              onClick={() =>
                setSelectedModule(isSelected ? null : cell.moduleId)
              }
              onMouseEnter={() => setHoveredModule(cell.moduleId)}
              onMouseLeave={() => setHoveredModule(null)}
              className={`relative rounded-lg p-3 text-left transition-all duration-base border ${
                isSelected
                  ? 'border-[#ef4444]/50 ring-1 ring-[#ef4444]/30'
                  : isHovered
                    ? 'border-border-bright'
                    : 'border-border/60'
              }`}
              style={{ backgroundColor: bgColor }}
            >
              {/* Stale/worst indicators */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                {isWorst && (
                  <span title="Low quality">
                    <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} />
                  </span>
                )}
                {isStale && (
                  <span title="Stale review">
                    <Clock className="w-3 h-3" style={{ color: STATUS_STALE }} />
                  </span>
                )}
              </div>

              {/* Module name */}
              <div className="text-xs font-semibold text-text mb-1.5 pr-6 truncate">
                {cell.label}
              </div>

              {/* Quality score */}
              <div className="flex items-center gap-1.5 mb-2">
                {cell.avgQuality !== null ? (
                  <>
                    <div className="flex items-center gap-px">
                      {Array.from({ length: 5 }, (_, si) => (
                        <Star
                          key={si}
                          className="w-2.5 h-2.5"
                          style={{
                            color:
                              si < Math.round(cell.avgQuality!)
                                ? accentColor
                                : RATING_EMPTY,
                            fill:
                              si < Math.round(cell.avgQuality!)
                                ? accentColor
                                : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: accentColor }}
                    >
                      {cell.avgQuality}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-text-muted italic">
                    Not reviewed
                  </span>
                )}
              </div>

              {/* Quality sparkline */}
              {(historyMap[cell.moduleId]?.length ?? 0) >= 2 && (
                <Sparkline
                  snapshots={historyMap[cell.moduleId]}
                  color={accentColor}
                  width={48}
                  height={16}
                  pad={1}
                  domainCeil={5}
                  strokeWidth={1}
                  lineOpacity={0.7}
                  areaFill="solid"
                  areaOpacity={0.15}
                  markers="end"
                  className="mb-1"
                />
              )}

              {/* Mini progress bar */}
              <div className="h-1 bg-black/30 rounded-full overflow-hidden flex mb-1.5">
                {cell.implemented > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${(cell.implemented / cell.total) * 100}%`,
                      backgroundColor: STATUS_SUCCESS,
                    }}
                  />
                )}
                {cell.partial > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${(cell.partial / cell.total) * 100}%`,
                      backgroundColor: STATUS_WARNING,
                    }}
                  />
                )}
                {cell.missing > 0 && (
                  <div
                    className="h-full"
                    style={{
                      width: `${(cell.missing / cell.total) * 100}%`,
                      backgroundColor: STATUS_ERROR,
                    }}
                  />
                )}
              </div>

              {/* Status counts */}
              <div className="flex items-center gap-2 text-2xs">
                <span style={{ color: STATUS_SUCCESS }}>{cell.implemented}</span>
                <span style={{ color: STATUS_WARNING }}>{cell.partial}</span>
                <span style={{ color: STATUS_ERROR }}>{cell.missing}</span>
                <span className="text-text-muted ml-auto">
                  {cell.total} total
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
