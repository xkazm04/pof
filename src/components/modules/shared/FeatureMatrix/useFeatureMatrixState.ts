import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useProjectStore } from '@/stores/projectStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ReviewSnapshot } from '@/lib/feature-matrix-db';
import { buildDependencyMap, computeBlockers, moduleNeedsBinaryContent, getWiringAssets } from '@/lib/feature-definitions';
import type { VerificationResult } from '@/types/pof-bridge';
import type { SubModuleId } from '@/types/modules';
import type { SortKey, SortDir, ViewMode } from './types';
import { readUrlParams, writeUrlParams } from './helpers';
import { STATUS_ORDER } from './constants';

export function useFeatureMatrixState({
  moduleId,
  isReviewing,
  isFixing,
}: {
  moduleId: SubModuleId;
  isReviewing: boolean;
  isFixing?: boolean;
}) {
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
  // Cross-module statuses come from the shared, deduped cache so this view and
  // the NBA card share one fetch of /api/feature-matrix/all-statuses + one Map.
  const { statusMap: allStatuses } = useFeatureStatuses();
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing derive-on-sort behavior, preserved verbatim in extraction
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing fetch-on-mount, preserved verbatim in extraction
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

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
  const { grouped, categories } = useMemo(() => {
    const grouped = filtered.reduce<Record<string, FeatureRow[]>>((acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f);
      return acc;
    }, {});
    const categories = Object.keys(grouped).sort();
    return { grouped, categories };
  }, [filtered]);

  // Module freshness = the OLDEST review in the module, not the first row that
  // happened to carry a timestamp. The old `find()` read whichever row sorted first
  // by (category, feature_name) — an arbitrary pick that let a module reviewed once a
  // year ago render "2 hours ago" because one recently-fixed row sorted to the top.
  // The dot answers "how stale is the WEAKEST evidence here", so it takes the minimum;
  // per-row ages are on the rows themselves (FeatureProvenanceBadge).
  const { lastReviewed, neverReviewed, undatedReviewed } = useMemo(() => {
    let oldest: string | null = null;
    let undatedReviewed = 0;
    for (const f of features) {
      if (f.status === 'unknown') continue; // no verdict → its age is not evidence
      if (!f.lastReviewedAt) {
        undatedReviewed += 1;
        continue;
      }
      const t = Date.parse(f.lastReviewedAt);
      if (Number.isNaN(t)) continue;
      if (oldest === null || t < Date.parse(oldest)) oldest = f.lastReviewedAt;
    }
    // Fall back to the oldest date on ANY row when no row carries a verdict yet, so a
    // seeded-but-dated module still reports something true rather than nothing.
    if (oldest === null) {
      for (const f of features) {
        if (!f.lastReviewedAt) continue;
        const t = Date.parse(f.lastReviewedAt);
        if (Number.isNaN(t)) continue;
        if (oldest === null || t < Date.parse(oldest)) oldest = f.lastReviewedAt;
      }
    }
    const neverReviewed = features.length > 0 && features.every((f) => f.status === 'unknown' && !f.lastReviewedAt);
    return { lastReviewed: oldest ?? undefined, neverReviewed, undatedReviewed };
  }, [features]);

  return {
    features, summary, isLoading, error, retry, refetch, runAutoVerify, isVerifying, verificationResults,
    projectPath, bridgeConnected, needsBinaryContent, wiringAssets, showWiring, setShowWiring, verificationMap,
    expandedRows, isSyncing, setIsSyncing, collapsedCategories, snapshots, reviewProgress,
    searchQuery, setSearchQuery, qualityMin, setQualityMin, qualityMax, setQualityMax,
    sortKey, sortDir, activeFilters, viewMode, setViewMode, depMap,
    toggleRow, toggleCategory, toggleFilter, toggleSort,
    filtered, grouped, categories, lastReviewed, neverReviewed, undatedReviewed,
  };
}

export type FeatureMatrixState = ReturnType<typeof useFeatureMatrixState>;
