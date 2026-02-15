'use client';

import { useCallback, useMemo } from 'react';
import { Dice5, ArrowLeftRight, Target, Map } from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import type { LucideIcon } from 'lucide-react';

const ACCENT = '#f59e0b';

interface SystemNode {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  /** Position in the spatial layout (percentage-based) */
  x: number;
  y: number;
  dependencies: string[];
}

const NODES: SystemNode[] = [
  {
    id: 'ld-1',
    label: 'Procedural Gen',
    subtitle: 'Foundation',
    description: 'Rooms, corridors, connectivity',
    icon: Dice5,
    prompt: 'Implement a procedural level generation system with rooms, corridors, and proper connectivity.',
    x: 50,
    y: 8,
    dependencies: [],
  },
  {
    id: 'ld-2',
    label: 'Level Streaming',
    subtitle: 'Spatial',
    description: 'Load/unload, seamless transitions',
    icon: ArrowLeftRight,
    prompt: 'Set up level streaming with proper loading/unloading triggers and seamless transitions.',
    x: 18,
    y: 72,
    dependencies: ['ld-1'],
  },
  {
    id: 'ld-3',
    label: 'Spawn System',
    subtitle: 'Entities',
    description: 'Spawn points, waves, scaling',
    icon: Target,
    prompt: 'Create a flexible spawn system with spawn points, waves, difficulty scaling, and spawn rules.',
    x: 82,
    y: 72,
    dependencies: ['ld-1', 'ld-2'],
  },
];

/** SVG arrow dependency paths */
const DEPENDENCY_ARROWS: { from: string; to: string }[] = [
  { from: 'ld-1', to: 'ld-2' },
  { from: 'ld-1', to: 'ld-3' },
  { from: 'ld-2', to: 'ld-3' },
];

interface LevelDesignSpatialDiagramProps {
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  activeItemId: string | null;
}

const EMPTY_PROGRESS: Record<string, boolean> = {};

// Node card dimensions (px) — used for arrow endpoint calculations
const NODE_W = 168;
const NODE_H = 88;

export function LevelDesignSpatialDiagram({ onRunPrompt, isRunning, activeItemId }: LevelDesignSpatialDiagramProps) {
  const progress = useModuleStore((s) => s.checklistProgress['level-design'] ?? EMPTY_PROGRESS);

  const nodeStates = useMemo(() => {
    return NODES.map((node) => {
      const completed = !!progress[node.id];
      const prerequisitesMet = node.dependencies.every((d) => !!progress[d]);
      const locked = !prerequisitesMet && !completed;
      const isActive = activeItemId === node.id;
      return { ...node, completed, locked, isActive };
    });
  }, [progress, activeItemId]);

  const nodeMap = useMemo(
    () => Object.fromEntries(nodeStates.map((n) => [n.id, n])),
    [nodeStates],
  );

  const handleClick = useCallback(
    (node: SystemNode, locked: boolean) => {
      if (locked || isRunning) return;
      onRunPrompt(node.id, node.prompt);
    },
    [onRunPrompt, isRunning],
  );

  const completedCount = nodeStates.filter((n) => n.completed).length;

  return (
    <div className="w-full max-w-lg mx-auto select-none">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Map className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Level Systems</h3>
          <p className="text-2xs text-text-muted">
            {completedCount}/3 systems — build top-down
          </p>
        </div>
      </div>

      {/* Spatial diagram */}
      <div className="relative" style={{ height: 240 }}>
        {/* SVG arrows layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        >
          <defs>
            <marker
              id="ld-arrow"
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="8"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 3.5 L 0 7 z" fill={`${ACCENT}50`} />
            </marker>
            <marker
              id="ld-arrow-done"
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="8"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 3.5 L 0 7 z" fill="#22c55e50" />
            </marker>
            <marker
              id="ld-arrow-dim"
              viewBox="0 0 10 7"
              refX="10"
              refY="3.5"
              markerWidth="8"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 3.5 L 0 7 z" fill="var(--border)" />
            </marker>
          </defs>
          {DEPENDENCY_ARROWS.map(({ from, to }) => {
            const fromNode = nodeMap[from];
            const toNode = nodeMap[to];
            if (!fromNode || !toNode) return null;

            // Calculate center points of nodes (percentage → pixel)
            // Container is full width (we use percentages and viewBox won't work since container is flex)
            // Instead we use percentage-based coordinates in the SVG
            const fromCx = fromNode.x;
            const fromCy = fromNode.y;
            const toCx = toNode.x;
            const toCy = toNode.y;

            // Arrow from bottom of source to top of target (with offset for node size)
            // We'll compute approximate edge points
            const dx = toCx - fromCx;
            const dy = toCy - fromCy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / dist;
            const ny = dy / dist;

            // Offset from node center in percentage units (NODE_W/2 ~ 18%, NODE_H/2 ~ 18%)
            // These are approximate since we're mixing percentage layout
            const nodeHalfWPct = 18;
            const nodeHalfHPct = 18;
            const startOffset = ny > Math.abs(nx) ? nodeHalfHPct : nodeHalfWPct;
            const endOffset = ny > Math.abs(nx) ? nodeHalfHPct : nodeHalfWPct;

            const x1 = fromCx + nx * startOffset;
            const y1 = fromCy + ny * startOffset;
            const x2 = toCx - nx * endOffset;
            const y2 = toCy - ny * endOffset;

            const bothDone = fromNode.completed && toNode.completed;
            const anyLocked = toNode.locked;

            const markerEnd = bothDone
              ? 'url(#ld-arrow-done)'
              : anyLocked
                ? 'url(#ld-arrow-dim)'
                : 'url(#ld-arrow)';

            const strokeColor = bothDone
              ? '#22c55e30'
              : anyLocked
                ? 'var(--border)'
                : `${ACCENT}25`;

            return (
              <line
                key={`${from}-${to}`}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={anyLocked ? '4 3' : undefined}
                markerEnd={markerEnd}
              />
            );
          })}
        </svg>

        {/* Node cards */}
        {nodeStates.map((node) => {
          const Icon = node.icon;
          return (
            <button
              key={node.id}
              onClick={() => handleClick(node, node.locked)}
              disabled={isRunning && !node.isActive}
              className={`
                absolute rounded-lg border transition-all duration-base text-left group
                ${node.completed
                  ? 'border-status-green-strong bg-status-green-subtle'
                  : node.locked
                    ? 'border-border bg-[#0a0a1e] opacity-55 cursor-not-allowed'
                    : node.isActive
                      ? 'border-status-amber-strong bg-status-amber-subtle'
                      : 'border-border bg-surface-deep hover:border-status-amber-strong hover:bg-status-amber-subtle cursor-pointer'
                }
              `}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)',
                width: NODE_W,
                height: NODE_H,
                zIndex: 1,
              }}
            >
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
                  style={{
                    background: node.completed
                      ? 'linear-gradient(135deg, #22c55e15, #22c55e08)'
                      : node.locked
                        ? 'var(--surface)'
                        : `linear-gradient(135deg, ${ACCENT}15, ${ACCENT}08)`,
                    border: node.completed
                      ? '1px solid #22c55e22'
                      : node.locked
                        ? '1px solid var(--border)'
                        : `1px solid ${ACCENT}18`,
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{
                      color: node.completed
                        ? '#22c55e'
                        : node.locked
                          ? 'var(--text-muted)'
                          : ACCENT,
                    }}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold leading-tight ${
                        node.completed
                          ? 'text-[#22c55e]'
                          : node.locked
                            ? 'text-text-muted'
                            : 'text-text'
                      }`}
                    >
                      {node.label}
                    </span>
                  </div>
                  <p
                    className={`text-2xs mt-0.5 leading-relaxed ${
                      node.locked ? 'text-[#3a3e5a]' : 'text-text-muted'
                    }`}
                  >
                    {node.description}
                  </p>

                  {/* Status line */}
                  <div className="mt-1">
                    {node.completed ? (
                      <span className="text-2xs font-medium text-[#22c55e80] uppercase tracking-wider">Done</span>
                    ) : node.isActive ? (
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                        <span className="text-2xs font-medium uppercase tracking-wider" style={{ color: ACCENT }}>Building...</span>
                      </div>
                    ) : node.locked ? (
                      <span className="text-2xs text-[#3a3e5a] uppercase tracking-wider">Locked</span>
                    ) : (
                      <span
                        className="text-2xs font-medium uppercase tracking-wider opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all"
                        style={{ color: ACCENT }}
                      >
                        Build →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
