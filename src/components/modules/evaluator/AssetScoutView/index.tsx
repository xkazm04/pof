'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, Download, ChevronDown,
  Search, Filter, AlertCircle, Clock, Package, ScanSearch,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { useMarketplaceStore } from '@/stores/marketplaceStore';
import { useProjectStore } from '@/stores/projectStore';
import { useFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { scoutReviewTask } from '@/lib/marketplace/scout-review';
import { getAppOrigin } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import type { UnreviewedModule } from '@/types/marketplace';
import { EMPTY_ACQUIRED, EMPTY_RECS } from './constants';
import { StatCard, TabBtn } from './StatCard';
import { RecommendationsList } from './RecommendationsList';
import { UnreviewedList } from './UnreviewedList';
import { AcquiredAssetsList } from './AcquiredAssetsList';
import { IntegrationView } from './IntegrationView';

// ── Main Component ──────────────────────────────────────────────────────────

export function AssetScoutView() {
  const recommendations = useMarketplaceStore((s) => s.recommendations) ?? EMPTY_RECS;
  const totalGaps = useMarketplaceStore((s) => s.totalGaps);
  const unreviewed = useMarketplaceStore((s) => s.unreviewed);
  const totalUnreviewed = useMarketplaceStore((s) => s.totalUnreviewed);
  const estimatedTimeSaved = useMarketplaceStore((s) => s.estimatedTimeSaved);
  const isLoading = useMarketplaceStore((s) => s.isLoading);
  const error = useMarketplaceStore((s) => s.error);
  const acquiredAssets = useMarketplaceStore((s) => s.acquiredAssets) ?? EMPTY_ACQUIRED;
  const moduleFilter = useMarketplaceStore((s) => s.moduleFilter);
  const fetchRecommendations = useMarketplaceStore((s) => s.fetchRecommendations);
  const setModuleFilter = useMarketplaceStore((s) => s.setModuleFilter);

  const projectName = useProjectStore((s) => s.projectName);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recommendations' | 'acquired' | 'integration'>('recommendations');

  // Gaps come from the project's real feature matrix (the shared, invalidation-aware
  // status map): refetch whenever it is reloaded (new Map identity) or the filter moves.
  const { statusMap, loaded: statusesLoaded, failed: statusesFailed, error: statusesError } = useFeatureStatuses();
  useEffect(() => {
    if (!statusesLoaded) return;
    void fetchRecommendations({
      statusMap: Object.fromEntries(statusMap),
      statusesFailed,
      statusesError,
      moduleId: moduleFilter ?? undefined,
    });
  }, [fetchRecommendations, statusMap, statusesLoaded, statusesFailed, statusesError, moduleFilter]);
  // Until the statuses settle there is nothing honest to show — not an empty "no gaps".
  const analyzing = isLoading || !statusesLoaded;

  // One-click review of an unreviewed module: a feature-review CLI run, started ONLY
  // from the button. Its completion reloads the statuses, which refetches the gaps.
  const [reviewingModuleId, setReviewingModuleId] = useState<string | null>(null);
  const { execute, isRunning: isReviewing } = useModuleCLI({
    moduleId: 'core-engine' as SubModuleId,
    sessionKey: 'asset-scout-review',
    label: 'Asset Scout Review',
    accentColor: MODULE_COLORS.evaluator,
    onComplete: () => invalidateFeatureData(),
  });
  const reviewModule = useCallback((m: UnreviewedModule) => {
    const task = scoutReviewTask(m.moduleId, m.featureNames, getAppOrigin(), m.moduleLabel);
    if (!task) return;
    setReviewingModuleId(m.moduleId);
    void execute(task);
  }, [execute]);

  // Filter recommendations by search
  const filteredRecs = useMemo(() => {
    if (!searchQuery) return recommendations;
    const q = searchQuery.toLowerCase();
    return recommendations.filter((rec) =>
      rec.gap.moduleLabel.toLowerCase().includes(q) ||
      rec.gap.featureName.toLowerCase().includes(q) ||
      rec.assets.some((a) => a.asset.name.toLowerCase().includes(q)),
    );
  }, [recommendations, searchQuery]);

  const acquiredCount = Object.keys(acquiredAssets).length;

  // Unique module IDs for filter
  const moduleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rec of recommendations) ids.add(rec.gap.moduleId);
    return [...ids];
  }, [recommendations]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <DashboardHeader
          icon={ShoppingBag}
          title="Asset Scout"
          subtitle="Marketplace recommendations based on your project gaps"
          accent="emerald"
          accentTo="cyan"
          className="mb-4"
        />

        {/* Stats bar */}
        <div className="flex gap-3 mb-4">
          <StatCard
            icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
            value={totalGaps}
            label="Feature gaps"
            color="text-amber-400"
          />
          <StatCard
            icon={<ScanSearch className="w-4 h-4 text-cyan-400" />}
            value={totalUnreviewed}
            label="Unreviewed"
            color="text-cyan-400"
          />
          <StatCard
            icon={<Package className="w-4 h-4 text-emerald-400" />}
            value={recommendations.length}
            label="Recommendations"
            color="text-emerald-400"
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-cyan-400" />}
            value={`${Math.round(estimatedTimeSaved / 60)}h`}
            label="Potential savings"
            color="text-cyan-400"
          />
          <StatCard
            icon={<Download className="w-4 h-4 text-purple-400" />}
            value={acquiredCount}
            label="Acquired"
            color="text-purple-400"
          />
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 border-b border-border">
            <TabBtn label="Recommendations" active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} />
            <TabBtn label={`Acquired (${acquiredCount})`} active={activeTab === 'acquired'} onClick={() => setActiveTab('acquired')} />
            <TabBtn label="Integration" active={activeTab === 'integration'} onClick={() => setActiveTab('integration')} />
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-emerald-500/40 w-48"
            />
          </div>
          <div className="relative">
            <select
              value={moduleFilter ?? ''}
              onChange={(e) => setModuleFilter((e.target.value || null) as SubModuleId | null)}
              className="appearance-none pl-7 pr-6 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-emerald-500/40 cursor-pointer"
            >
              <option value="">All modules</option>
              {moduleIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {analyzing && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Analyzing feature gaps...</span>
          </div>
        )}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!analyzing && activeTab === 'recommendations' && (
          <>
            <UnreviewedList
              unreviewed={unreviewed}
              totalUnreviewed={totalUnreviewed}
              onReview={reviewModule}
              isReviewing={isReviewing}
              reviewingModuleId={reviewingModuleId}
            />
            <RecommendationsList
              recommendations={filteredRecs}
              acquiredAssets={acquiredAssets}
              projectName={projectName}
              hasUnreviewed={totalUnreviewed > 0}
            />
          </>
        )}

        {!analyzing && activeTab === 'acquired' && (
          <AcquiredAssetsList
            acquiredAssets={acquiredAssets}
            projectName={projectName}
          />
        )}

        {!analyzing && activeTab === 'integration' && (
          <IntegrationView acquiredAssets={acquiredAssets} />
        )}
      </div>
    </div>
  );
}
