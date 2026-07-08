'use client';

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, Loader2, RefreshCw, Stars } from 'lucide-react';
import { MODULE_LABELS } from '@/lib/module-registry';
import { layoutModuleConstellation } from '@/lib/constellation/layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCRUD } from '@/hooks/useCRUD';
import { tryApiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type { FeatureStatus } from '@/types/feature-matrix';
import {
  PLAN_STATUS_COLORS, STATUS_SUCCESS, STATUS_BLOCKER, STATUS_INFO,
} from '@/lib/chart-colors';
import { NODE_W, STATUS_ORDER, STATUS_LABEL, GRAPH_MODULES } from './constants';
import type { StatusRow } from './constants';
import { buildStars } from './helpers';
import { ConstellationNodeG } from './ConstellationNodeG';
import { NextCallout } from './NextCallout';

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
