'use client';

import { CatalogRollupCard } from './CatalogRollupCard';
import { ActivityFeedCard } from './ActivityFeedCard';
import { ForecastCard } from './ForecastCard';
import { QualityRollupCard } from './QualityRollupCard';
import { FeatureCoverageCard } from './FeatureCoverageCard';
import { SessionActivityCard } from './SessionActivityCard';
import { NextBestActionsCard } from './NextBestActionsCard';

/**
 * Top-level body for the Mission Control L1 tab. Consolidates the project-wide
 * signals that previously lived in five separate legacy dashboards:
 * - CatalogRollupCard + ForecastCard (Phase 5)
 * - QualityRollupCard (← AggregateQuality / ProjectHealth / UnifiedSummary)
 * - FeatureCoverageCard (← CrossModuleFeatureDashboard)
 * - SessionActivityCard (← DirectorOverview / UnifiedSummary session signal)
 * - ActivityFeedCard (full-width)
 *
 * Phase 10-MC fold-in (Phase 9 audit execution). The critical-path DAG lands in
 * a later 10-MC round; legacy `/` still reaches the original dashboards.
 */
export function MissionControlTab() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Mission Control</h1>
        <p className="text-sm text-text-muted">
          Project-wide state at a glance — catalog lifecycle, quality, feature coverage, and recent activity.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 max-w-5xl">
        <CatalogRollupCard />
        <ForecastCard />
        <QualityRollupCard />
        <FeatureCoverageCard />
        <SessionActivityCard />
      </div>

      <div className="max-w-5xl space-y-4">
        <NextBestActionsCard />
        <ActivityFeedCard />
      </div>
    </div>
  );
}
