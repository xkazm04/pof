import { ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { computeEdgeGeometry } from '@/components/ui/svg/graph-edges';
import { ANIM_ACCENT } from './constants';
import type { StateNodeView, TransitionEdge } from './types';

interface StateMachineEdgesProps {
  displayTransitions: TransitionEdge[];
  stateMap: Record<string, StateNodeView>;
  simEdges: Set<string>;
  modifiedTransitions: Set<string>;
  hoveredTransition: string | null;
  setHoveredTransition: (key: string | null) => void;
  edgeKeySet: Set<string>;
  transitionRuleMap: Map<string, string>;
  prefersReducedMotion: boolean | null;
}

export function StateMachineEdges({
  displayTransitions,
  stateMap,
  simEdges,
  modifiedTransitions,
  hoveredTransition,
  setHoveredTransition,
  edgeKeySet,
  transitionRuleMap,
  prefersReducedMotion,
}: StateMachineEdgesProps) {
  return (
    <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
      <defs>
        <marker
          id="sm-arrow"
          viewBox="0 0 8 6"
          refX="8"
          refY="3"
          markerWidth="6"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 3 L 0 6 z" fill={`${ANIM_ACCENT}40`} />
        </marker>
        <marker
          id="sm-arrow-done"
          viewBox="0 0 8 6"
          refX="8"
          refY="3"
          markerWidth="6"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 3 L 0 6 z" fill={`${STATUS_SUCCESS}40`} />
        </marker>
        <marker
          id="sm-arrow-sim"
          viewBox="0 0 8 6"
          refX="8"
          refY="3"
          markerWidth="6"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 3 L 0 6 z" fill={ACCENT_ORANGE} />
        </marker>
        <marker
          id="sm-arrow-modified"
          viewBox="0 0 8 6"
          refX="8"
          refY="3"
          markerWidth="6"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 3 L 0 6 z" fill={STATUS_WARNING} />
        </marker>
        {/* Glow filter for new states */}
        <filter id="glow-new" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {displayTransitions.map(({ from, to, rule }) => {
        const fromNode = stateMap[from];
        const toNode = stateMap[to];
        if (!fromNode || !toNode) return null;

        const edgeKey = `${from}->${to}`;
        const bothDone = fromNode.completed && toNode.completed;
        const isSimEdge = simEdges.has(edgeKey);
        const isModified = modifiedTransitions.has(edgeKey);
        const isHovered = hoveredTransition === edgeKey;

        const reverseExists = edgeKeySet.has(`${to}->${from}`);
        const isForward = from < to;

        const geom = computeEdgeGeometry(fromNode, toNode, { reverseExists, isForward });
        if (!geom) return null;
        const { x1, y1, x2, y2, midX, midY } = geom;
        const ruleText = rule ?? transitionRuleMap.get(edgeKey) ?? null;

        let strokeColor = bothDone ? `${STATUS_SUCCESS}50` : `${ANIM_ACCENT}30`;
        let strokeWidth = bothDone ? 2 : 1.5;
        let markerEnd = bothDone ? 'url(#sm-arrow-done)' : 'url(#sm-arrow)';

        if (isSimEdge) {
          strokeColor = ACCENT_ORANGE;
          strokeWidth = 2.5;
          markerEnd = 'url(#sm-arrow-sim)';
        } else if (isModified) {
          strokeColor = STATUS_WARNING;
          strokeWidth = 2;
          markerEnd = 'url(#sm-arrow-modified)';
        }

        if (isHovered && !isSimEdge) {
          strokeColor = ANIM_ACCENT;
          strokeWidth = 2.5;
        }

        return (
          <g key={edgeKey} className="group/edge">
            {/* Invisible wider line for hover target */}
            <line
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke="transparent"
              strokeWidth={15}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredTransition(edgeKey)}
              onMouseLeave={() => setHoveredTransition(null)}
            />

            {/* Glow underlay */}
            {(bothDone || isSimEdge || isHovered) && (
              <line
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={strokeColor}
                strokeWidth={strokeWidth * 3}
                opacity="0.3"
                className="pointer-events-none"
                style={{ filter: 'blur(3px)' }}
              />
            )}

            <line
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              markerEnd={markerEnd}
              className="pointer-events-none transition-all duration-300"
              strokeDasharray={(bothDone || isSimEdge) ? "6, 6" : "none"}
            >
              {/* Looping decoration only — gated on reduced-motion. The static
                  stroke color/width/dash pattern already conveys the state. */}
              {isModified && !prefersReducedMotion && (
                <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="5" />
              )}
              {(bothDone || isSimEdge) && !prefersReducedMotion && (
                <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.8s" repeatCount="indefinite" />
              )}
            </line>
            {/* Transition rule label on hover */}
            {ruleText && isHovered && (
              <g>
                <rect
                  x={`${midX - 4}%`}
                  y={`${midY - 3}%`}
                  width="8%"
                  height="6%"
                  rx="3"
                  style={{ fill: 'var(--surface-deep)' }}
                  stroke={ANIM_ACCENT}
                  strokeWidth="0.5"
                  opacity="0.95"
                />
                <text
                  x={`${midX}%`}
                  y={`${midY}%`}
                  fill={ANIM_ACCENT}
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {ruleText}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
