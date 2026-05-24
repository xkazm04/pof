'use client';

import { useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR,
} from '@/lib/chart-colors';
import type { SpellbookLiveData } from './_shared/types';
import type { TagNode } from './_shared/data';
import { COMBO_ABILITIES, EFFECT_TYPES } from './_shared/data';
import { MetricText, MetricHighlight, MiniRadar, MicroTimeline } from './FeatureMetricsParts';

/* ── Main metric render function ──────────────────────────────────────────── */

export function useGASFeatureMetrics(data: SpellbookLiveData) {

  const metrics = useMemo(() => {

    const gaCount = COMBO_ABILITIES.length;
    const geCount = EFFECT_TYPES.length;

    // Cooldown stats — filter out zero-cd entries (live data may set cd: 0 when actual values aren't available)
    const cds = data.COOLDOWN_ABILITIES.map((a) => a.cd).filter((cd) => cd > 0);
    const avgCd = cds.length > 0 ? (cds.reduce((s, c) => s + c, 0) / cds.length) : 0;
    const minCd = cds.length > 0 ? Math.min(...cds) : 0;
    const maxCd = cds.length > 0 ? Math.max(...cds) : 0;
    const hasCooldownData = cds.length > 0;
    const cooldownAbilityCount = data.COOLDOWN_ABILITIES.length;

    // Tag stats
    const countTags = (nodes: TagNode[]): { total: number; depth: number; roots: number; leaves: number } => {
      let total = 0;
      let maxDepth = 0;
      let leaves = 0;

      const walk = (list: TagNode[], depth: number) => {
        for (const n of list) {
          total++;
          if (depth > maxDepth) maxDepth = depth;
          if (n.children && n.children.length > 0) {
            walk(n.children, depth + 1);
          } else {
            leaves++;
          }
        }
      };
      walk(nodes, 1);
      return { total, depth: maxDepth, roots: nodes.length, leaves };
    };

    const tagStats = countTags(data.TAG_TREE);

    // Audit stats
    const auditWarnings = data.TAG_AUDIT_CATEGORIES
      .filter((c) => c.status !== 'pass')
      .reduce((sum, c) => sum + c.count, 0);

    // Dependencies
    const depCount = data.TAG_DEP_EDGES.length;
    // Detect circular: check if any edge pair has A→B and B→A
    const edgeSet = new Set(data.TAG_DEP_EDGES.map((e) => `${e.from}→${e.to}`));
    let circularCount = 0;
    for (const e of data.TAG_DEP_EDGES) {
      if (edgeSet.has(`${e.to}→${e.from}`)) circularCount++;
    }
    circularCount = Math.floor(circularCount / 2); // Each circular pair is counted twice

    // Effects: duration-based (active) vs instant (passive)
    // Classify by effect name pattern — GE_Buff/GE_Regen/GE_Heal are duration-based
    const DURATION_EFFECTS = new Set(['GE_Buff', 'GE_Regen', 'GE_Heal']);
    const activeEffects = EFFECT_TYPES.filter((e) => DURATION_EFFECTS.has(e.name)).length;
    const passiveEffects = EFFECT_TYPES.length - activeEffects;

    // Pre-compute timeline events (cumulative timestamps from combo abilities)
    let t = 0;
    const timelineEvents = COMBO_ABILITIES.slice(0, 6).map((a) => {
      const ev = { timestamp: t, color: a.color, duration: a.animDuration };
      t += a.animDuration;
      return ev;
    });

    return {
      gaCount, geCount,
      avgCd, minCd, maxCd, hasCooldownData, cooldownAbilityCount,
      tagStats,
      auditWarnings,
      depCount, circularCount,
      activeEffects, passiveEffects,
      timelineEvents,
    };
  }, [data]);

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
