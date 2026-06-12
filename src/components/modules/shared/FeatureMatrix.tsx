'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Check, ChevronDown, ChevronRight, FileCode, Loader2, RefreshCw, Star, ArrowRight, Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Link2, Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, Play, Copy, Eye, LayoutList, LayoutGrid, ShieldCheck, Boxes, CheckCircle, Sparkles, CircleDashed, Circle, HelpCircle } from 'lucide-react';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { AccentButton } from '@/components/ui/AccentButton';
import { FetchError } from './FetchError';
import { useProjectStore } from '@/stores/projectStore';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { buildDependencyMap, computeBlockers, moduleNeedsBinaryContent, getWiringAssets } from '@/lib/feature-definitions';
import type { DependencyInfo, ResolvedDependency } from '@/lib/feature-definitions';
import { WiringAssetsPanel } from './WiringAssetsPanel';
import { MODULE_LABELS } from '@/lib/module-registry';
import { MarkdownProse } from '@/components/ui/MarkdownProse';
import { tryApiFetch } from '@/lib/api-utils';
import { formatTimeAgo } from '@/lib/format-time';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
import { FEATURE_STATUS_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, STATUS_LIME, STATUS_SUCCESS, STATUS_NEUTRAL, STATUS_IMPROVED, ACCENT_CYAN_LIGHT, OPACITY_10, OPACITY_12, statusBg, statusBorder } from '@/lib/chart-colors';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import type { VerificationResult } from '@/types/pof-bridge';
import { slugifyForTestId } from '@/lib/test-ids';

// Single source of truth for feature-status presentation. Status is encoded by
// SHAPE (a distinct lucide glyph) as well as color, so the matrix stays legible
// to colorblind users (WCAG 1.4.1 — color is never the sole visual cue). Every
// surface (summary legend, filter chips, feature rows) reads `icon` from here,
// so adding/changing a glyph updates them all together.
const STATUS_CONFIG: Record<FeatureStatus, { color: string; bg: string; label: string; plain: string; action: string; icon: typeof CheckCircle }> = {
  implemented: { color: FEATURE_STATUS_COLORS.implemented, bg: FEATURE_STATUS_COLORS.implemented + OPACITY_10, label: 'Implemented', plain: 'Fully built and ready to use', action: 'Review for quality improvements', icon: CheckCircle },
  improved: { color: FEATURE_STATUS_COLORS.improved, bg: FEATURE_STATUS_COLORS.improved + OPACITY_10, label: 'Improved', plain: 'Built and recently enhanced', action: 'Verify improvements work as expected', icon: Sparkles },
  partial: { color: FEATURE_STATUS_COLORS.partial, bg: FEATURE_STATUS_COLORS.partial + OPACITY_10, label: 'Partial', plain: 'Partially built — some work still needed', action: 'Continue implementation to complete', icon: CircleDashed },
  missing: { color: FEATURE_STATUS_COLORS.missing, bg: FEATURE_STATUS_COLORS.missing + OPACITY_10, label: 'Missing', plain: 'Not yet built — needs implementation', action: 'Start building this feature', icon: Circle },
  unknown: { color: FEATURE_STATUS_COLORS.unknown, bg: 'var(--border)', label: 'Unknown', plain: 'Not yet reviewed — status unclear', action: 'Run a scan to determine status', icon: HelpCircle },
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
      (FEATURE_STATUSES as readonly string[]).includes(s)
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
  const { features, summary, isLoading, error, retry, refetch, runAutoVerify, isVerifying, verificationResults } = useFeatureMatrix(moduleId);
  const projectPath = useProjectStore((s) => s.projectPath);
  const bridgeConnected = usePofBridgeStore((s) => s.connectionStatus === 'connected');
  const needsBinaryContent = useMemo(() => moduleNeedsBinaryContent(moduleId), [moduleId]);
  const wiringAssets = useMemo(() => getWiringAssets(moduleId), [moduleId]);
  const [showWiring, setShowWiring] = useState(false);

  // Build a lookup map for verification results by feature name
  const verificationMap = useMemo(() => {
    const map = new Map<string, VerificationResult>();
    for (const r of verificationResults) {
      map.set(r.featureName, r);
    }
    return map;
  }, [verificationResults]);
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
    new Set<FeatureStatus>(urlInit.statuses ?? FEATURE_STATUSES)
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

  // Fetch all module statuses for cross-module dependency resolution.
  // The route wraps the payload in apiSuccess({ statuses }); tryApiFetch unwraps
  // the envelope so the array isn't silently read from the wrong nesting level
  // (which left the cross-module blocked badges / dependency chains empty).
  const fetchAllStatuses = useCallback(async () => {
    const result = await tryApiFetch<{ statuses: { moduleId: string; featureName: string; status: string }[] }>('/api/feature-matrix/all-statuses');
    if (!result.ok) return; // silent — keep last-known statuses
    const map = new Map<string, string>();
    for (const row of result.data.statuses ?? []) {
      map.set(`${row.moduleId}::${row.featureName}`, row.status);
    }
    setAllStatuses(map);
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
    return <FeatureMatrixSkeleton />;
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

          <AccentButton
            data-testid="pof-feature-matrix-scan-btn"
            onClick={onReview}
            disabled={isReviewing}
            loading={isReviewing}
            accentColor={accentColor}
            size="md"
            className="mt-1"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            loadingLabel={<>Reviewing...</>}
          >
            Review with Claude
          </AccentButton>

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
        {needsBinaryContent && (
          <button
            type="button"
            onClick={() => setShowWiring((v) => !v)}
            aria-expanded={showWiring}
            className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium transition-colors"
            style={{
              backgroundColor: statusBg(STATUS_WARNING),
              color: STATUS_WARNING,
              border: `1px solid ${statusBorder(STATUS_WARNING)}`,
            }}
            title="This module depends on binary content (Widget/Animation Blueprint or Behavior Tree) that cannot be generated from code — it must be authored in the editor. Click to list it."
          >
            <Boxes className="w-3 h-3" />
            needs binary content
            {showWiring ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
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
                  <span className="text-2xs font-medium" style={{ color: STATUS_ERROR, opacity: 0.7 }}>outdated</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 text-text-muted-hover hover:text-text bg-border hover:bg-surface-hover border border-border"
              title="Import latest review from disk"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
            </button>
          )}
          {bridgeConnected && (
            <button
              onClick={runAutoVerify}
              disabled={isVerifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: statusBg(STATUS_SUCCESS),
                color: STATUS_SUCCESS,
                border: `1px solid ${statusBorder(STATUS_SUCCESS)}`,
              }}
              title="Auto-verify features against UE5 asset manifest"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3" />
                  Auto-Verify
                </>
              )}
            </button>
          )}
          <AccentButton
            data-testid="pof-feature-matrix-scan-btn"
            onClick={onReview}
            disabled={isReviewing}
            loading={isReviewing}
            accentColor={accentColor}
            size="sm"
            leftIcon={<RefreshCw className="w-3 h-3" />}
            loadingLabel={<>Reviewing...</>}
          >
            Review with Claude
          </AccentButton>
        </div>
      </div>

      {showWiring && wiringAssets.length > 0 && (
        <WiringAssetsPanel assets={wiringAssets} />
      )}

      {/* Review progress bar */}
      {isReviewing && reviewProgress && reviewProgress.total > 0 && (
        <ReviewProgressBar
          scanned={reviewProgress.scanned}
          total={reviewProgress.total}
          accentColor={accentColor}
        />
      )}

      {/* Verification results summary — shown after auto-verify */}
      {verificationResults.length > 0 && (
        <VerificationSummaryBanner results={verificationResults} />
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
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-surface-deep border border-border text-xs text-text placeholder-text-muted focus:outline-none focus:border-border-hover transition-colors"
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
                    verificationResult={verificationMap.get(feature.featureName)}
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
                            verificationResult={verificationMap.get(feature.featureName)}
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

/**
 * Content-shaped loading state. Mirrors {@link FeatureRowItem}'s anatomy — a 4px
 * left rail, a status dot, a 150px name bar, a flex-1 description bar, and a
 * trailing badge — so the skeleton→content handoff has no layout shift or empty
 * void. Rows reuse the StaggerContainer entrance rhythm of the real list, and each
 * row's pulse is offset (0/60/120ms) for a downward wave. `animate-pulse` is
 * neutralised by the global prefers-reduced-motion rule, so this is motion-safe.
 */
function FeatureMatrixSkeleton() {
  const ROW_COUNT = 7;
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading feature matrix"
      data-testid="pof-feature-matrix-skeleton"
      className="space-y-4"
    >
      <div aria-hidden="true" className="space-y-4">
        {/* Summary bar + review button placeholders */}
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 rounded bg-border animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-border animate-pulse" />
          </div>
          <div className="h-7 w-32 rounded-md bg-border animate-pulse flex-shrink-0" />
        </div>

        {/* Skeleton rows — same rhythm + anatomy as the real feature list */}
        <StaggerContainer className="space-y-px">
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <StaggerItem key={`skeleton-${i}`}>
              <SkeletonRow delayMs={(i % 3) * 60} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}

function SkeletonRow({ delayMs }: { delayMs: number }) {
  const pulse = { animationDelay: `${delayMs}ms` };
  return (
    <div className="rounded-md overflow-hidden" style={{ borderLeft: '4px solid var(--border)' }}>
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Status dot */}
        <span className="w-2 h-2 rounded-full bg-border animate-pulse flex-shrink-0" style={pulse} />
        {/* Name bar */}
        <span className="h-3 w-[150px] rounded bg-border animate-pulse flex-shrink-0" style={pulse} />
        {/* Description bar (hidden on small screens, mirroring the real row) */}
        <span className="h-3 flex-1 rounded bg-border animate-pulse hidden sm:block" style={pulse} />
        {/* Trailing status badge */}
        <span className="h-4 w-14 rounded bg-border animate-pulse flex-shrink-0" style={pulse} />
      </div>
    </div>
  );
}

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
        backgroundColor: isActive ? statusBg(STATUS_WARNING) : 'transparent',
        border: isActive ? `1px solid ${statusBorder(STATUS_WARNING)}` : '1px solid var(--border)',
      }}
    >
      <Star className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_WARNING, fill: isActive ? STATUS_WARNING : 'none' }} />
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
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);

  const label = formatTimeAgo(dateStr, { extended: true });

  // Green <24h, amber 1-7d, red >7d
  const dotColor = hours < 24 ? STATUS_SUCCESS : days <= 7 ? STATUS_WARNING : STATUS_ERROR;
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
          {segments.map((s) => {
            if (s.count === 0) return null;
            const Glyph = STATUS_CONFIG[s.status].icon;
            return (
              <span key={s.status} className="flex items-center gap-1 text-2xs" style={{ color: STATUS_CONFIG[s.status].color }} title={STATUS_CONFIG[s.status].plain}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[s.status].color }} />
                <Glyph className="w-3 h-3 shrink-0" aria-hidden="true" />
                {s.count} {STATUS_CONFIG[s.status].label.toLowerCase()}
              </span>
            );
          })}
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
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
      {statuses.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const Glyph = cfg.icon;
        const count = summary[status];
        const isActive = activeFilters.has(status);

        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            aria-pressed={isActive}
            title={`${cfg.plain} — ${count} feature${count !== 1 ? 's' : ''}. ${cfg.action}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
            style={{
              // Inactive chips stay readable (opacity 0.6) with a visible border so
              // "deselected" never reads as "disabled" (WCAG 1.4.11 non-text contrast).
              backgroundColor: isActive ? `${cfg.color}${OPACITY_12}` : 'transparent',
              color: cfg.color,
              border: `1px solid ${isActive ? `${cfg.color}66` : `${cfg.color}40`}`,
              opacity: isActive ? 1 : 0.6,
              transition: 'background-color 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out',
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: cfg.color,
                transition: 'transform 200ms ease-out',
                transform: isActive ? 'scale(1)' : 'scale(0.75)',
              }}
            />
            <Glyph className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {cfg.label}
            <span
              className="ml-0.5 text-xs min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full font-semibold"
              style={{
                backgroundColor: isActive ? `${cfg.color}20` : 'transparent',
                color: cfg.color,
                transition: 'background-color 200ms ease-out',
              }}
            >
              {count}
            </span>
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
  const trendColor = trend > 0.2 ? STATUS_SUCCESS : trend < -0.2 ? STATUS_ERROR : 'var(--text-muted)';

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
              color: i < clamped ? color : 'var(--border)',
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
  verificationResult,
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
  verificationResult?: VerificationResult;
}) {
  const cfg = STATUS_CONFIG[feature.status];
  const StatusGlyph = cfg.icon;
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

  const testIdSlug = slugifyForTestId(feature.featureName);

  return (
    <div
      data-testid={`pof-feature-matrix-row-${testIdSlug}`}
      className="group/row rounded-md overflow-hidden"
      style={{ borderLeft: `4px solid ${cfg.color}` }}
    >
      <button
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
          hasDetails ? 'hover:bg-surface-hover cursor-pointer' : 'cursor-default'
        } ${isExpanded ? 'bg-surface-deep' : ''}`}
      >
        {/* Status indicator — shape (glyph) + color, so status is legible without
            relying on hue alone (WCAG 1.4.1). The status badge text carries the
            accessible name; the glyph + dot are decorative reinforcement. */}
        <span
          className="flex items-center gap-1 flex-shrink-0"
          title={`${cfg.label}: ${cfg.plain}. ${cfg.action}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: cfg.color }}
          />
          <StatusGlyph className="w-3.5 h-3.5" aria-hidden="true" style={{ color: cfg.color }} />
        </span>

        {/* Feature name */}
        <span className="text-sm text-text w-[150px] flex-shrink-0 truncate">
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

        {/* Hover action buttons — opacity reveal is the primary cue; the scale-up is
            gated behind motion-safe: so reduced-motion users just get the fade. */}
        <span className="flex items-center gap-0.5 flex-shrink-0 opacity-30 motion-safe:scale-95 group-hover/row:opacity-100 motion-safe:group-hover/row:scale-100 transition-all">
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
            {copied ? <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> : <Copy className="w-3 h-3" />}
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
            className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
            style={{ backgroundColor: statusBg(STATUS_ERROR), color: STATUS_BLOCKER }}
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
        <span data-testid={`pof-feature-matrix-quality-${testIdSlug}`} className="contents">
          <QualityStars score={feature.qualityScore} />
        </span>

        {/* File count badge */}
        {feature.filePaths.length > 0 && (
          <span className="flex items-center gap-0.5 text-2xs text-text-muted-hover flex-shrink-0">
            <FileCode className="w-3 h-3" />
            {feature.filePaths.length}
          </span>
        )}

        {/* Verification badge — shown after auto-verify runs */}
        {verificationResult && (
          <VerificationBadge result={verificationResult} />
        )}

        {/* Status badge */}
        <span
          data-testid={`pof-feature-matrix-status-${testIdSlug}`}
          className="text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label.toLowerCase()}
        </span>

        {/* Expand chevron */}
        {hasDetails && (
          <ChevronRight
            className="w-3 h-3 text-text-muted-hover flex-shrink-0 transition-transform duration-250 ease-out"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        )}
      </button>

      {/* Expanded detail — CSS grid-rows animation */}
      {hasDetails && (
        <div
          className="grid transition-[grid-template-rows] duration-250 ease-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className="pl-8 pr-4 pb-3 pt-1 space-y-3 bg-surface-deep"
              style={{ borderLeft: `3px solid ${cfg.color}` }}
            >
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
                  <MarkdownProse content={feature.nextSteps} className="leading-relaxed pl-[18px] text-text-muted-hover" />
                  {onFix && feature.status !== 'improved' && !(feature.status === 'implemented' && feature.qualityScore === 5 && !feature.nextSteps?.trim()) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFix(feature);
                      }}
                      disabled={isFixing}
                      className="ml-[18px] mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                      style={{ backgroundColor: statusBg(STATUS_SUCCESS, 0.05), color: STATUS_SUCCESS, border: `1px solid ${statusBorder(STATUS_SUCCESS, 0.20)}` }}
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
          </div>
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
          <span className="text-2xs" style={{ color: STATUS_BLOCKER }}>
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
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border"
              style={isBlocker
                ? { backgroundColor: statusBg(STATUS_ERROR, 0.05), borderColor: `${STATUS_ERROR}4d`, color: STATUS_BLOCKER }
                : { backgroundColor: statusBg(STATUS_SUCCESS, 0.05), borderColor: `${STATUS_SUCCESS}33`, color: STATUS_SUCCESS }
              }
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

const VERIFY_BADGE_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  implemented: { icon: ShieldCheck, color: STATUS_SUCCESS, label: 'verified' },
  improved: { icon: ShieldCheck, color: ACCENT_CYAN_LIGHT, label: 'verified' },
  partial: { icon: ShieldCheck, color: STATUS_WARNING, label: 'partial' },
  missing: { icon: AlertTriangle, color: STATUS_ERROR, label: 'not found' },
  unknown: { icon: ShieldCheck, color: STATUS_NEUTRAL, label: 'unknown' },
};

function VerificationBadge({ result }: { result: VerificationResult }) {
  const cfg = VERIFY_BADGE_CONFIG[result.newStatus] ?? VERIFY_BADGE_CONFIG.unknown;
  const Icon = cfg.icon;
  const changed = result.previousStatus !== null && result.previousStatus !== result.newStatus;

  return (
    <span
      className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
      style={{
        backgroundColor: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
      title={
        changed
          ? `Auto-verified: ${result.previousStatus} -> ${result.newStatus}`
          : `Auto-verified: ${result.newStatus}`
      }
    >
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
      {changed && (
        <span className="text-2xs opacity-70">*</span>
      )}
    </span>
  );
}

function VerificationSummaryBanner({ results }: { results: VerificationResult[] }) {
  const changed = results.filter((r) => r.previousStatus !== null && r.previousStatus !== r.newStatus);
  const writeError = results.find((r) => r.writeError)?.writeError;
  const implemented = results.filter((r) => r.newStatus === 'implemented' || r.newStatus === 'improved').length;
  const partial = results.filter((r) => r.newStatus === 'partial').length;
  const missing = results.filter((r) => r.newStatus === 'missing').length;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
      style={{
        backgroundColor: statusBg(STATUS_SUCCESS, 0.05),
        border: `1px solid ${statusBorder(STATUS_SUCCESS, 0.12)}`,
      }}
    >
      <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
      <span className="text-text">
        <span className="font-medium">Auto-Verify:</span>{' '}
        {results.length} rules checked
      </span>
      <span className="flex items-center gap-2 text-2xs">
        {implemented > 0 && (
          <span style={{ color: STATUS_SUCCESS }}>{implemented} found</span>
        )}
        {partial > 0 && (
          <span style={{ color: STATUS_WARNING }}>{partial} partial</span>
        )}
        {missing > 0 && (
          <span style={{ color: STATUS_ERROR }}>{missing} missing</span>
        )}
      </span>
      {changed.length > 0 && !writeError && (
        <span className="text-2xs" style={{ color: ACCENT_CYAN_LIGHT }}>
          {changed.length} status{changed.length !== 1 ? 'es' : ''} updated
        </span>
      )}
      {writeError && (
        <span className="text-2xs" style={{ color: STATUS_ERROR }}>
          write failed — statuses NOT saved: {writeError}
        </span>
      )}
    </div>
  );
}
