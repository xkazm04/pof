'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER, ACCENT_VIOLET, MODULE_COLORS, OPACITY_20,
} from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { NODE_W, NODE_H } from './constants';
import type { LayerId } from './constants';
import type { NexusNode, NexusEdge } from './types';
import { getNodeCenter } from './helpers';

export function NexusGraph({
  edges,
  nodes,
  highlightModule,
  activeLayers,
  selectedModule,
  setSelectedModule,
  setHoveredModule,
  zoom,
  svgWidth,
  svgHeight,
}: {
  edges: NexusEdge[];
  nodes: NexusNode[];
  highlightModule: string | null;
  activeLayers: Set<LayerId>;
  selectedModule: string | null;
  setSelectedModule: Dispatch<SetStateAction<string | null>>;
  setHoveredModule: Dispatch<SetStateAction<string | null>>;
  zoom: number;
  svgWidth: number;
  svgHeight: number;
}) {
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden relative">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <defs>
          <marker id="nexus-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-muted)" />
          </marker>
          <marker id="nexus-arrow-blocked" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill={STATUS_BLOCKER} />
          </marker>
          {/* Glow filters */}
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const fromCenter = getNodeCenter(edge.from as SubModuleId);
          const toCenter = getNodeCenter(edge.to as SubModuleId);
          const dx = toCenter.x - fromCenter.x;
          const dy = toCenter.y - fromCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = fromCenter.x + ux * (NODE_W / 2 + 4);
          const y1 = fromCenter.y + uy * (NODE_H / 2 + 4);
          const x2 = toCenter.x - ux * (NODE_W / 2 + 10);
          const y2 = toCenter.y - uy * (NODE_H / 2 + 10);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const perpX = -uy * 20;
          const perpY = ux * 20;
          const isHighlighted = highlightModule === edge.from || highlightModule === edge.to;
          const opacity = highlightModule ? (isHighlighted ? 1 : 0.12) : 0.4;

          // Layer 3: show avg duration on edge when sessions layer active
          const showSessionAnnotation = activeLayers.has('sessions') && isHighlighted;
          const fromNode = nodes.find((n) => n.moduleId === edge.from);
          const toNode = nodes.find((n) => n.moduleId === edge.to);
          const avgMs = ((fromNode?.avgDurationMs ?? 0) + (toNode?.avgDurationMs ?? 0)) / 2;

          return (
            <g key={`${edge.from}->${edge.to}`}>
              <path
                d={`M${x1},${y1} Q${mx + perpX},${my + perpY} ${x2},${y2}`}
                fill="none"
                stroke={edge.hasBlockers ? STATUS_BLOCKER : 'var(--text-muted)'}
                strokeWidth={Math.min(3, 0.5 + edge.count * 0.5)}
                strokeDasharray={edge.hasBlockers ? '4 2' : undefined}
                opacity={opacity}
                markerEnd={edge.hasBlockers ? 'url(#nexus-arrow-blocked)' : 'url(#nexus-arrow)'}
                className="transition-opacity duration-base"
              />
              {/* Edge count label */}
              {isHighlighted && (
                <text x={mx + perpX} y={my + perpY - 6} fill="var(--text-muted-hover)" fontSize="9" textAnchor="middle">
                  {edge.count} deps
                </text>
              )}
              {/* Layer 3: session duration annotation */}
              {showSessionAnnotation && avgMs > 0 && (
                <text x={mx + perpX} y={my + perpY + 8} fill={STATUS_INFO} fontSize="8" textAnchor="middle" opacity="0.8">
                  ~{avgMs > 60000 ? `${Math.round(avgMs / 60000)}m` : `${Math.round(avgMs / 1000)}s`}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedModule === node.moduleId;
          const isHighlighted = highlightModule === node.moduleId;
          const connectedToHighlight = highlightModule
            ? edges.some((e) => (e.from === highlightModule && e.to === node.moduleId) || (e.to === highlightModule && e.from === node.moduleId))
            : false;
          const dimmed = highlightModule && !isHighlighted && !connectedToHighlight;
          const pctComplete = node.featureCount > 0 ? node.implementedCount / node.featureCount : 0;

          // Layer 1: pattern heat
          const showPatternHeat = activeLayers.has('patterns') && node.patternSuccessRate !== null;
          const patternColor = node.patternSuccessRate !== null
            ? node.patternSuccessRate >= 0.7 ? STATUS_SUCCESS : node.patternSuccessRate >= 0.4 ? STATUS_WARNING : STATUS_ERROR
            : undefined;

          // Layer 2: build failure glow
          const showBuildGlow = activeLayers.has('builds') && node.hasBuildFailure;

          // Layer 4: genre glow
          const showGenreGlow = activeLayers.has('genre') && node.genreItemCount > 0;

          // Layer 3: session indicator
          const showSessionBadge = activeLayers.has('sessions') && node.sessionCount > 0;

          return (
            <g
              key={node.moduleId}
              onClick={() => setSelectedModule(isSelected ? null : node.moduleId)}
              onMouseEnter={() => setHoveredModule(node.moduleId)}
              onMouseLeave={() => setHoveredModule(null)}
              className="cursor-pointer"
              opacity={dimmed ? 0.2 : 1}
              style={{ transition: 'opacity 200ms' }}
            >
              {/* Layer 2: Build failure pulsing glow */}
              {showBuildGlow && (
                <rect
                  x={node.cx - NODE_W / 2 - 3}
                  y={node.cy - NODE_H / 2 - 3}
                  width={NODE_W + 6}
                  height={NODE_H + 6}
                  rx={11}
                  fill="none"
                  stroke={MODULE_COLORS.evaluator}
                  strokeWidth={2}
                  opacity={0.6}
                  filter="url(#glow-red)"
                >
                  <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
                </rect>
              )}

              {/* Layer 4: Genre purple glow */}
              {showGenreGlow && !showBuildGlow && (
                <rect
                  x={node.cx - NODE_W / 2 - 2}
                  y={node.cy - NODE_H / 2 - 2}
                  width={NODE_W + 4}
                  height={NODE_H + 4}
                  rx={10}
                  fill="none"
                  stroke={ACCENT_VIOLET}
                  strokeWidth={1.5}
                  opacity={0.5}
                  filter="url(#glow-purple)"
                />
              )}

              {/* Node background */}
              <rect
                x={node.cx - NODE_W / 2}
                y={node.cy - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="var(--surface)"
                stroke={isSelected ? ACCENT_VIOLET : isHighlighted ? 'var(--border-bright)' : 'var(--border)'}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Layer 1: Pattern success heat bar (left edge) */}
              {showPatternHeat && (
                <rect
                  x={node.cx - NODE_W / 2}
                  y={node.cy - NODE_H / 2}
                  width={3}
                  height={NODE_H}
                  rx={1}
                  fill={patternColor}
                  opacity={0.8}
                />
              )}

              {/* Module label */}
              <text x={node.cx} y={node.cy - 16} fill="var(--text)" fontSize="11" fontWeight="600" textAnchor="middle">
                {node.label}
              </text>

              {/* Progress bar */}
              <rect x={node.cx - NODE_W / 2 + 12} y={node.cy} width={NODE_W - 24} height={4} rx={2} fill="var(--border)" />
              <rect
                x={node.cx - NODE_W / 2 + 12}
                y={node.cy}
                width={Math.max(0, (NODE_W - 24) * pctComplete)}
                height={4}
                rx={2}
                fill={STATUS_SUCCESS}
              />

              {/* Stats line */}
              <text x={node.cx} y={node.cy + 20} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                {node.implementedCount}/{node.featureCount}
                {node.checklistDone > 0 ? ` · ${node.checklistDone}/${node.checklistTotal} ✓` : ''}
              </text>

              {/* Layer 1: Pattern badge (top-left) */}
              {showPatternHeat && (
                <g transform={`translate(${node.cx - NODE_W / 2 + 8}, ${node.cy - NODE_H / 2 + 8})`}>
                  <rect x={0} y={0} width={28} height={14} rx={3} fill={patternColor} opacity={0.15} />
                  <text x={14} y={10} fill={patternColor} fontSize="8" fontWeight="600" textAnchor="middle">
                    {Math.round((node.patternSuccessRate ?? 0) * 100)}%
                  </text>
                </g>
              )}

              {/* Layer 3: Session badge (top-right) */}
              {showSessionBadge && (
                <g transform={`translate(${node.cx + NODE_W / 2 - 32}, ${node.cy - NODE_H / 2 + 8})`}>
                  <rect x={0} y={0} width={24} height={14} rx={3} fill={STATUS_INFO} opacity={0.15} />
                  <text x={12} y={10} fill={STATUS_INFO} fontSize="8" fontWeight="600" textAnchor="middle">
                    {node.sessionCount}
                  </text>
                </g>
              )}

              {/* Layer 4: Genre badge (bottom-right) */}
              {showGenreGlow && (
                <g transform={`translate(${node.cx + NODE_W / 2 - 16}, ${node.cy + NODE_H / 2 - 16})`}>
                  <circle r={7} fill={ACCENT_VIOLET} opacity={0.2} />
                  <text x={0} y={3} fill={ACCENT_VIOLET} fontSize="8" fontWeight="700" textAnchor="middle">
                    {node.genreItemCount}
                  </text>
                </g>
              )}

              {/* Blocked indicator */}
              {node.blockedCount > 0 && (
                <g transform={`translate(${node.cx + NODE_W / 2 - 10}, ${node.cy - NODE_H / 2 + 6})`}>
                  <circle r={7} fill={`${STATUS_ERROR}${OPACITY_20}`} />
                  <text fill={STATUS_BLOCKER} fontSize="9" fontWeight="700" textAnchor="middle" dy="3">!</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
