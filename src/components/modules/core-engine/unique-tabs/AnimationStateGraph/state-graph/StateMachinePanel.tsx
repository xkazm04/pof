'use client';

import { useMemo, useState, useCallback } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_EMERALD, OVERLAY_WHITE,
  withOpacity, OPACITY_8, OPACITY_12, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../_design';
import { STATUS_COLORS } from '../../_shared';
import { ACCENT, STATE_GROUPS, STATE_NODES, type StateNode } from '../data';
import type { FeatureStatus, FeatureRow } from '@/types/feature-matrix';

/* ── Module-scope graph data for SVG visualization ────────────────────────── */

const STATE_TO_GROUP_MAP = (() => {
  const map = new Map<string, string>();
  for (const g of STATE_GROUPS) for (const s of g.states) map.set(s, g.group);
  return map;
})();

function groupNodeColor(group: string): string {
  switch (group) {
    case 'Movement': return STATUS_SUCCESS;
    case 'Combat': return STATUS_ERROR;
    case 'Reaction': return STATUS_WARNING;
    case 'Ability': return ACCENT;
    case 'Social': return ACCENT_EMERALD;
    case 'Traversal': return ACCENT_CYAN;
    default: return ACCENT;
  }
}

const GN_W = 130;
const GN_H = 48;

interface GraphNode { group: string; cx: number; cy: number; color: string; stateCount: number }
interface GraphEdge { from: string; to: string; count: number }

const GRAPH_NODES: GraphNode[] = STATE_GROUPS.map((g, i) => ({
  group: g.group,
  cx: 100 + (i % 3) * 200,
  cy: 55 + Math.floor(i / 3) * 100,
  color: groupNodeColor(g.group),
  stateCount: g.states.length,
}));

const GRAPH_NODE_MAP = new Map(GRAPH_NODES.map(n => [n.group, n]));

const GRAPH_EDGES: GraphEdge[] = (() => {
  const map = new Map<string, number>();
  for (const node of STATE_NODES) {
    const fg = STATE_TO_GROUP_MAP.get(node.name);
    for (const t of node.transitions) {
      const tg = STATE_TO_GROUP_MAP.get(t.to);
      if (fg && tg && fg !== tg) {
        const key = `${fg}->${tg}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
  }
  return Array.from(map, ([key, count]) => {
    const [from, to] = key.split('->');
    return { from, to, count };
  });
})();

/** Compute point on rectangle edge closest to a target direction. */
function rectEdgePoint(cx: number, cy: number, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = GN_W / 2;
  const hh = GN_H / 2;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const t = Math.min(
    ax > 0.001 ? hw / ax : Infinity,
    ay > 0.001 ? hh / ay : Infinity,
  );
  return { x: cx + dx * t, y: cy + dy * t };
}

interface StateMachinePanelProps {
  featureMap: Map<string, FeatureRow>;
}

export function StateMachinePanel({ featureMap }: StateMachinePanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const stateNodeMap = useMemo(() => {
    const map = new Map<string, StateNode>();
    for (const n of STATE_NODES) map.set(n.name, n);
    return map;
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const totalStates = STATE_NODES.length;

  return (
    <BlueprintPanel color={ACCENT} className="p-4">
      <SectionHeader label="AnimBP State Machine" icon={Activity} color={ACCENT} />
      <p className="text-xs font-mono text-text-muted mb-3">
        {totalStates} states across {STATE_GROUPS.length} groups &middot; {GRAPH_EDGES.reduce((s, e) => s + e.count, 0)} cross-group transitions
      </p>

      {/* SVG State Group Graph */}
      <div className="flex justify-center mb-4">
        <svg width="100%" viewBox="0 0 600 210" className="overflow-visible max-w-[600px]">
          <defs>
            <marker id="sg-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="var(--text-muted)" opacity="0.5" />
            </marker>
            <filter id="sg-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Edges — animated dash when hovered */}
          {GRAPH_EDGES.map(edge => {
            const from = GRAPH_NODE_MAP.get(edge.from);
            const to = GRAPH_NODE_MAP.get(edge.to);
            if (!from || !to) return null;
            const p1 = rectEdgePoint(from.cx, from.cy, to.cx, to.cy);
            const p2 = rectEdgePoint(to.cx, to.cy, from.cx, from.cy);
            const hl = hoveredGroup === edge.from || hoveredGroup === edge.to;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={hl ? from.color : withOpacity(OVERLAY_WHITE, OPACITY_12)}
                strokeWidth={Math.min(1 + edge.count * 0.5, 4)}
                strokeDasharray="5 3"
                markerEnd="url(#sg-arrow)"
                style={{ transition: 'stroke 0.2s' }}
              >
                {hl && <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite" />}
              </line>
            );
          })}
          {/* Group nodes — rounded rects with glow on hover */}
          {GRAPH_NODES.map(node => {
            const hl = hoveredGroup === node.group;
            return (
              <g
                key={node.group}
                onMouseEnter={() => setHoveredGroup(node.group)}
                onMouseLeave={() => setHoveredGroup(null)}
                className="cursor-pointer"
              >
                {hl && (
                  <rect
                    x={node.cx - GN_W / 2 - 4} y={node.cy - GN_H / 2 - 4}
                    width={GN_W + 8} height={GN_H + 8} rx={12}
                    fill="none" stroke={node.color} strokeWidth="1" opacity={0.3}
                    filter="url(#sg-glow)"
                  />
                )}
                <rect
                  x={node.cx - GN_W / 2} y={node.cy - GN_H / 2}
                  width={GN_W} height={GN_H} rx={10}
                  fill={withOpacity(node.color, hl ? OPACITY_20 : OPACITY_8)}
                  stroke={hl ? node.color : withOpacity(node.color, OPACITY_30)}
                  strokeWidth={hl ? 2 : 1}
                  style={{ transition: 'all 0.2s' }}
                />
                <text
                  x={node.cx} y={node.cy - 3}
                  textAnchor="middle"
                  className="text-xs font-mono font-bold"
                  fill={hl ? node.color : 'var(--text)'}
                  style={{ transition: 'fill 0.2s', pointerEvents: 'none' }}
                >
                  {node.group}
                </text>
                <text
                  x={node.cx} y={node.cy + 12}
                  textAnchor="middle"
                  className="text-[10px] font-mono"
                  fill="var(--text-muted)"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.stateCount} states
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-1">
        {STATE_GROUPS.map(({ group, states }) => {
          const isCollapsed = collapsed[group];
          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <ChevronDown
                  className="w-3 h-3 text-text-muted transition-transform flex-shrink-0"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined }}
                />
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                  {group}
                </span>
                <span className="text-xs font-mono text-text-muted/50 ml-auto">
                  {states.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="ml-5 space-y-0.5 mb-1">
                  {states.map((stateName) => {
                    const node = stateNodeMap.get(stateName);
                    if (!node) return null;
                    const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
                    const sc = STATUS_COLORS[status];
                    return (
                      <div
                        key={node.name}
                        className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-surface-hover transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                        <span className="text-xs font-medium text-text flex-1 min-w-0 truncate">{node.name}</span>
                        <span className="text-xs font-mono text-text-muted">{node.ref}</span>
                        <span className="text-xs font-mono text-text-muted/50">{node.transitions.length}→</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transition labels */}
      <div className="space-y-1.5 bg-surface-deep/30 p-3 rounded-xl border border-border/40 mt-3">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Transitions Matrix ({STATE_NODES.reduce((s, n) => s + n.transitions.length, 0)} total)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
          {STATE_NODES.flatMap((node) =>
            node.transitions.map((t) => (
              <div
                key={`${node.name}->${t.to}`}
                className="flex items-center gap-1.5 text-xs bg-surface/50 px-2 py-1 rounded"
              >
                <span
                  className="font-mono font-medium text-text px-1 rounded"
                  style={{ backgroundColor: withOpacity(ACCENT, OPACITY_8), color: ACCENT }}
                >
                  {node.name}
                </span>
                <span className="text-text-muted opacity-50">&rarr;</span>
                <span className="font-mono font-medium text-text px-1 bg-surface-hover rounded truncate">
                  {t.to}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </BlueprintPanel>
  );
}
