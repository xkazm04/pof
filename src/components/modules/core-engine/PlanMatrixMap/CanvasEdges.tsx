'use client';

import { MODULE_COLORS, STATUS_NEUTRAL, ACCENT_RED } from '@/lib/chart-colors';
import type { PlanMatrixState } from './usePlanMatrixMap';

export function CanvasEdges({ pm }: { pm: PlanMatrixState }) {
  const { showDeps, edges, layout, criticalPathMode, cpSet, hoveredKey, selectedKey } = pm;
  if (!layout) return null;

  return (
    <>
          {/* SVG dependency lines */}
          {showDeps && edges.length > 0 && (
            <svg className="absolute pointer-events-none z-0" style={{ left: 0, top: 0, overflow: 'visible', width: 1, height: 1, willChange: 'transform' }}>
              {edges.map((edge) => {
                const from = layout.allNodes.get(edge.from);
                const to = layout.allNodes.get(edge.to);
                if (!from || !to) return null;

                const isOnCp = criticalPathMode && cpSet.has(edge.from) && cpSet.has(edge.to);

                const isHoveredIncoming = hoveredKey === edge.to || selectedKey === edge.to;
                const isHoveredOutgoing = hoveredKey === edge.from || selectedKey === edge.from;
                const isHL = isHoveredIncoming || isHoveredOutgoing;

                const mx = (from.x + to.x) / 2;
                const d = `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;

                let strokeColor = STATUS_NEUTRAL;
                let strokeWidth = 0.8;
                let opacity = 0.08; // Default very faint
                let dashArray = undefined;

                if (isOnCp) {
                  strokeColor = MODULE_COLORS.content; // Amber glow
                  strokeWidth = 2.5;
                  opacity = 0.8;
                  dashArray = '8 4';
                } else if (isHoveredIncoming) {
                  strokeColor = ACCENT_RED; // Red for dependencies (blockers)
                  strokeWidth = 2;
                  opacity = 0.9;
                  dashArray = '6 4';
                } else if (isHoveredOutgoing) {
                  strokeColor = MODULE_COLORS.core; // Blue for dependents (unblocks)
                  strokeWidth = 2;
                  opacity = 0.9;
                  dashArray = '6 4';
                }

                return (
                  <path
                    key={`${edge.from}->${edge.to}`}
                    d={d}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    opacity={opacity}
                    strokeDasharray={dashArray}
                    style={{
                      filter: isHL || isOnCp ? `drop-shadow(0 0 4px ${strokeColor}80)` : 'none',
                      transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s',
                      willChange: 'stroke, stroke-width, opacity',
                    }}
                  />
                );
              })}
            </svg>
          )}
    </>
  );
}
