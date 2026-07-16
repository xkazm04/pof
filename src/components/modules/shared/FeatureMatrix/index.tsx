'use client';

import { useEffect, useRef } from 'react';
import { Boxes, ChevronDown, ChevronRight, Loader2, Download, ShieldCheck, RefreshCw, Search, LayoutList, LayoutGrid } from 'lucide-react';
import { AccentButton } from '@/components/ui/AccentButton';
import { FetchError } from '@/components/modules/shared/FetchError';
import { WiringAssetsPanel } from '@/components/modules/shared/WiringAssetsPanel';
import { STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS, statusBg, statusBorder } from '@/lib/chart-colors';
import type { FeatureMatrixProps } from './types';
import { formatRelativeTime } from './helpers';
import { useFeatureMatrixState } from './useFeatureMatrixState';
import { FeatureMatrixSkeleton } from './FeatureMatrixSkeleton';
import { NeverReviewedState } from './NeverReviewedState';
import { SummaryBar } from './SummaryBar';
import { StatusFilterChips } from './StatusFilterChips';
import { QualitySparkline } from './QualitySparkline';
import { ReviewProgressBar } from './ReviewProgressBar';
import { VerificationSummaryBanner } from './VerificationSummaryBanner';
import { QualityRangeFilter } from './QualityRangeFilter';
import { SortButton } from './SortButton';
import { FeatureList } from './FeatureList';

export function FeatureMatrix({ moduleId, accentColor, onReview, onSync, isReviewing, onFix, isFixing, onReviewFeature }: FeatureMatrixProps) {
  const state = useFeatureMatrixState({ moduleId, isReviewing, isFixing });
  const {
    features,
    summary,
    isLoading,
    error,
    retry,
    refetch,
    runAutoVerify,
    isVerifying,
    verificationResults,
    bridgeConnected,
    needsBinaryContent,
    wiringAssets,
    showWiring,
    setShowWiring,
    isSyncing,
    setIsSyncing,
    snapshots,
    reviewProgress,
    searchQuery,
    setSearchQuery,
    qualityMin,
    setQualityMin,
    qualityMax,
    setQualityMax,
    sortKey,
    sortDir,
    activeFilters,
    toggleFilter,
    toggleSort,
    viewMode,
    setViewMode,
    filtered,
    lastReviewed,
    neverReviewed,
  } = state;

  // Sticky offset for category headers: measure the filter toolbar so headers
  // stick flush below it even when the filter row wraps to multiple lines.
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const showToolbar = !isLoading && !error && !neverReviewed;

  useEffect(() => {
    const root = rootRef.current;
    const toolbar = toolbarRef.current;
    if (!root || !toolbar) return;
    const update = () => {
      root.style.setProperty('--fm-sticky-offset', `${toolbar.offsetHeight}px`);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [showToolbar]);

  if (isLoading) {
    return <FeatureMatrixSkeleton />;
  }

  if (error) {
    return <FetchError message={error} onRetry={retry} />;
  }

  if (neverReviewed) {
    return (
      <NeverReviewedState
        features={features}
        isReviewing={isReviewing}
        reviewProgress={reviewProgress}
        onReview={onReview}
        accentColor={accentColor}
      />
    );
  }

  return (
    <div ref={rootRef} className="space-y-4">
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
      <div ref={toolbarRef} className="flex items-center gap-3 flex-wrap sticky top-0 z-10 bg-background py-2 -mt-2">
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

      <FeatureList
        state={state}
        accentColor={accentColor}
        onFix={onFix}
        isFixing={isFixing}
        onReviewFeature={onReviewFeature}
      />
    </div>
  );
}
