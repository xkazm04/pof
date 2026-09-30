'use client';

import { useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR,
} from '@/lib/chart-colors';
import type { SpellbookLiveData } from './_shared/types';
import { spellbookMetrics } from './_shared/spellbookView';
import { MetricText, MetricHighlight, MiniRadar, MicroTimeline } from './FeatureMetricsParts';

/* ── Main metric render function ──────────────────────────────────────────── */

export function useGASFeatureMetrics(data: SpellbookLiveData) {

  // Every number comes from the one spellbook view (catalog abilities, effect list,
  // cooldown rows) - see _shared/spellbookView.ts.
  const metrics = useMemo(() => spellbookMetrics(data), [data]);

  const accent = MODULE_COLORS.core;
  const radarData = data.ABILITY_RADAR_DATA;

  const renderMetric = useCallback((sectionId: string): ReactNode => {
    switch (sectionId) {
      case 'architecture':
        return (
          <MetricText>
            ASC {'→'} <MetricHighlight value={`${metrics.gaCount} GA`} color={accent} /> {'→'} <MetricHighlight value={`${metrics.geCount} GE`} color={accent} />
          </MetricText>
        );

      case 'radar':
        return <MiniRadar abilities={radarData} />;

      case 'cooldowns':
        if (!metrics.hasCooldownData) {
          return (
            <MetricText>
              <MetricHighlight value={`${metrics.cooldownAbilityCount}`} color={accent} /> abilities (CDs in blueprints)
            </MetricText>
          );
        }
        return (
          <MetricText>
            <MetricHighlight value={`${metrics.avgCd.toFixed(1)}s`} color={accent} /> avg / {metrics.minCd.toFixed(1)}&ndash;{metrics.maxCd.toFixed(1)}s
          </MetricText>
        );

      case 'timeline':
        return <MicroTimeline events={metrics.timelineEvents} />;

      case 'effects-timeline':
        return (
          <MetricText>
            <MetricHighlight value={metrics.activeEffects} color={accent} /> active / <MetricHighlight value={metrics.passiveEffects} color={accent} /> passive
          </MetricText>
        );

      case 'tags':
        return (
          <MetricText>
            <MetricHighlight value={metrics.tagStats.total} color={accent} /> tags / <MetricHighlight value={metrics.tagStats.depth} color={accent} /> depth
          </MetricText>
        );

      case 'hierarchy':
        return (
          <MetricText>
            <MetricHighlight value={metrics.tagStats.roots} color={accent} /> roots / <MetricHighlight value={metrics.tagStats.leaves} color={accent} /> leaves
          </MetricText>
        );

      case 'audit': {
        const hasWarnings = metrics.auditWarnings > 0;
        return (
          <MetricText color={hasWarnings ? STATUS_ERROR : STATUS_SUCCESS}>
            <MetricHighlight
              value={`${metrics.auditWarnings} warning${metrics.auditWarnings !== 1 ? 's' : ''}`}
              color={hasWarnings ? STATUS_ERROR : STATUS_SUCCESS}
            />
          </MetricText>
        );
      }

      case 'dependencies': {
        const hasCircular = metrics.circularCount > 0;
        return (
          <MetricText>
            <MetricHighlight value={metrics.depCount} color={accent} /> deps / <MetricHighlight
              value={`${metrics.circularCount} circular`}
              color={hasCircular ? STATUS_ERROR : STATUS_SUCCESS}
            />
          </MetricText>
        );
      }

      default:
        return null;
    }
  }, [radarData, metrics, accent]);

  return renderMetric;
}
