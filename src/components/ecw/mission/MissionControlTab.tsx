'use client';

import { CatalogRollupCard } from './CatalogRollupCard';
import { ActivityFeedCard } from './ActivityFeedCard';
import { ForecastCard } from './ForecastCard';

/**
 * Top-level body for the Mission Control L1 tab. Composes:
 * - CatalogRollupCard (left) + ForecastCard (right) at top
 * - ActivityFeedCard full-width below
 *
 * Focused Phase 5 scope. The full 5-dashboard consolidation
 * (UnifiedSummaryView, ProjectHealthDashboard, AggregateQualityDashboard,
 * DirectorOverview, CrossModuleFeatureDashboard) lands incrementally as
 * Phase 10 enhancement work; legacy `/` still reaches them.
 */
export function MissionControlTab() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Mission Control</h1>
        <p className="text-sm text-text-muted">
          Project-wide state at a glance. Full forecaster + critical-path DAG land in Phase 10.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 max-w-5xl">
        <CatalogRollupCard />
        <ForecastCard />
      </div>

      <div className="max-w-5xl">
        <ActivityFeedCard />
      </div>
    </div>
  );
}
