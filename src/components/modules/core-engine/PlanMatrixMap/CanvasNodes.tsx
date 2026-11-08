'use client';

import { Zap, CheckCircle2 } from 'lucide-react';
import {
  MODULE_COLORS,
  SURFACE_DAG_NODE_FILL, SURFACE_DAG_NODE_HOVER_FILL,
  BORDER_DAG_NEUTRAL, OVERLAY_BLACK,
  OPACITY_20, OPACITY_30, OPACITY_40, OPACITY_60, OPACITY_80,
  withOpacity,
} from '@/lib/chart-colors';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CanvasNode } from '@/lib/implementation-planner/layout-engine';
import type { PlanMatrixState } from './usePlanMatrixMap';

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
const ARROWS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Spatial roving focus: the nearest node strictly in the arrow's direction,
 * scored by distance along the axis plus a double-weighted off-axis drift so
 * Right prefers the same row. Null at the edge of the map.
 */
export function nextNodeKey(nodes: readonly CanvasNode[], fromKey: string, dir: ArrowKey): string | null {
  const from = nodes.find((n) => n.key === fromKey);
  if (!from) return null;
  let best: { key: string; score: number } | null = null;
  for (const n of nodes) {
    if (n.key === fromKey) continue;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const along = dir === 'ArrowRight' ? dx : dir === 'ArrowLeft' ? -dx : dir === 'ArrowDown' ? dy : -dy;
    if (along <= 0) continue;
    const drift = dir === 'ArrowRight' || dir === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
    const score = along + 2 * drift;
    if (!best || score < best.score) best = { key: n.key, score };
  }
  return best?.key ?? null;
}

export function CanvasNodes({ pm }: { pm: PlanMatrixState }) {
  const {
    showNodes, visibleNodes, nodeOpacity,
    hoveredKey, selectedKey, setHoveredKey, setHoverPos, setSelectedKey,
    criticalPathMode, cpSet, transform, isPanningRef,
  } = pm;

  // One tab stop for the whole map (the selected node, else the first); arrows
  // rove between nodes, Enter/Space selects like a click.
  const tabStopKey = selectedKey && visibleNodes.some((n) => n.key === selectedKey)
    ? selectedKey
    : visibleNodes[0]?.key;

  const nodeA11y = (node: CanvasNode) => ({
    role: 'button' as const,
    tabIndex: node.key === tabStopKey ? 0 : -1,
    'data-node-key': node.key,
    'aria-label': `${node.item.featureName}, ${node.item.status}${node.item.isReady ? ', ready to implement' : ''}`,
    'aria-pressed': selectedKey === node.key,
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedKey(selectedKey === node.key ? null : node.key);
        return;
      }
      if (!ARROWS.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation(); // the surface's own handler pans on arrows
      const target = nextNodeKey(visibleNodes, node.key, e.key as ArrowKey);
      if (!target) return;
      const peers = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-node-key]') ?? [];
      Array.from(peers).find((el) => el.dataset.nodeKey === target)?.focus({ preventScroll: true });
    },
  });

  return (
    <>
          {/* Feature dots & cards (Semantic Zooming) */}
            {showNodes && visibleNodes.map((node) => {
              const o = nodeOpacity(node);
              const isHovered = hoveredKey === node.key;
              const isSelected = selectedKey === node.key;
              const isReady = node.item.isReady;
              const isOnCp = criticalPathMode && cpSet.has(node.key);
              const isDetailed = transform.zoom >= 0.8; // Show cards earlier since they are smaller

              if (isDetailed) {
                return (
                  <div
                    key={node.key}
                    {...nodeA11y(node)}
                    className="focus-ring absolute rounded-md border shadow-sm transition-all duration-200 overflow-hidden flex items-center gap-2 px-2 py-1.5"
                    style={{
                      left: node.x - 90, // Adjusted for wider card
                      top: node.y - 14,  // Adjusted for shorter card
                      width: 180,
                      height: 28,
                      backgroundColor: isSelected ? `${node.color}15` : isHovered ? SURFACE_DAG_NODE_HOVER_FILL : SURFACE_DAG_NODE_FILL,
                      backdropFilter: 'blur(4px)',
                      borderColor: isSelected ? node.color : isHovered ? `${node.color}${OPACITY_80}` : withOpacity(BORDER_DAG_NEUTRAL, OPACITY_20),
                      opacity: o,
                      boxShadow: isSelected
                        ? `0 0 0 1px ${node.color}${OPACITY_40}, 0 4px 12px ${withOpacity(OVERLAY_BLACK, OPACITY_40)}`
                        : isHovered
                          ? `0 2px 8px ${withOpacity(OVERLAY_BLACK, OPACITY_30)}`
                          : 'none',
                      transform: isHovered ? 'scale(1.02) translateY(-1px)' : isSelected ? 'scale(1.02)' : 'scale(1)',
                      cursor: 'pointer',
                      zIndex: isHovered || isSelected ? 10 : 1,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => {
                      if (isPanningRef.current) return;
                      setHoveredKey(node.key);
                      setHoverPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKey(selectedKey === node.key ? null : node.key);
                    }}
                  >
                    {/* Status Indicator */}
                    <div className="flex-shrink-0 relative flex items-center justify-center w-3 h-3">
                      {isReady ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: node.color }} />
                      )}
                      {isOnCp && (
                        <div className="absolute -inset-1 rounded-full border border-amber-500/50 animate-ping" />
                      )}
                    </div>

                    {/* Feature Name */}
                    <div
                      className={`text-xs truncate flex-1 ${isReady ? 'text-text font-semibold' : 'text-text-muted font-medium'}`}
                      title={node.item.featureName}
                    >
                      {node.item.featureName}
                    </div>

                    {/* Impact Indicator (Subtle) */}
                    {node.item.impact.score > 5 && (
                      <div className="flex-shrink-0 flex items-center text-[11px] text-amber-400/70 font-mono">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />
                        {node.item.impact.score}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={node.key}
                  {...nodeA11y(node)}
                  className="focus-ring absolute rounded-full"
                  style={{
                    left: node.x - node.radius,
                    top: node.y - node.radius,
                    width: node.radius * 2,
                    height: node.radius * 2,
                    backgroundColor: node.color,
                    opacity: o,
                    boxShadow: isSelected
                      ? `0 0 0 3px ${node.color}40, 0 0 12px ${node.color}60`
                      : isHovered
                        ? `0 0 0 2px ${node.color}30, 0 0 8px ${node.color}40`
                        : isReady
                          ? `0 0 6px ${node.color}50`
                          : isOnCp
                            ? `0 0 4px ${withOpacity(MODULE_COLORS.content, OPACITY_60)}`
                            : 'none',
                    transform: isHovered ? 'scale(1.4)' : isSelected ? 'scale(1.3)' : undefined,
                    transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.3s',
                    cursor: 'pointer',
                    zIndex: isHovered || isSelected ? 10 : 1,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => {
                    if (isPanningRef.current) return;
                    setHoveredKey(node.key);
                    setHoverPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(selectedKey === node.key ? null : node.key);
                  }}
                />
              );
            })}

          {/* Pulsing glow rings for ready items */}
          {showNodes && visibleNodes
            .filter((n) => n.item.isReady && nodeOpacity(n) > 0.5)
            .map((node) => (
                <div
                  key={`pulse-${node.key}`}
                  className="absolute rounded-full animate-ping pointer-events-none"
                  style={{
                    left: node.x - node.radius - 3,
                    top: node.y - node.radius - 3,
                    width: (node.radius + 3) * 2,
                    height: (node.radius + 3) * 2,
                    border: `1px solid ${node.color}`,
                    opacity: 0.25,
                  }}
                />
              ))}
    </>
  );
}
