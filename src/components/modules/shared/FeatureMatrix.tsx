'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Check, ChevronDown, ChevronRight, FileCode, Loader2, RefreshCw, Star, ArrowRight, Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Link2, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, Play, Copy, Eye, LayoutList, LayoutGrid } from 'lucide-react';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { FetchError } from './FetchError';
import { useProjectStore } from '@/stores/projectStore';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import type { DependencyInfo, ResolvedDependency } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { MarkdownProse } from '@/components/ui/MarkdownProse';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
import { FEATURE_STATUS_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, STATUS_LIME, STATUS_SUCCESS, OPACITY_10 } from '@/lib/chart-colors';

const STATUS_CONFIG: Record<FeatureStatus, { color: string; bg: string; label: string }> = {
  implemented: { color: FEATURE_STATUS_COLORS.implemented, bg: FEATURE_STATUS_COLORS.implemented + OPACITY_10, label: 'Implemented' },
  improved: { color: FEATURE_STATUS_COLORS.improved, bg: FEATURE_STATUS_COLORS.improved + OPACITY_10, label: 'Improved' },
  partial: { color: FEATURE_STATUS_COLORS.partial, bg: FEATURE_STATUS_COLORS.partial + OPACITY_10, label: 'Partial' },
  missing: { color: FEATURE_STATUS_COLORS.missing, bg: FEATURE_STATUS_COLORS.missing + OPACITY_10, label: 'Missing' },
  unknown: { color: FEATURE_STATUS_COLORS.unknown, bg: 'var(--border)', label: 'Unknown' },
};

const STAR_COLORS = [
  '',             // 0 — unused
  STATUS_ERROR,   // 1 — red
  STATUS_BLOCKER, // 2 — orange
  STATUS_WARNING, // 3 — amber
  STATUS_LIME,    // 4 — lime
  STATUS_SUCCESS, // 5 — green
];

type SortKey = 'name' | 'status' | 'quality' | 'reviewed';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grouped' | 'flat';

const STATUS_ORDER: Record<FeatureStatus, number> = {
  missing: 0,
  unknown: 1,
  partial: 2,
  implemented: 3,
  improved: 4,
};

/** Read filter/sort state from URL search params */
function readUrlParams(): {
  search?: string;
  statuses?: FeatureStatus[];
  qualityMin?: number;
  qualityMax?: number;
  sortKey?: SortKey;
  sortDir?: SortDir;
  viewMode?: ViewMode;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: ReturnType<typeof readUrlParams> = {};

  const q = params.get('q');
  if (q) result.search = q;

  const st = params.get('status');
  if (st) {
    const valid = st.split(',').filter((s): s is FeatureStatus =>
      ['implemented', 'improved', 'partial', 'missing', 'unknown'].includes(s)
    );
    if (valid.length > 0) result.statuses = valid;
  }

  const qMin = params.get('qmin');
  const qMax = params.get('qmax');
  if (qMin) { const n = parseInt(qMin); if (n >= 1 && n <= 5) result.qualityMin = n; }
  if (qMax) { const n = parseInt(qMax); if (n >= 1 && n <= 5) result.qualityMax = n; }

  const sk = params.get('sort');
  if (sk && ['name', 'status', 'quality', 'reviewed'].includes(sk)) result.sortKey = sk as SortKey;

  const sd = params.get('dir');
  if (sd && ['asc', 'desc'].includes(sd)) result.sortDir = sd as SortDir;

  const vm = params.get('view');
  if (vm && ['grouped', 'flat'].includes(vm)) result.viewMode = vm as ViewMode;

  return result;
}

/** Write filter/sort state to URL search params (replaceState, no navigation) */
function writeUrlParams(state: {
  search: string;
  statuses: FeatureStatus[];
  qualityMin: number;
  qualityMax: number;
  sortKey: SortKey;
  sortDir: SortDir;
  viewMode: ViewMode;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);

  // Only write non-default values
  if (state.search) params.set('q', state.search);
  else params.delete('q');

  const allStatuses = state.statuses.length === 5;
  if (!allStatuses) params.set('status', state.statuses.join(','));
  else params.delete('status');

  if (state.qualityMin > 1) params.set('qmin', String(state.qualityMin));
  else params.delete('qmin');

  if (state.qualityMax < 5) params.set('qmax', String(state.qualityMax));
  else params.delete('qmax');

  if (state.sortKey !== 'name' || state.sortDir !== 'asc') {
    params.set('sort', state.sortKey);
    params.set('dir', state.sortDir);
  } else {
    params.delete('sort');
    params.delete('dir');
  }

  if (state.viewMode !== 'grouped') params.set('view', state.viewMode);
  else params.delete('view');

  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

interface FeatureMatrixProps {
  moduleId: SubModuleId;
  accentColor: string;
  onReview: () => void;
  onSync?: () => void;
  isReviewing: boolean;
  onFix?: (feature: FeatureRow) => void;
  isFixing?: boolean;
  onReviewFeature?: (feature: FeatureRow) => void;
}

export function FeatureMatrix({ moduleId, accentColor, onReview, onSync, isReviewing, onFix, isFixing, onReviewFeature }: FeatureMatrixProps) {
  const { features, summary, isLoading, error, retry, refetch } = useFeatureMatrix(moduleId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [snapshots, setSnapshots] = useState<ReviewSnapshot[]>([]);
  const [allStatuses, setAllStatuses] = useState<Map<string, string>>(new Map());
  const [reviewProgress, setReviewProgress] = useState<{ scanned: number; total: number } | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Filter / sort / search state — initialize from URL params
  const urlInit = useMemo(() => readUrlParams(), []);
  const [searchQuery, setSearchQuery] = useState(urlInit.search ?? '');
  const [qualityMin, setQualityMin] = useState(urlInit.qualityMin ?? 1);
  const [qualityMax, setQualityMax] = useState(urlInit.qualityMax ?? 5);
  const [sortKey, setSortKey] = useState<SortKey>(urlInit.sortKey ?? 'name');
  const [sortDir, setSortDir] = useState<SortDir>(urlInit.sortDir ?? 'asc');
  const [activeFilters, setActiveFilters] = useState<Set<FeatureStatus>>(
    new Set<FeatureStatus>(urlInit.statuses ?? ['implemented', 'improved', 'partial', 'missing', 'unknown'])
  );
  const [viewMode, setViewMode] = useState<ViewMode>(urlInit.viewMode ?? 'grouped');

  // Auto-switch to flat view when non-default sort is active
  useEffect(() => {
    const isNonDefaultSort = sortKey !== 'name' || sortDir !== 'asc';
    if (isNonDefaultSort && viewMode === 'grouped') {
      setViewMode('flat');
    }
  }, [sortKey, sortDir, viewMode]);

  // Sync filter/sort state to URL params
  useEffect(() => {
    writeUrlParams({
      search: searchQuery,
      statuses: Array.from(activeFilters) as FeatureStatus[],
      qualityMin,
      qualityMax,
      sortKey,
      sortDir,
      viewMode,
    });
  }, [searchQuery, activeFilters, qualityMin, qualityMax, sortKey, sortDir, viewMode]);

  // Poll review progress while reviewing — pauses when module is suspended
  useSuspendableEffect(() => {
    if (!isReviewing || !projectPath) {
      setReviewProgress(null);
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const params = new URLSearchParams({ moduleId, projectPath });
        const res = await fetch(`/api/feature-matrix/progress?${params}`);
        if (res.ok) {
          const data = await res.json();
          setReviewProgress({ scanned: data.scanned ?? 0, total: data.total ?? 0 });
        }
      } catch { /* silent */ }
    };

    // Start polling after a brief delay (CLI needs time to start)
    const startTimeout = setTimeout(() => {
      poll();
      progressTimer.current = setInterval(poll, 3000);
    }, 2000);

    return () => {
      clearTimeout(startTimeout);
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    };
  }, [isReviewing, moduleId, projectPath]);

  // Auto-refetch while a fix CLI is running — the CLI will PATCH the status to
  // 'improved' via curl. Polling picks up the change so the UI updates in real-time.
  // Pauses when module is suspended (hidden in LRU).
  useSuspendableEffect(() => {
    if (!isFixing) return;
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [isFixing, refetch]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/feature-matrix/history?moduleId=${encodeURIComponent(moduleId)}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots ?? []);
      }
    } catch { /* silent */ }
  }, [moduleId]);

  // Fetch all module statuses for cross-module dependency resolution
  const fetchAllStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/feature-matrix/all-statuses');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const row of data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setAllStatuses(map);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchAllStatuses(); }, [fetchAllStatuses]);

  // Compute dependency info for all features in this module
  const depMap = useMemo(() => {
    const base = buildDependencyMap();
    // Merge current module's live features into status map (they're fresher than allStatuses)
    const merged = new Map(allStatuses);
    for (const f of features) {
      merged.set(`${f.moduleId}::${f.featureName}`, f.status);
    }
    return computeBlockers(base, merged);
  }, [allStatuses, features]);

  const toggleRow = (featureName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(featureName)) next.delete(featureName);
      else next.add(featureName);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleFilter = (status: FeatureStatus) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        // Don't allow deactivating all chips
        if (next.size > 1) next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Filter features: status chips → text search → quality range
  const filtered = useMemo(() => {
    let list = features.filter((f) => activeFilters.has(f.status));

    // Text search across feature name, description, review notes, and file paths
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.featureName.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.reviewNotes.toLowerCase().includes(q) ||
          f.filePaths.some((fp) => fp.toLowerCase().includes(q))
      );
    }

    // Quality score range filter
    if (qualityMin > 1 || qualityMax < 5) {
      list = list.filter((f) => {
        if (f.qualityScore === null) return false; // unscored items hidden when quality filter active
        return f.qualityScore >= qualityMin && f.qualityScore <= qualityMax;
      });
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.featureName.localeCompare(b.featureName);
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'quality':
          cmp = (a.qualityScore ?? 0) - (b.qualityScore ?? 0);
          break;
        case 'reviewed': {
          const aT = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
          const bT = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
          cmp = aT - bT;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [features, activeFilters, searchQuery, qualityMin, qualityMax, sortKey, sortDir]);

  // Group by category
  const grouped = filtered.reduce<Record<string, FeatureRow[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  const lastReviewed = features.find((f) => f.lastReviewedAt)?.lastReviewedAt;
  const neverReviewed = features.length > 0 && features.every((f) => f.status === 'unknown' && !f.lastReviewedAt);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={retry} />;
  }

  if (neverReviewed) {
    return (
      <div className="flex items-center justify-center py-10">
        <div
          className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl max-w-sm"
          style={{
            border: `1.5px dashed ${accentColor}38`,
            backgroundColor: `${accentColor}14`,
          }}
        >
          <RefreshCw className="w-8 h-8" style={{ color: accentColor, opacity: 0.7 }} />

          <h3 className="text-sm font-semibold text-text">No review yet</h3>

          <p className="text-xs text-text-muted text-center leading-relaxed">
            Claude will scan your project source files, evaluate each feature&apos;s implementation status, and assign quality scores with actionable next steps.
          </p>

          <span className="text-xs text-text-muted">
            {features.length} feature{features.length !== 1 ? 's' : ''} to analyze
          </span>

          <button
            onClick={onReview}
            disabled={isReviewing}
            className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:brightness-110"
            style={{
              backgroundColor: `${accentColor}24`,
              color: accentColor,
              border: `1px solid ${accentColor}38`,
            }}
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Review with Claude
              </>
            )}
          </button>

          {isReviewing && reviewProgress && reviewProgress.total > 0 && (
            <ReviewProgressBar
              scanned={reviewProgress.scanned}
              total={reviewProgress.total}
              accentColor={accentColor}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar + Sparkline + Review button */}
      <div className="flex items-center gap-4">
        <SummaryBar summary={summary} />
        {snapshots.length >= 2 && (
          <QualitySparkline snapshots={snapshots} accentColor={accentColor} />
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastReviewed && (() => {
            const { label, dotColor, isOutdated } = formatRelativeTime(lastReviewed);
            return (
              <span className="flex items-center gap-1.5 text-xs text-text-muted" title={new Date(lastReviewed).toLocaleString()}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                {label}
                {isOutdated && (
                  <span className="text-2xs text-[#f87171]/70 font-medium">outdated</span>
                )}
              </span>
            );
          })()}
          {onSync && (
            <button
              onClick={async () => {
                setIsSyncing(true);
                try {
                  await onSync();
                  await refetch();
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 text-text-muted-hover hover:text-[#d0d4e8] bg-border hover:bg-[#2a2a4a] border border-[#2a2a4a]"
              title="Import latest review from disk"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
            </button>
          )}
          <button
            onClick={onReview}
            disabled={isReviewing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${accentColor}24`,
              color: accentColor,
              border: `1px solid ${accentColor}38`,
            }}
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Review with Claude
              </>
            )}
          </button>
        </div>
      </div>

      {/* Review progress bar */}
      {isReviewing && reviewProgress && reviewProgress.total > 0 && (
        <ReviewProgressBar
          scanned={reviewProgress.scanned}
          total={reviewProgress.total}
          accentColor={accentColor}
        />
      )}

      {/* Status filter chips */}
      <StatusFilterChips summary={summary} activeFilters={activeFilters} onToggle={toggleFilter} />

      {/* Search + Quality filter + Sort controls — sticky header */}
      <div className="flex items-center gap-3 flex-wrap sticky top-0 z-10 bg-background py-2 -mt-2">
        {/* Text search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search features, notes, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface-deep border border-border text-xs text-text placeholder-text-muted focus:outline-none focus:border-[#3b3b6a] transition-colors"
          />
        </div>

        {/* Quality score range */}
        <QualityRangeFilter min={qualityMin} max={qualityMax} onMinChange={setQualityMin} onMaxChange={setQualityMax} />

        {/* Sort toggles */}
        <div className="flex items-center gap-1">
          <SortButton label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
          <SortButton label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
          <SortButton label="Quality" sortKey="quality" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
          <SortButton label="Reviewed" sortKey="reviewed" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={`p-1 rounded transition-colors ${viewMode === 'grouped' ? 'bg-border text-text' : 'text-text-muted hover:text-text'}`}
            title="Grouped by category"
          >
            <LayoutGrid className="w-3 h-3" />
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`p-1 rounded transition-colors ${viewMode === 'flat' ? 'bg-border text-text' : 'text-text-muted hover:text-text'}`}
            title="Flat sorted list"
          >
            <LayoutList className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Result count */}
      {(searchQuery || qualityMin > 1 || qualityMax < 5) && (
        <div className="text-xs text-text-muted">
          Showing {filtered.length} of {features.length} features
        </div>
      )}

      {/* Feature table — grouped or flat based on viewMode */}
      <div className="space-y-1">
        {viewMode === 'flat' ? (
          /* Flat sorted list — no category grouping */
          <StaggerContainer className="space-y-px">
            {filtered.map((feature) => {
              const featureKey = `${feature.moduleId}::${feature.featureName}`;
              const depInfo = depMap.get(featureKey);
              return (
                <StaggerItem key={feature.featureName}>
                  <FeatureRowItem
                    feature={feature}
                    isExpanded={expandedRows.has(feature.featureName)}
                    onToggle={() => toggleRow(feature.featureName)}
                    depInfo={depInfo}
                    onFix={onFix}
                    isFixing={isFixing}
                    onReviewFeature={onReviewFeature}
                    accentColor={accentColor}
                    showCategory
                  />
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        ) : (
          /* Grouped by category */
          categories.map((cat) => {
            const catFeatures = grouped[cat];
            const isCollapsed = collapsedCategories.has(cat);
            const catImplemented = catFeatures.filter((f) => f.status === 'implemented' || f.status === 'improved').length;

            return (
              <div key={cat}>
                {/* Category header — sticky within scroll */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors sticky top-[40px] z-[5] bg-background"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-text-muted-hover" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-text-muted-hover" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {cat}
                  </span>
                  <span className="text-2xs text-text-muted">
                    {catImplemented}/{catFeatures.length}
                  </span>
                </button>

                {/* Feature rows */}
                {!isCollapsed && (
                  <StaggerContainer className="ml-2 space-y-px">
                    {catFeatures.map((feature) => {
                      const featureKey = `${feature.moduleId}::${feature.featureName}`;
                      const depInfo = depMap.get(featureKey);
                      return (
                        <StaggerItem key={feature.featureName}>
                          <FeatureRowItem
                            feature={feature}
                            isExpanded={expandedRows.has(feature.featureName)}
                            onToggle={() => toggleRow(feature.featureName)}
                            depInfo={depInfo}
                            onFix={onFix}
                            isFixing={isFixing}
                            onReviewFeature={onReviewFeature}
                            accentColor={accentColor}
                          />
                        </StaggerItem>
                      );
                    })}
                  </StaggerContainer>
                )}
              </div>
            );
          })
        )}
      </div>

      {filtered.length === 0 && features.length > 0 && (
        <p className="text-xs text-text-muted-hover text-center py-8">
          No features match your filters.
        </p>
      )}
      {features.length === 0 && (
        <p className="text-xs text-text-muted-hover text-center py-8">
          No features defined for this module.
        </p>
      )}
    </div>
  );
}

// --- Sub-components ---

function QualityRangeFilter({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const isActive = min > 1 || max < 5;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all"
      style={{
        backgroundColor: isActive ? '#fbbf2418' : 'transparent',
        border: isActive ? '1px solid #fbbf2440' : '1px solid var(--border)',
      }}
    >
      <Star className="w-3 h-3 text-[#fbbf24] flex-shrink-0" style={{ fill: isActive ? '#fbbf24' : 'none' }} />
      <select
        value={min}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onMinChange(v);
          if (v > max) onMaxChange(v);
        }}
        className="bg-transparent text-text text-xs outline-none cursor-pointer [&>option]:bg-surface-hover"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="text-text-muted">-</span>
      <select
        value={max}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          onMaxChange(v);
          if (v < min) onMinChange(v);
        }}
        className="bg-transparent text-text text-xs outline-none cursor-pointer [&>option]:bg-surface-hover"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}

function SortButton({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = currentKey === key;
  const SortDirIcon = isActive ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      onClick={() => onToggle(key)}
      className="flex items-center gap-1 px-1.5 py-1 rounded text-xs font-medium transition-all"
      style={{
        color: isActive ? 'var(--text)' : 'var(--text-muted)',
        backgroundColor: isActive ? 'var(--border)' : 'transparent',
      }}
    >
      {label}
      <SortDirIcon className="w-3 h-3" style={{ opacity: isActive ? 1 : 0.4 }} />
    </button>
  );
}

function formatRelativeTime(dateStr: string): { label: string; dotColor: string; isOutdated: boolean } {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);

  let label: string;
  if (minutes < 1) label = 'just now';
  else if (minutes < 60) label = `${minutes}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else if (days < 30) label = `${days}d ago`;
  else {
    const months = Math.floor(days / 30);
    label = months === 1 ? '1 month ago' : `${months} months ago`;
  }

  // Green <24h, amber 1-7d, red >7d
  const dotColor = hours < 24 ? '#4ade80' : days <= 7 ? '#fbbf24' : '#f87171';
  const isOutdated = days > 7;

  return { label, dotColor, isOutdated };
}

function SummaryBar({ summary }: { summary: { total: number; implemented: number; improved: number; partial: number; missing: number; unknown: number } }) {
  if (summary.total === 0) return null;

  const segments: { status: FeatureStatus; count: number }[] = [
    { status: 'improved', count: summary.improved },
    { status: 'implemented', count: summary.implemented },
    { status: 'partial', count: summary.partial },
    { status: 'missing', count: summary.missing },
    { status: 'unknown', count: summary.unknown },
  ];

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {segments.map((s) =>
            s.count > 0 ? (
              <span key={s.status} className="flex items-center gap-1 text-2xs" style={{ color: STATUS_CONFIG[s.status].color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s.status].color }} />
                {s.count} {STATUS_CONFIG[s.status].label.toLowerCase()}
              </span>
            ) : null
          )}
        </div>
        <span className="text-xs text-text-muted-hover">
          {summary.implemented + summary.improved}/{summary.total}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden flex">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.status}
              className="h-full transition-all duration-slow"
              style={{
                width: `${(s.count / summary.total) * 100}%`,
                backgroundColor: STATUS_CONFIG[s.status].color,
                opacity: 0.8,
              }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function StatusFilterChips({
  summary,
  activeFilters,
  onToggle,
}: {
  summary: { total: number; implemented: number; improved: number; partial: number; missing: number; unknown: number };
  activeFilters: Set<FeatureStatus>;
  onToggle: (status: FeatureStatus) => void;
}) {
  if (summary.total === 0) return null;

  const statuses: FeatureStatus[] = ['improved', 'implemented', 'partial', 'missing', 'unknown'];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {statuses.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const count = summary[status];
        const isActive = activeFilters.has(status);

        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={
              isActive
                ? {
                    backgroundColor: `${cfg.color}20`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}50`,
                  }
                : {
                    backgroundColor: 'transparent',
                    color: `${cfg.color}80`,
                    border: `1px solid ${cfg.color}25`,
                  }
            }
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isActive ? cfg.color : `${cfg.color}50`,
              }}
            />
            {cfg.label}
            <span style={{ opacity: 0.7 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function QualitySparkline({
  snapshots,
  accentColor,
}: {
  snapshots: ReviewSnapshot[];
  accentColor: string;
}) {
  const qualityPoints = snapshots
    .map((s) => s.avgQuality)
    .filter((q): q is number => q !== null);

  if (qualityPoints.length < 2) return null;

  const w = 64;
  const h = 24;
  const pad = 2;
  const min = Math.max(0, Math.min(...qualityPoints) - 0.5);
  const max = Math.min(5, Math.max(...qualityPoints) + 0.5);
  const range = max - min || 1;

  const points = qualityPoints.map((q, i) => {
    const x = pad + (i / (qualityPoints.length - 1)) * (w - pad * 2);
    const y = h - pad - ((q - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Trend: compare last vs first
  const first = qualityPoints[0];
  const last = qualityPoints[qualityPoints.length - 1];
  const trend = last - first;
  const TrendIcon = trend > 0.2 ? TrendingUp : trend < -0.2 ? TrendingDown : Minus;
  const trendColor = trend > 0.2 ? '#4ade80' : trend < -0.2 ? '#f87171' : 'var(--text-muted)';

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" title={`Quality trend: ${qualityPoints.map((q) => q.toFixed(1)).join(' → ')}`}>
      <svg width={w} height={h} className="flex-shrink-0">
        {/* Gradient fill under the line */}
        <defs>
          <linearGradient id={`spark-grad-${accentColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path
          d={`${pathD} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`}
          fill={`url(#spark-grad-${accentColor.replace('#', '')})`}
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Endpoint dot */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={accentColor} />
      </svg>
      <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
    </div>
  );
}

function QualityStars({ score }: { score: number | null }) {
  if (score === null || score === 0) return null;
  const clamped = Math.min(5, Math.max(1, score));
  const color = STAR_COLORS[clamped];

  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <span className="flex items-center gap-px">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className="w-3 h-3"
            style={{
              color: i < clamped ? color : '#3a3a5a',
              fill: i < clamped ? color : 'none',
            }}
          />
        ))}
      </span>
      <span className="text-2xs text-text-muted-hover">{clamped}/5</span>
    </span>
  );
}

function FeatureRowItem({
  feature,
  isExpanded,
  onToggle,
  depInfo,
  onFix,
  isFixing,
  onReviewFeature,
  accentColor,
  showCategory,
}: {
  feature: FeatureRow;
  isExpanded: boolean;
  onToggle: () => void;
  depInfo?: DependencyInfo;
  onFix?: (feature: FeatureRow) => void;
  isFixing?: boolean;
  onReviewFeature?: (feature: FeatureRow) => void;
  accentColor: string;
  showCategory?: boolean;
}) {
  const cfg = STATUS_CONFIG[feature.status];
  const hasDeps = depInfo && depInfo.deps.length > 0;
  const isBlocked = depInfo?.isBlocked ?? false;
  const hasDetails = feature.reviewNotes || feature.filePaths.length > 0 || feature.nextSteps || hasDeps;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${feature.featureName} — ${cfg.label}${feature.qualityScore ? ` (${feature.qualityScore}/5)` : ''}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [feature.featureName, cfg.label, feature.qualityScore]);

  const handleReview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReviewFeature?.(feature);
  }, [onReviewFeature, feature]);

  const handleViewFiles = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Expand the row to reveal file paths
    if (!isExpanded) onToggle();
  }, [isExpanded, onToggle]);

  return (
    <div
      className="group/row rounded-md overflow-hidden"
      style={{ borderLeft: `4px solid ${cfg.color}` }}
    >
      <button
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
          hasDetails ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'
        } ${isExpanded ? 'bg-[#111130]' : ''}`}
      >
        {/* Status dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        {/* Feature name */}
        <span className="text-sm text-[#d0d4e8] flex-1 min-w-0 truncate">
          {feature.featureName}
        </span>

        {/* Inline category badge (flat view only) */}
        {showCategory && (
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-surface-hover text-text-muted flex-shrink-0">
            {feature.category}
          </span>
        )}

        {/* Description (truncated) */}
        <span className="text-xs text-text-muted-hover flex-1 min-w-0 truncate hidden sm:block">
          {feature.description}
        </span>

        {/* Hover action buttons */}
        <span className="flex items-center gap-0.5 flex-shrink-0 opacity-30 scale-95 group-hover/row:opacity-100 group-hover/row:scale-100 transition-all">
          {onReviewFeature && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleReview}
              onKeyDown={(e) => { if (e.key === 'Enter') handleReview(e as unknown as React.MouseEvent); }}
              className="p-1 rounded hover:bg-surface-hover transition-colors"
              style={{ color: accentColor }}
              title="Review this feature with Claude"
            >
              <Play className="w-3 h-3" />
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={handleCopy}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(e as unknown as React.MouseEvent); }}
            className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
            title={copied ? 'Copied!' : 'Copy feature name & status'}
          >
            {copied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
          </span>
          {feature.filePaths.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleViewFiles}
              onKeyDown={(e) => { if (e.key === 'Enter') handleViewFiles(e as unknown as React.MouseEvent); }}
              className="p-1 rounded hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
              title="View source files"
            >
              <Eye className="w-3 h-3" />
            </span>
          )}
        </span>

        {/* Blocked badge */}
        {isBlocked && feature.status !== 'implemented' && (
          <span
            className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium bg-[#f8717118] text-[#fb923c]"
            title={`Blocked by: ${depInfo!.blockers.map((b) => b.featureName).join(', ')}`}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            blocked
          </span>
        )}

        {/* Dependency count */}
        {hasDeps && !isBlocked && (
          <span
            className="flex items-center gap-0.5 text-2xs text-text-muted flex-shrink-0"
            title={`Depends on ${depInfo!.deps.length} feature${depInfo!.deps.length > 1 ? 's' : ''}`}
          >
            <Link2 className="w-2.5 h-2.5" />
            {depInfo!.deps.length}
          </span>
        )}

        {/* Quality stars */}
        <QualityStars score={feature.qualityScore} />

        {/* File count badge */}
        {feature.filePaths.length > 0 && (
          <span className="flex items-center gap-0.5 text-2xs text-text-muted-hover flex-shrink-0">
            <FileCode className="w-3 h-3" />
            {feature.filePaths.length}
          </span>
        )}

        {/* Status badge */}
        <span
          className="text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label.toLowerCase()}
        </span>

        {/* Expand chevron */}
        {hasDetails && (
          isExpanded
            ? <ChevronDown className="w-3 h-3 text-text-muted-hover flex-shrink-0" />
            : <ChevronRight className="w-3 h-3 text-text-muted-hover flex-shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && hasDetails && (
        <div className="px-8 pb-3 pt-1 space-y-3 bg-[#111130]">
          {/* Dependency chain */}
          {hasDeps && (
            <DependencyChain depInfo={depInfo!} currentModuleId={feature.moduleId} />
          )}

          {/* Review notes */}
          {feature.reviewNotes && (
            <MarkdownProse content={feature.reviewNotes} className="leading-relaxed" />
          )}

          {/* Next steps */}
          {feature.nextSteps && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3 text-text-muted" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Next steps to pro
                </span>
              </div>
              <MarkdownProse content={feature.nextSteps} className="leading-relaxed pl-[18px] text-[#b0b4cc]" />
              {onFix && feature.status !== 'improved' && !(feature.status === 'implemented' && feature.qualityScore === 5 && !feature.nextSteps?.trim()) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFix(feature);
                  }}
                  disabled={isFixing}
                  className="ml-[18px] mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 bg-[#4ade8015] text-[#4ade80] border border-[#4ade80]/20 hover:bg-[#4ade8025]"
                >
                  {isFixing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Fixing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Implement This
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* File paths */}
          {feature.filePaths.length > 0 && (
            <div className="space-y-0.5">
              {feature.filePaths.map((fp) => (
                <div key={fp} className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
                  <FileCode className="w-3 h-3 flex-shrink-0" />
                  {fp}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewProgressBar({
  scanned,
  total,
  accentColor,
}: {
  scanned: number;
  total: number;
  accentColor: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {scanned}/{total} features scanned
        </span>
        <span className="text-xs text-text-muted">{pct}%</span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-slow ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: accentColor,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

function DependencyChain({
  depInfo,
  currentModuleId,
}: {
  depInfo: DependencyInfo;
  currentModuleId: string;
}) {
  const blockerKeys = new Set(depInfo.blockers.map((b) => b.key));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-text-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Dependencies
        </span>
        {depInfo.isBlocked && (
          <span className="text-2xs text-[#fb923c]">
            ({depInfo.blockers.length} not implemented)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 pl-[18px]">
        {depInfo.deps.map((dep) => {
          const isBlocker = blockerKeys.has(dep.key);
          const isCrossModule = dep.moduleId !== currentModuleId;
          const modLabel = MODULE_LABELS[dep.moduleId] ?? dep.moduleId;

          return (
            <span
              key={dep.key}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${
                isBlocker
                  ? 'bg-[#f8717110] border-[#f87171]/30 text-[#fb923c]'
                  : 'bg-[#4ade8010] border-[#4ade80]/20 text-[#4ade80]'
              }`}
            >
              {isBlocker && <AlertTriangle className="w-2.5 h-2.5" />}
              {isCrossModule && (
                <span className="text-text-muted-hover text-2xs">{modLabel}/</span>
              )}
              {dep.featureName}
            </span>
          );
        })}
      </div>
    </div>
  );
}
