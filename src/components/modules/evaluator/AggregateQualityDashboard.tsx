'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import type { ModuleAggregate, ReviewSnapshot } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiFetch } from '@/lib/api-utils';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { KPICard } from '@/components/ui/KPICard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_STALE, MODULE_COLORS,
  QUALITY_HEATMAP_LOW, QUALITY_HEATMAP_MID, QUALITY_HEATMAP_HIGH, RATING_EMPTY,
  statusBg, statusBorder, qualityCellColor, qualityAccentColor,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { MOTION } from '@/lib/constants';
import { HorizontalGridLines } from '@/components/ui/svg/ChartAxes';
import {
  paddedDomain, sparklinePoints, sparklineLinePath, sparklineAreaPath,
} from '@/components/modules/core-engine/sub_progression/_shared/chartMath';

const ALL_MODULE_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

// ─── Color helpers ──────────────────────────────────────────────────────────────
// Quality → cell/accent color mapping lives in `@/lib/chart-colors`
// (`qualityCellColor` / `qualityAccentColor`) so the hex interpolation is shared
// and unit-tested rather than hand-rolled here.

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CellData {
  moduleId: SubModuleId;
  label: string;
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
  lastReviewedAt: string | null;
  daysSinceReview: number | null;
  pctComplete: number;
  pctReviewed: number;
}

interface Props {
  staleDays?: number;
  onReviewModule?: (moduleId: SubModuleId) => void;
  onBatchReview?: (moduleIds: string[]) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function AggregateQualityDashboard({ staleDays = 7, onReviewModule, onBatchReview }: Props) {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, ReviewSnapshot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [customStaleDays, setCustomStaleDays] = useState(staleDays);
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  // The heatmap entrance stagger should play once (on first mount), not replay
  // on every data refresh while the grid stays mounted.
  const hasAnimatedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [aggData, histData] = await Promise.all([
        apiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate'),
        apiFetch<{ history: Record<string, ReviewSnapshot[]> }>('/api/feature-matrix/history'),
      ]);
      setAggregates(aggData.modules ?? []);
      setHistoryMap(histData.history ?? {});
    } catch (err) {
      console.error('AggregateQualityDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge DB data with all known modules (some may not be seeded yet)
  const cells: CellData[] = useMemo(() => {
    const aggMap = new Map(aggregates.map((a) => [a.moduleId, a]));

    return ALL_MODULE_IDS.map((moduleId) => {
      const agg = aggMap.get(moduleId);
      const defCount = MODULE_FEATURE_DEFINITIONS[moduleId]?.length ?? 0;
      const total = agg?.total ?? defCount;
      const implemented = agg?.implemented ?? 0;
      const improved = agg?.improved ?? 0;
      const partial = agg?.partial ?? 0;
      const missing = agg?.missing ?? 0;
      const unknown = agg?.unknown ?? total;
      const reviewed = implemented + improved + partial + missing;
      const pctReviewed = total > 0 ? reviewed / total : 0;
      const pctComplete = total > 0 ? (implemented + improved) / total : 0;
      const lastReviewedAt = agg?.lastReviewedAt ?? null;

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        total,
        implemented,
        improved,
        partial,
        missing,
        unknown,
        avgQuality: agg?.avgQuality ?? null,
        lastReviewedAt,
        daysSinceReview: daysSince(lastReviewedAt),
        pctComplete,
        pctReviewed,
      };
    });
  }, [aggregates]);

  // Project-wide totals
  const totals = useMemo(() => {
    const t = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0, reviewed: 0 };
    for (const c of cells) {
      t.total += c.total;
      t.implemented += c.implemented;
      t.improved += c.improved;
      t.partial += c.partial;
      t.missing += c.missing;
      t.unknown += c.unknown;
      if (c.pctReviewed > 0) t.reviewed++;
    }
    return t;
  }, [cells]);

  // Worst quality modules (reviewed, quality < 3)
  const worstModules = useMemo(
    () =>
      cells
        .filter((c) => c.avgQuality !== null && c.avgQuality < 3 && c.pctReviewed > 0)
        .sort((a, b) => (a.avgQuality ?? 0) - (b.avgQuality ?? 0)),
    [cells],
  );

  // Stale modules
  const staleModules = useMemo(
    () =>
      cells.filter((c) => {
        if (c.lastReviewedAt === null) return true; // never reviewed
        return (c.daysSinceReview ?? Infinity) > customStaleDays;
      }),
    [cells, customStaleDays],
  );

  const overallQuality = useMemo(() => {
    const withQuality = cells.filter((c) => c.avgQuality !== null);
    if (withQuality.length === 0) return null;
    const sum = withQuality.reduce((acc, c) => acc + (c.avgQuality ?? 0), 0);
    return Math.round((sum / withQuality.length) * 10) / 10;
  }, [cells]);

  const overallPct = totals.total > 0 ? Math.round((totals.implemented / totals.total) * 100) : 0;

  const handleBatchReview = async () => {
    if (!onBatchReview || staleModules.length === 0) return;
    setIsBatchReviewing(true);
    try {
      await onBatchReview(staleModules.map((m) => m.moduleId));
    } finally {
      setIsBatchReviewing(false);
    }
  };

  // Only blank to the spinner on the very first load. On manual refreshes the
  // grid stays mounted (data is updated in place), so we avoid a full remount +
  // staggered re-animation of every cell.
  if (isLoading && aggregates.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  const selected = selectedModule ? cells.find((c) => c.moduleId === selectedModule) : null;

  // Play the cell entrance stagger only on the first render with data; mark the
  // ref so subsequent refreshes/re-renders render the grid in its final state.
  const playEntrance = !hasAnimatedRef.current;
  hasAnimatedRef.current = true;

  return (
    <div className="space-y-5">
      {/* ── Top metrics row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Overall Progress"
          value={`${overallPct}%`}
          sub={`${totals.implemented} / ${totals.total} features`}
          accent={STATUS_SUCCESS}
        />
        <MetricCard
          icon={Star}
          label="Avg Quality"
          value={overallQuality !== null ? `${overallQuality} / 5` : '--'}
          sub={`${totals.reviewed} / ${cells.length} modules reviewed`}
          accent={STATUS_WARNING}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={`${worstModules.length}`}
          sub="modules below quality 3"
          accent={STATUS_ERROR}
        />
        <MetricCard
          icon={Clock}
          label="Stale Reviews"
          value={`${staleModules.length}`}
          sub={`not reviewed in ${customStaleDays}d`}
          accent={STATUS_STALE}
        />
      </div>

      {/* ── Project completion bar ──────────────────────────────────────── */}
      <SurfaceCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Project Completion
          </span>
          <span className="text-xs text-text-muted">
            {totals.implemented} implemented / {totals.partial} partial / {totals.missing} missing / {totals.unknown} unknown
          </span>
        </div>
        <div className="h-2.5 bg-border rounded-full overflow-hidden flex">
          {totals.implemented > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.implemented / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease }}
              style={{ backgroundColor: STATUS_SUCCESS }}
            />
          )}
          {totals.partial > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.partial / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease, delay: 0.1 }}
              style={{ backgroundColor: STATUS_WARNING }}
            />
          )}
          {totals.missing > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.missing / totals.total) * 100}%` }}
              transition={{ duration: MOTION.slow, ease: MOTION.ease, delay: 0.2 }}
              style={{ backgroundColor: STATUS_ERROR }}
            />
          )}
        </div>
      </SurfaceCard>

      {/* ── Module Heatmap ──────────────────────────────────────────────── */}
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

      {/* ── Selected module detail panel ─────────────────────────────────── */}
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

      {/* ── Worst quality modules ────────────────────────────────────────── */}
      {worstModules.length > 0 && (
        <div className="bg-surface border rounded-lg p-4" style={{ borderColor: statusBorder(STATUS_ERROR) }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_ERROR }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
              Needs Attention
            </span>
            <span className="text-2xs text-text-muted">
              modules with average quality below 3.0
            </span>
          </div>
          <div className="space-y-1.5">
            {worstModules.map((m) => (
              <div
                key={m.moduleId}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                onClick={() => setSelectedModule(m.moduleId)}
              >
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                <span className="text-xs text-text font-medium flex-1">
                  {m.label}
                </span>
                <div className="flex items-center gap-px">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className="w-2.5 h-2.5"
                      style={{
                        color: i < Math.round(m.avgQuality!) ? STATUS_ERROR : RATING_EMPTY,
                        fill: i < Math.round(m.avgQuality!) ? STATUS_ERROR : 'none',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium w-6 text-right" style={{ color: STATUS_ERROR }}>
                  {m.avgQuality}
                </span>
                <span className="text-xs text-text-muted">
                  {m.implemented}/{m.total} done
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stale modules + batch review ─────────────────────────────────── */}
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
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <KPICard
      layout="vertical"
      animated
      accent={accent}
      icon={<Icon className="w-3.5 h-3.5" style={{ color: accent }} />}
      label={label}
      value={value}
      sub={sub}
    />
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-text-muted flex-1">{label}</span>
      <span className="text-xs font-medium" style={{ color }}>
        {count}
      </span>
      <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/**
 * One parametric quality sparkline driving both the compact heatmap-cell trend
 * (`markers="end"`, solid fill) and the rich detail-panel trend (`markers="all"`,
 * gradient fill, grid lines, delta footer). All point/path geometry comes from
 * the shared `chartMath` helpers; only the styling differs by prop.
 */
function Sparkline({
  snapshots,
  color,
  width,
  height,
  pad,
  domainCeil,
  strokeWidth,
  lineOpacity = 1,
  areaFill,
  areaOpacity = 0.15,
  markers,
  gridValues,
  gradientId,
  showDelta = false,
  className,
}: {
  snapshots: ReviewSnapshot[];
  color: string;
  width: number;
  height: number;
  pad: number;
  /** Upper clamp of the padded Y domain (lower bound is 0). */
  domainCeil: number;
  strokeWidth: number;
  lineOpacity?: number;
  /** `'solid'` = flat color at `areaOpacity`; `'gradient'` = vertical fade. */
  areaFill: 'solid' | 'gradient';
  areaOpacity?: number;
  /** `'end'` = dot at last point; `'all'` = dot + date tooltip per point. */
  markers: 'none' | 'end' | 'all';
  /** Draw horizontal grid lines at these data values. */
  gridValues?: readonly number[];
  /** Unique id for the gradient def — required when `areaFill="gradient"`. */
  gradientId?: string;
  /** Render the "N reviews / Δ since first" footer below the chart. */
  showDelta?: boolean;
  className?: string;
}) {
  const series = snapshots
    .map((s) => ({ q: s.avgQuality, date: s.reviewedAt }))
    .filter((p): p is { q: number; date: string } => p.q !== null);

  if (series.length < 2) return null;

  const values = series.map((p) => p.q);
  const { min, max } = paddedDomain(values, 0.5, 0, domainCeil);
  const points = sparklinePoints(values, { width, height, pad }, min, max);
  const linePath = sparklineLinePath(points);
  const areaPath = sparklineAreaPath(points, height);
  const lastPoint = points[points.length - 1];

  const svg = (
    <svg width={width} height={height} className={showDelta ? 'w-full' : className}>
      {gridValues && (
        <HorizontalGridLines
          values={gridValues}
          min={min}
          max={max}
          left={pad}
          right={width - pad}
          top={pad}
          bottom={height - pad}
        />
      )}
      {areaFill === 'gradient' && gradientId ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      ) : (
        <path d={areaPath} fill={color} fillOpacity={areaOpacity} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={lineOpacity}
      />
      {markers === 'end' && <circle cx={lastPoint.x} cy={lastPoint.y} r="1.5" fill={color} />}
      {markers === 'all' &&
        points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color}>
            <title>{`${new Date(series[i].date).toLocaleDateString()}: ${series[i].q}`}</title>
          </circle>
        ))}
    </svg>
  );

  if (!showDelta) return svg;

  const delta = values[values.length - 1] - values[0];
  const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta > 0.1 ? STATUS_SUCCESS : delta < -0.1 ? STATUS_ERROR : 'var(--text-muted)';

  return (
    <div className={className ?? 'mt-1'}>
      {svg}
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xs text-text-muted">{values.length} reviews</span>
        <span className="text-2xs font-medium" style={{ color: deltaColor }}>
          {deltaStr} since first
        </span>
      </div>
    </div>
  );
}
