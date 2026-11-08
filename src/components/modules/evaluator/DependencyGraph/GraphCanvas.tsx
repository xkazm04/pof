import { useId } from 'react';
import { MODULE_COLORS as CHART_MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_BLOCKER, OPACITY_20 } from '@/lib/chart-colors';
import { zoomViewBox, edgePath } from '@/lib/topology/moduleGraph';
import { NODE_W, NODE_H } from './constants';
import type { ModuleNode, Edge } from './types';

interface GraphCanvasProps {
  svgWidth: number;
  svgHeight: number;
  zoom: number;
  edges: Edge[];
  nodes: ModuleNode[];
  highlightModule: string | null;
  selectedModule: string | null;
  setSelectedModule: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredModule: React.Dispatch<React.SetStateAction<string | null>>;
  bridgeConnected: boolean;
  moduleCrossRefCounts: Map<string, number>;
  /** Edge ids (`from->to`) a previewed build would stop blocking — drawn cleared. */
  previewEdges: ReadonlySet<string>;
}

export function GraphCanvas({
  svgWidth,
  svgHeight,
  zoom,
  edges,
  nodes,
  highlightModule,
  selectedModule,
  setSelectedModule,
  setHoveredModule,
  bridgeConnected,
  moduleCrossRefCounts,
  previewEdges,
}: GraphCanvasProps) {
  // Zoom narrows the viewBox (zoomViewBox) instead of CSS-scaling the <svg>, so
  // every zoom level stays fully visible inside the overflow-hidden frame.
  // Edge endpoints come from the nodes' own centres — one derivation of geometry.
  const centres = new Map(nodes.map((n) => [n.moduleId as string, { x: n.cx, y: n.cy }]));
  // Per-instance marker ids: `#arrow` is also declared elsewhere (ComboChainGraph) and
  // LRU-hidden modules stay mounted, so a global id can resolve to a foreign marker.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ARROW = `dg-arrow-${uid}`;
  const ARROW_BLOCKED = `dg-arrow-blocked-${uid}`;
  const ARROW_CLEARED = `dg-arrow-cleared-${uid}`;

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      <svg
        width="100%"
        viewBox={zoomViewBox(svgWidth, svgHeight, zoom)}
      >
        <defs>
          <marker id={ARROW} viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-muted)" />
          </marker>
          <marker id={ARROW_BLOCKED} viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill={STATUS_BLOCKER} />
          </marker>
          <marker id={ARROW_CLEARED} viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill={STATUS_SUCCESS} />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const fromCenter = centres.get(edge.from);
          const toCenter = centres.get(edge.to);
          if (!fromCenter || !toCenter) return null;

          // Shortened to the node borders and bowed: the shared derivation.
          const geo = edgePath(fromCenter, toCenter, NODE_W, NODE_H);

          const edgeId = `${edge.from}->${edge.to}`;
          // A build preview lights the edges it would clear, over any module highlight.
          const isCleared = previewEdges.has(edgeId);
          const isHighlighted = highlightModule === edge.from || highlightModule === edge.to;
          const opacity = isCleared ? 1 : previewEdges.size > 0 ? 0.15 : highlightModule ? (isHighlighted ? 1 : 0.15) : 0.5;
          const blocked = edge.hasBlockers && !isCleared;

          return (
            <g key={edgeId} data-preview-cleared={isCleared || undefined}>
              <path
                d={geo.d}
                fill="none"
                stroke={isCleared ? STATUS_SUCCESS : blocked ? STATUS_BLOCKER : 'var(--text-muted)'}
                strokeWidth={isCleared ? 3 : Math.min(3, 0.5 + edge.count * 0.5)}
                strokeDasharray={blocked ? '4 2' : undefined}
                opacity={opacity}
                markerEnd={`url(#${isCleared ? ARROW_CLEARED : blocked ? ARROW_BLOCKED : ARROW})`}
                className="transition-opacity duration-base"
              />
              {isHighlighted && (
                <text
                  x={geo.labelX}
                  y={geo.labelY - 6}
                  fill="var(--text-muted-hover)"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {edge.count}
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
            ? edges.some(
                (e) =>
                  (e.from === highlightModule && e.to === node.moduleId) ||
                  (e.to === highlightModule && e.from === node.moduleId),
              )
            : false;
          const dimmed = highlightModule && !isHighlighted && !connectedToHighlight;
          const pctComplete = node.featureCount > 0 ? node.implementedCount / node.featureCount : 0;

          return (
            <g
              key={node.moduleId}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${node.label}: ${node.implementedCount} of ${node.featureCount} features implemented${node.blockedCount > 0 ? `, ${node.blockedCount} blocked` : ''}. ${isSelected ? 'Selected — activate to deselect' : 'Activate to select'}.`}
              onClick={() => setSelectedModule(isSelected ? null : node.moduleId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedModule(isSelected ? null : node.moduleId);
                }
              }}
              onMouseEnter={() => setHoveredModule(node.moduleId)}
              onMouseLeave={() => setHoveredModule(null)}
              onFocus={() => setHoveredModule(node.moduleId)}
              onBlur={() => setHoveredModule(null)}
              className="cursor-pointer focus-ring"
              opacity={dimmed ? 0.25 : 1}
              style={{ transition: 'opacity 200ms' }}
            >
              {/* Node background */}
              <rect
                x={node.cx - NODE_W / 2}
                y={node.cy - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="var(--surface)"
                stroke={isSelected ? CHART_MODULE_COLORS.evaluator : isHighlighted ? 'var(--border-bright)' : 'var(--border)'}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Module label */}
              <text
                x={node.cx}
                y={node.cy - 14}
                fill="var(--text)"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
              >
                {node.label}
              </text>

              {/* Progress bar */}
              <rect
                x={node.cx - NODE_W / 2 + 12}
                y={node.cy + 2}
                width={NODE_W - 24}
                height={4}
                rx={2}
                fill="var(--border)"
              />
              <rect
                x={node.cx - NODE_W / 2 + 12}
                y={node.cy + 2}
                width={Math.max(0, (NODE_W - 24) * pctComplete)}
                height={4}
                rx={2}
                fill={STATUS_SUCCESS}
              />

              {/* Stats line */}
              <text
                x={node.cx}
                y={node.cy + 22}
                fill="var(--text-muted)"
                fontSize="9"
                textAnchor="middle"
              >
                {node.implementedCount}/{node.featureCount} done
                {node.blockedCount > 0 ? ` · ${node.blockedCount} blocked` : ''}
                {bridgeConnected && moduleCrossRefCounts.get(node.moduleId)
                  ? ` · ${moduleCrossRefCounts.get(node.moduleId)} refs`
                  : ''}
              </text>

              {/* Blocked indicator */}
              {node.blockedCount > 0 && (
                <g transform={`translate(${node.cx + NODE_W / 2 - 10}, ${node.cy - NODE_H / 2 + 6})`}>
                  <circle r="7" fill={`${STATUS_ERROR}${OPACITY_20}`} />
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
