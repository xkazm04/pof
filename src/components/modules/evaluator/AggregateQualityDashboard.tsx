'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';

const ALL_MODULE_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS);

// ─── Color helpers ──────────────────────────────────────────────────────────────

function qualityToColor(avgQuality: number | null, pctReviewed: number): string {
  if (pctReviewed === 0) return 'var(--border)'; // un-reviewed: dark
  if (avgQuality === null) return 'var(--border)';
  // Map 1-5 → red(1) → amber(3) → green(5)
  const t = Math.max(0, Math.min(1, (avgQuality - 1) / 4));
  if (t < 0.5) {
    // red → amber
    const s = t / 0.5;
    return lerpColor('#7f1d1d', '#78350f', s);
  }
  // amber → green
  const s = (t - 0.5) / 0.5;
  return lerpColor('#78350f', '#14532d', s);
}

function qualityToAccent(avgQuality: number | null, pctReviewed: number): string {
  if (pctReviewed === 0) return 'var(--text-muted)';
  if (avgQuality === null) return 'var(--text-muted)';
  const t = Math.max(0, Math.min(1, (avgQuality - 1) / 4));
  if (t < 0.5) {
    const s = t / 0.5;
    return lerpColor(STATUS_ERROR, STATUS_WARNING, s);
  }
  const s = (t - 0.5) / 0.5;
  return lerpColor(STATUS_WARNING, STATUS_SUCCESS, s);
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CellData {
  moduleId: string;
  label: string;
  total: number;
  implemented: number;
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
  onReviewModule?: (moduleId: string) => void;
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
      const partial = agg?.partial ?? 0;
      const missing = agg?.missing ?? 0;
      const unknown = agg?.unknown ?? total;
      const reviewed = implemented + partial + missing;
      const pctReviewed = total > 0 ? reviewed / total : 0;
      const pctComplete = total > 0 ? implemented / total : 0;
      const lastReviewedAt = agg?.lastReviewedAt ?? null;

      return {
        moduleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        total,
        implemented,
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
    const t = { total: 0, implemented: 0, partial: 0, missing: 0, unknown: 0, reviewed: 0 };
    for (const c of cells) {
      t.total += c.total;
      t.implemented += c.implemented;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  const selected = selectedModule ? cells.find((c) => c.moduleId === selectedModule) : null;

  return (
    <div className="space-y-5">
      {/* ── Top metrics row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Overall Progress"
          value={`${overallPct}%`}
          sub={`${totals.implemented} / ${totals.total} features`}
          accent="#4ade80"
        />
        <MetricCard
          icon={Star}
          label="Avg Quality"
          value={overallQuality !== null ? `${overallQuality} / 5` : '--'}
          sub={`${totals.reviewed} / ${cells.length} modules reviewed`}
          accent="#fbbf24"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={`${worstModules.length}`}
          sub="modules below quality 3"
          accent="#f87171"
        />
        <MetricCard
          icon={Clock}
          label="Stale Reviews"
          value={`${staleModules.length}`}
          sub={`not reviewed in ${customStaleDays}d`}
          accent="#8b5cf6"
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
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ backgroundColor: '#4ade80' }}
            />
          )}
          {totals.partial > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.partial / totals.total) * 100}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              style={{ backgroundColor: '#fbbf24' }}
            />
          )}
          {totals.missing > 0 && (
            <motion.div
              className="h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(totals.missing / totals.total) * 100}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              style={{ backgroundColor: '#f87171' }}
            />
          )}
        </div>
      </SurfaceCard>

      {/* ── Module Heatmap ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Module Quality Heatmap
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#7f1d1d' }} />
                Low
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#78350f' }} />
                Mid
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#14532d' }} />
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
            const bgColor = qualityToColor(cell.avgQuality, cell.pctReviewed);
            const accentColor = qualityToAccent(cell.avgQuality, cell.pctReviewed);
            const isHovered = hoveredModule === cell.moduleId;
            const isSelected = selectedModule === cell.moduleId;
            const isWorst =
              cell.avgQuality !== null && cell.avgQuality < 3 && cell.pctReviewed > 0;
            const isStale =
              cell.lastReviewedAt === null || (cell.daysSinceReview ?? Infinity) > customStaleDays;

            return (
              <motion.button
                key={cell.moduleId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
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
                      <AlertTriangle className="w-3 h-3 text-[#f87171]" />
                    </span>
                  )}
                  {isStale && (
                    <span title="Stale review">
                      <Clock className="w-3 h-3 text-[#8b5cf6]" />
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
                                  : '#2a2a4a',
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
                  <MiniSparkline
                    snapshots={historyMap[cell.moduleId]}
                    color={accentColor}
                  />
                )}

                {/* Mini progress bar */}
                <div className="h-1 bg-black/30 rounded-full overflow-hidden flex mb-1.5">
                  {cell.implemented > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(cell.implemented / cell.total) * 100}%`,
                        backgroundColor: '#4ade80',
                      }}
                    />
                  )}
                  {cell.partial > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(cell.partial / cell.total) * 100}%`,
                        backgroundColor: '#fbbf24',
                      }}
                    />
                  )}
                  {cell.missing > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(cell.missing / cell.total) * 100}%`,
                        backgroundColor: '#f87171',
                      }}
                    />
                  )}
                </div>

                {/* Status counts */}
                <div className="flex items-center gap-2 text-2xs">
                  <span className="text-[#4ade80]">{cell.implemented}</span>
                  <span className="text-[#fbbf24]">{cell.partial}</span>
                  <span className="text-[#f87171]">{cell.missing}</span>
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
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <SurfaceCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: qualityToAccent(
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
                      color="#4ade80"
                    />
                    <StatusRow
                      label="Partial"
                      count={selected.partial}
                      total={selected.total}
                      color="#fbbf24"
                    />
                    <StatusRow
                      label="Missing"
                      count={selected.missing}
                      total={selected.total}
                      color="#f87171"
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
                            color: qualityToAccent(
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
                                  ? qualityToAccent(
                                      selected.avgQuality,
                                      selected.pctReviewed,
                                    )
                                  : '#2a2a4a',
                              fill:
                                si < Math.round(selected.avgQuality!)
                                  ? qualityToAccent(
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
                    <TrendChart
                      snapshots={historyMap[selected.moduleId]}
                      accentColor={qualityToAccent(selected.avgQuality, selected.pctReviewed)}
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
        <div className="bg-surface border border-[#f87171]/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f87171]" />
            <span className="text-xs font-semibold text-[#f87171] uppercase tracking-wider">
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
                <XCircle className="w-3.5 h-3.5 text-[#f87171] flex-shrink-0" />
                <span className="text-xs text-text font-medium flex-1">
                  {m.label}
                </span>
                <div className="flex items-center gap-px">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className="w-2.5 h-2.5"
                      style={{
                        color: i < Math.round(m.avgQuality!) ? '#f87171' : '#2a2a4a',
                        fill: i < Math.round(m.avgQuality!) ? '#f87171' : 'none',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-[#f87171] font-medium w-6 text-right">
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
            <Clock className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-wider">
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
                  <Clock className="w-3 h-3 text-[#8b5cf6] flex-shrink-0" />
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20"
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
            <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
            <span className="text-xs text-[#4ade80]">
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="bg-surface border border-border rounded-lg p-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs text-text-muted mt-0.5">{sub}</div>
    </motion.div>
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

function MiniSparkline({
  snapshots,
  color,
}: {
  snapshots: ReviewSnapshot[];
  color: string;
}) {
  const qualityPoints = snapshots
    .map((s) => s.avgQuality)
    .filter((q): q is number => q !== null);

  if (qualityPoints.length < 2) return null;

  const w = 48;
  const h = 16;
  const pad = 1;
  const min = Math.max(0, Math.min(...qualityPoints) - 0.5);
  const max = Math.min(5, Math.max(...qualityPoints) + 0.5);
  const range = max - min || 1;

  const points = qualityPoints.map((q, i) => {
    const x = pad + (i / (qualityPoints.length - 1)) * (w - pad * 2);
    const y = h - pad - ((q - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg width={w} height={h} className="mb-1">
      <path
        d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
        fill={color}
        fillOpacity="0.15"
      />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="1.5" fill={color} />
    </svg>
  );
}

function TrendChart({
  snapshots,
  accentColor,
}: {
  snapshots: ReviewSnapshot[];
  accentColor: string;
}) {
  const qualityPoints = snapshots
    .map((s) => ({ q: s.avgQuality, date: s.reviewedAt }))
    .filter((p): p is { q: number; date: string } => p.q !== null);

  if (qualityPoints.length < 2) return null;

  const w = 160;
  const h = 48;
  const pad = 4;
  const min = Math.max(0, Math.min(...qualityPoints.map((p) => p.q)) - 0.5);
  const max = Math.min(5.5, Math.max(...qualityPoints.map((p) => p.q)) + 0.5);
  const range = max - min || 1;

  const points = qualityPoints.map((p, i) => {
    const x = pad + (i / (qualityPoints.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.q - min) / range) * (h - pad * 2);
    return { x, y, q: p.q, date: p.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const first = qualityPoints[0].q;
  const last = qualityPoints[qualityPoints.length - 1].q;
  const delta = last - first;
  const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const deltaColor = delta > 0.1 ? '#4ade80' : delta < -0.1 ? '#f87171' : 'var(--text-muted)';

  return (
    <div className="mt-1">
      <svg width={w} height={h} className="w-full">
        {/* Reference lines at quality 1-5 */}
        {[1, 2, 3, 4, 5]
          .filter((v) => v >= min && v <= max)
          .map((v) => {
            const y = h - pad - ((v - min) / range) * (h - pad * 2);
            return (
              <line key={v} x1={pad} y1={y} x2={w - pad} y2={y} stroke="var(--border)" strokeWidth="0.5" />
            );
          })}
        {/* Area fill */}
        <defs>
          <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
          fill="url(#trend-grad)"
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={accentColor}>
            <title>{`${new Date(p.date).toLocaleDateString()}: ${p.q}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-2xs text-text-muted">{qualityPoints.length} reviews</span>
        <span className="text-2xs font-medium" style={{ color: deltaColor }}>
          {deltaStr} since first
        </span>
      </div>
    </div>
  );
}
