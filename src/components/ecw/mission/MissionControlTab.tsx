'use client';

import { CatalogRollupCard } from './CatalogRollupCard';
import { ActivityFeedCard } from './ActivityFeedCard';
import { ForecastCard } from './ForecastCard';
import { QualityRollupCard } from './QualityRollupCard';
import { FeatureCoverageCard } from './FeatureCoverageCard';
import { SessionActivityCard } from './SessionActivityCard';
import { NextBestActionsCard } from './NextBestActionsCard';
import { PlaytestsCard } from './PlaytestsCard';
import { RoadmapCard } from './RoadmapCard';

/**
 * Top-level body for the Mission Control L1 tab. Consolidates the project-wide
 * signals that previously lived in the legacy dashboards:
 * - CatalogRollupCard + ForecastCard (Phase 5)
 * - QualityRollupCard (← AggregateQuality / ProjectHealth / UnifiedSummary)
 * - FeatureCoverageCard (← CrossModuleFeatureDashboard)
 * - SessionActivityCard (← DirectorOverview / UnifiedSummary session signal)
 * - PlaytestsCard (← Game Director overview), RoadmapCard (← EvalRoadmap/CalendarRoadmap)
 * - NextBestActionsCard (critical path) + ActivityFeedCard (full-width)
 *
 * Phase 10-MC fold-in (Phase 9 audit execution). Build History deferred (no build
 * telemetry source yet); legacy `/` still reaches the original dashboards until P12.
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
        <PlaytestsCard />
        <RoadmapCard />
      </div>

      <div className="max-w-5xl space-y-4">
        <NextBestActionsCard />
        <ActivityFeedCard />
      </div>
    </div>
  );
}
