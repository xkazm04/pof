'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, RefreshCw, Stars } from 'lucide-react';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { layoutModuleConstellation, isFeatureDone } from '@/lib/constellation/layout';
import type { ConstellationNode } from '@/lib/constellation/layout';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCRUD } from '@/hooks/useCRUD';
import { tryApiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureStatus } from '@/types/feature-matrix';
import {
  PLAN_STATUS_COLORS, STATUS_SUCCESS, STATUS_BLOCKER, STATUS_INFO, statusBg, statusBorder,
} from '@/lib/chart-colors';
import { MOTION } from '@/lib/constants';

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_W = 158;
const NODE_H = 56;
const STATUS_ORDER: readonly FeatureStatus[] = FEATURE_STATUSES;
const STATUS_LABEL: Record<FeatureStatus, string> = {
  implemented: 'Done', improved: 'Improved', partial: 'Partial', missing: 'Missing', unknown: 'Unknown',
};

/** Modules that have a feature graph to render, in registry order. */
const GRAPH_MODULES = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

interface StatusRow { moduleId: string; featureName: string; status: FeatureStatus }

// ── Pure deterministic starfield (no Math.random in render — purity rule) ─────

function hashFloat(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildStars(width: number, height: number, count: number) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: hashFloat(i + 1) * width,
      y: hashFloat(i + 101) * height,
      r: 0.4 + hashFloat(i + 201) * 1.1,
      o: 0.15 + hashFloat(i + 301) * 0.4,
    });
  }
  return stars;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FeatureConstellation() {
  const [moduleId, setModuleId] = useState<SubModuleId>('arpg-character');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Feature statuses, fetched + cached via the blessed useCRUD hook (avoids a
  // hand-rolled fetch effect). The custom fetcher unwraps the envelope and
  // reduces the status rows into the "moduleId::featureName" → status map.
  const fetcher = useCallback(async (): Promise<Map<string, string>> => {
    const result = await tryApiFetch<{ statuses: StatusRow[] }>('/api/feature-matrix/all-statuses');
    const map = new Map<string, string>();
    if (result.ok) {
      for (const row of result.data.statuses ?? []) map.set(`${row.moduleId}::${row.featureName}`, row.status);
    }
    return map;
  }, []);

  const { data: statusMap, isLoading, refetch } = useCRUD<Map<string, string>>(
    '/api/feature-matrix/all-statuses',
    new Map<string, string>(),
    { fetcher },
  );

  const layout = useMemo(() => layoutModuleConstellation(moduleId, statusMap), [moduleId, statusMap]);
  const nodeByKey = useMemo(() => new Map(layout.nodes.map((n) => [n.key, n])), [layout]);
  const stars = useMemo(() => buildStars(layout.width, layout.height, 70), [layout.width, layout.height]);

  // Keys lit up by hover: the hovered node plus its whole prerequisite chain.
  const litKeys = useMemo(() => {
    if (!hoveredKey) return null;
    const lit = new Set<string>([hoveredKey]);
    const walk = (key: string) => {
      const n = nodeByKey.get(key);
      if (!n) return;
      for (const d of n.deps) if (!lit.has(d.key)) { lit.add(d.key); walk(d.key); }
    };
    walk(hoveredKey);
    return lit;
  }, [hoveredKey, nodeByKey]);

  const summary = useMemo(() => {
    const counts: Record<FeatureStatus, number> = { implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };
    for (const n of layout.nodes) counts[n.status]++;
    const done = counts.implemented + counts.improved;
    const blocked = layout.nodes.filter((n) => n.isBlocked).length;
    return { counts, done, total: layout.nodes.length, blocked };
  }, [layout]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stars className="w-4 h-4" style={{ color: STATUS_INFO }} />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Feature Constellation</span>
          {summary.total > 0 && (
            <span className="text-2xs text-text-muted">
              {summary.done}/{summary.total} lit{summary.blocked > 0 ? ` · ${summary.blocked} blocked` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="constellation-module">Module</label>
          <select
            id="constellation-module"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value as SubModuleId)}
            className="text-xs bg-surface border border-border rounded-md px-2 py-1.5 text-text focus-ring"
          >
            {GRAPH_MODULES.map((id) => (
              <option key={id} value={id}>{MODULE_LABELS[id] ?? id}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            aria-label="Refresh statuses"
            title="Refresh statuses"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {layout.nodes.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No features to map"
          description="This module has no feature definitions yet, so there is nothing to render as a constellation."
          iconColor={STATUS_INFO}
        />
      ) : (
        <>
          {/* Constellation canvas */}
          <div className="rounded-lg overflow-x-auto border border-border" style={{ background: 'var(--background)' }}>
            <svg
              role="img"
              aria-label={`Feature constellation for ${MODULE_LABELS[moduleId] ?? moduleId}`}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ display: 'block', minWidth: layout.width }}
            >
              <defs>
                <marker id="cst-arrow" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-muted)" />
                </marker>
                <marker id="cst-arrow-blocked" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3.5 L 0 7 z" fill={STATUS_BLOCKER} />
                </marker>
                <filter id="cst-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Starfield backdrop */}
              <g aria-hidden="true">
                {stars.map((s, i) => (
                  <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--text-muted)" opacity={s.o} />
                ))}
              </g>

              {/* Edges (prerequisite → dependent) */}
              {layout.edges.map((e) => {
                const from = nodeByKey.get(e.fromKey);
                const to = nodeByKey.get(e.toKey);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W / 2;
                const y1 = from.y;
                const x2 = to.x - NODE_W / 2;
                const y2 = to.y;
                const mx = (x1 + x2) / 2;
                const lit = litKeys ? (litKeys.has(e.fromKey) && litKeys.has(e.toKey)) : null;
                const opacity = lit === null ? (e.blocked ? 0.5 : 0.35) : lit ? 0.95 : 0.08;
                return (
                  <path
                    key={`${e.fromKey}->${e.toKey}`}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={e.blocked ? STATUS_BLOCKER : STATUS_SUCCESS}
                    strokeWidth={1.5}
                    strokeDasharray={e.blocked ? '5 3' : undefined}
                    opacity={opacity}
                    markerEnd={e.blocked ? 'url(#cst-arrow-blocked)' : 'url(#cst-arrow)'}
                    className="transition-opacity duration-base"
                  />
                );
              })}

              {/* Nodes */}
              {layout.nodes.map((node, i) => (
                <ConstellationNodeG
                  key={node.key}
                  node={node}
                  index={i}
                  isNext={layout.nextKey === node.key}
                  dimmed={litKeys ? !litKeys.has(node.key) : false}
                  onHoverStart={() => setHoveredKey(node.key)}
                  onHoverEnd={() => setHoveredKey(null)}
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-2xs text-text-muted">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLAN_STATUS_COLORS[s] }} />
                {STATUS_LABEL[s]} ({summary.counts[s]})
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t border-dashed" style={{ borderColor: STATUS_BLOCKER }} /> Blocked path
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" style={{ color: STATUS_INFO }} /> Do this next
            </span>
          </div>

          {/* Recommended-next callout */}
          {layout.nextKey && nodeByKey.get(layout.nextKey) && (
            <NextCallout node={nodeByKey.get(layout.nextKey)!} />
          )}
        </>
      )}
    </div>
  );
}

// ── Node ─────────────────────────────────────────────────────────────────────

function ConstellationNodeG({
  node, index, isNext, dimmed, onHoverStart, onHoverEnd,
}: {
  node: ConstellationNode;
  index: number;
  isNext: boolean;
  dimmed: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const color = PLAN_STATUS_COLORS[node.status] ?? PLAN_STATUS_COLORS.unknown;
  const done = isFeatureDone(node.status);
  const x = node.x - NODE_W / 2;
  const y = node.y - NODE_H / 2;
  const blockerLabel = node.blockers.length > 0
    ? `Blocked by ${node.blockers[0].featureName}${node.blockers.length > 1 ? ` +${node.blockers.length - 1}` : ''}`
    : null;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: dimmed ? 0.22 : 1 }}
      transition={{ duration: MOTION.base, delay: Math.min(index * 0.02, 0.4) }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      style={{ cursor: 'default' }}
    >
      <title>{`${node.featureName} — ${STATUS_LABEL[node.status]}${blockerLabel ? ` · ${blockerLabel}` : ''}`}</title>

      {/* "Do this next" pulsing ring */}
      {isNext && (
        <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8} rx={12} fill="none" stroke={STATUS_INFO} strokeWidth={2} filter="url(#cst-glow)">
          <animate attributeName="opacity" values="0.35;0.95;0.35" dur="1.8s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Node body */}
      <rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={9}
        fill="var(--surface)"
        stroke={color}
        strokeWidth={done ? 2 : 1.25}
        opacity={done ? 1 : 0.92}
        style={done ? { filter: 'url(#cst-glow)' } : undefined}
      />
      {/* Status accent bar (left) */}
      <rect x={x} y={y} width={3.5} height={NODE_H} rx={1.5} fill={color} opacity={node.isBlocked ? 0.5 : 0.9} />

      {/* Status dot */}
      <circle cx={x + NODE_W - 12} cy={y + 12} r={4} fill={color} />

      {/* Feature name */}
      <text x={x + 12} y={y + 21} fill="var(--text)" fontSize="11" fontWeight="600">
        {truncate(node.featureName, 20)}
      </text>
      {/* Category */}
      <text x={x + 12} y={y + 36} fill="var(--text-muted)" fontSize="9">
        {truncate(node.category, 22)}
      </text>

      {/* Fan-out badge */}
      {node.dependentCount > 0 && (
        <text x={x + NODE_W - 12} y={y + NODE_H - 8} fill="var(--text-muted)" fontSize="8" textAnchor="end">
          ↳{node.dependentCount}
        </text>
      )}

      {/* Blocked indicator + label */}
      {node.isBlocked && blockerLabel && (
        <g>
          <g transform={`translate(${x + 12}, ${y + NODE_H - 14})`}>
            <AlertTriangleGlyph />
          </g>
          <text x={x + 24} y={y + NODE_H - 6} fill={STATUS_BLOCKER} fontSize="8">
            {truncate(blockerLabel, 22)}
          </text>
        </g>
      )}
    </motion.g>
  );
}

/** Small inline triangle glyph (avoids an HTML lucide icon inside SVG). */
function AlertTriangleGlyph() {
  return <path d="M5 0 L10 9 L0 9 Z" fill="none" stroke={STATUS_BLOCKER} strokeWidth={1.2} strokeLinejoin="round" transform="scale(0.85)" />;
}

// ── Recommended-next callout ───────────────────────────────────────────────

function NextCallout({ node }: { node: ConstellationNode }) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: statusBg(STATUS_INFO, 0.12), border: `1px solid ${statusBorder(STATUS_INFO)}` }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: STATUS_INFO }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: STATUS_INFO }}>Do this next</span>
            {node.dependentCount > 0 && (
              <span className="text-2xs text-text-muted">unblocks {node.dependentCount} downstream feature{node.dependentCount > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="text-sm font-medium text-text mt-0.5">{node.featureName}</div>
          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{node.description}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}
