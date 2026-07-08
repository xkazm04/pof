import { MODULE_COLORS as CHART_MODULE_COLORS, STATUS_SUCCESS, STATUS_ERROR, STATUS_BLOCKER, OPACITY_20 } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import { getNodeCenter, NODE_W, NODE_H } from './constants';
import type { ModuleNode, Edge } from './types';

interface GraphCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
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
}

export function GraphCanvas({
  svgRef,
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
}: GraphCanvasProps) {
  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--text-muted)" />
          </marker>
          <marker id="arrow-blocked" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 3.5 L 0 7 z" fill={STATUS_BLOCKER} />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const fromCenter = getNodeCenter(edge.from as SubModuleId);
          const toCenter = getNodeCenter(edge.to as SubModuleId);

          // Shorten line to stop at node border
          const dx = toCenter.x - fromCenter.x;
          const dy = toCenter.y - fromCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / dist;
          const uy = dy / dist;

          const x1 = fromCenter.x + ux * (NODE_W / 2 + 4);
          const y1 = fromCenter.y + uy * (NODE_H / 2 + 4);
          const x2 = toCenter.x - ux * (NODE_W / 2 + 10);
          const y2 = toCenter.y - uy * (NODE_H / 2 + 10);

          // Curve control point (perpendicular offset for overlapping edges)
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const perpX = -uy * 20;
          const perpY = ux * 20;

          const isHighlighted = highlightModule === edge.from || highlightModule === edge.to;
          const opacity = highlightModule ? (isHighlighted ? 1 : 0.15) : 0.5;

          return (
            <g key={`${edge.from}->${edge.to}`}>
              <path
                d={`M${x1},${y1} Q${mx + perpX},${my + perpY} ${x2},${y2}`}
                fill="none"
                stroke={edge.hasBlockers ? STATUS_BLOCKER : 'var(--text-muted)'}
                strokeWidth={Math.min(3, 0.5 + edge.count * 0.5)}
                strokeDasharray={edge.hasBlockers ? '4 2' : undefined}
                opacity={opacity}
                markerEnd={edge.hasBlockers ? 'url(#arrow-blocked)' : 'url(#arrow)'}
                className="transition-opacity duration-base"
              />
              {isHighlighted && (
                <text
                  x={mx + perpX}
                  y={my + perpY - 6}
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
