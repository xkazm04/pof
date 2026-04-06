'use client';

import { useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, OVERLAY_WHITE,
  OPACITY_20, OPACITY_30, OPACITY_50, withOpacity,
} from '@/lib/chart-colors';
import type { SpellbookLiveData } from './types';
import type { TagNode } from './data';
import { COMBO_ABILITIES, EFFECT_TYPES } from './data';

/* ── Shared tiny metric helpers ───────────────────────────────────────────── */

function MetricText({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="text-[10px] font-mono leading-tight block"
      style={{ color: color ?? withOpacity(OVERLAY_WHITE, OPACITY_50) }}
    >
      {children}
    </span>
  );
}

function MetricHighlight({ value, color }: { value: string | number; color: string }) {
  return (
    <span
      className="text-[11px] font-mono font-bold"
      style={{ color }}
    >
      {value}
    </span>
  );
}

/* ── Mini Radar (40px SVG with 3-ability overlay) ─────────────────────────── */

const RADAR_SIZE = 40;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 16;
const RADAR_AXES = 5;

function radarPoints(values: number[]): string {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / RADAR_AXES - Math.PI / 2;
    const dist = v * RADAR_R;
    return `${RADAR_CX + dist * Math.cos(angle)},${RADAR_CY + dist * Math.sin(angle)}`;
  }).join(' ');
}

function MiniRadar({ abilities }: { abilities: { name: string; color: string; values: number[] }[] }) {
  // Show up to 3 abilities
  const shown = abilities.slice(0, 3);

  if (shown.length === 0) {
    return (
      <span className="text-[10px] font-mono" style={{ color: withOpacity(OVERLAY_WHITE, OPACITY_30) }}>
        No data
      </span>
    );
  }

  return (
    <svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="block" aria-hidden="true">
      {/* Background grid */}
      {[0.33, 0.66, 1].map((scale) => (
        <polygon
          key={scale}
          points={Array.from({ length: RADAR_AXES }, (_, i) => {
            const angle = (Math.PI * 2 * i) / RADAR_AXES - Math.PI / 2;
            const dist = scale * RADAR_R;
            return `${RADAR_CX + dist * Math.cos(angle)},${RADAR_CY + dist * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke={withOpacity(OVERLAY_WHITE, OPACITY_20)}
          strokeWidth={0.5}
        />
      ))}
      {/* Ability overlays */}
      {shown.map((ab) => (
        <polygon
          key={ab.name}
          points={radarPoints(ab.values)}
          fill={withOpacity(ab.color, OPACITY_20)}
          stroke={withOpacity(ab.color, OPACITY_50)}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

/* ── Micro Timeline Strip (60px) ──────────────────────────────────────────── */

function MicroTimeline({ events }: { events: { timestamp: number; color: string; duration?: number }[] }) {
  const maxT = Math.max(...events.map((e) => e.timestamp + (e.duration ?? 0)), 1);
  const w = 60;
  const h = 12;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden="true">
      <rect x={0} y={h / 2 - 1} width={w} height={2} rx={1} fill={withOpacity(OVERLAY_WHITE, OPACITY_20)} />
      {events.map((e, i) => {
        const x = (e.timestamp / maxT) * w;
        if (e.duration) {
          const barW = Math.max((e.duration / maxT) * w, 2);
          return (
            <rect
              key={i}
              x={x}
              y={1}
              width={barW}
              height={h - 2}
              rx={1}
              fill={withOpacity(e.color, OPACITY_30)}
              stroke={e.color}
              strokeWidth={0.5}
            />
          );
        }
        return (
          <circle
            key={i}
            cx={x}
            cy={h / 2}
            r={2}
            fill={e.color}
          />
        );
      })}
    </svg>
  );
}

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
