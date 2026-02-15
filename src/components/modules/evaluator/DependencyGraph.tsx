'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Link2, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import type { DependencyInfo, ResolvedDependency } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { MODULE_COLORS as CHART_MODULE_COLORS } from '@/lib/chart-colors';

// ─── Module layout config ───────────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  'arpg-character': CHART_MODULE_COLORS.core,
  'arpg-animation': CHART_MODULE_COLORS.core,
  'arpg-gas': CHART_MODULE_COLORS.core,
  'arpg-combat': CHART_MODULE_COLORS.core,
  'arpg-enemy-ai': CHART_MODULE_COLORS.core,
  'arpg-inventory': CHART_MODULE_COLORS.core,
  'arpg-loot': CHART_MODULE_COLORS.core,
  'arpg-ui': CHART_MODULE_COLORS.core,
  'arpg-progression': CHART_MODULE_COLORS.core,
  'arpg-world': CHART_MODULE_COLORS.core,
  'arpg-save': CHART_MODULE_COLORS.core,
  'arpg-polish': CHART_MODULE_COLORS.core,
};

// Arrange modules in a roughly logical flow (left→right, top→bottom)
// 4 columns × 3 rows
const MODULE_POSITIONS: Record<string, { col: number; row: number }> = {
  'arpg-character':    { col: 0, row: 0 },
  'arpg-animation':    { col: 1, row: 0 },
  'arpg-gas':          { col: 2, row: 0 },
  'arpg-combat':       { col: 3, row: 0 },
  'arpg-enemy-ai':     { col: 0, row: 1 },
  'arpg-inventory':    { col: 1, row: 1 },
  'arpg-loot':         { col: 2, row: 1 },
  'arpg-ui':           { col: 3, row: 1 },
  'arpg-progression':  { col: 0, row: 2 },
  'arpg-world':        { col: 1, row: 2 },
  'arpg-save':         { col: 2, row: 2 },
  'arpg-polish':       { col: 3, row: 2 },
};

const COL_WIDTH = 180;
const ROW_HEIGHT = 120;
const NODE_W = 140;
const NODE_H = 72;
const PAD_X = 40;
const PAD_Y = 40;

function getNodeCenter(moduleId: string) {
  const pos = MODULE_POSITIONS[moduleId] ?? { col: 0, row: 0 };
  return {
    x: PAD_X + pos.col * COL_WIDTH + NODE_W / 2,
    y: PAD_Y + pos.row * ROW_HEIGHT + NODE_H / 2,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ModuleNode {
  moduleId: string;
  label: string;
  color: string;
  featureCount: number;
  blockedCount: number;
  implementedCount: number;
  cx: number;
  cy: number;
}

interface Edge {
  from: string;
  to: string;
  count: number; // number of cross-module deps
  hasBlockers: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────────

interface DependencyGraphProps {
  onNavigateTab?: (tab: string) => void;
}

export function DependencyGraph({ onNavigateTab }: DependencyGraphProps) {
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/feature-matrix/all-statuses');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const row of data.statuses ?? []) {
          map.set(`${row.moduleId}::${row.featureName}`, row.status);
        }
        setStatusMap(map);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  // Build dep map with blocker info
  const depMap = useMemo(() => {
    const base = buildDependencyMap();
    return computeBlockers(base, statusMap);
  }, [statusMap]);

  // Build nodes
  const nodes: ModuleNode[] = useMemo(() => {
    return Object.keys(MODULE_FEATURE_DEFINITIONS).map((moduleId) => {
      const features = MODULE_FEATURE_DEFINITIONS[moduleId];
      const center = getNodeCenter(moduleId);
      let blockedCount = 0;
      let implementedCount = 0;

      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const status = statusMap.get(key) ?? 'unknown';
        if (status === 'implemented') implementedCount++;
        const info = depMap.get(key);
        if (info?.isBlocked && status !== 'implemented') blockedCount++;
      }

      return {
        moduleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        color: MODULE_COLORS[moduleId] ?? 'var(--text-muted)',
        featureCount: features.length,
        blockedCount,
        implementedCount,
        cx: center.x,
        cy: center.y,
      };
    });
  }, [depMap, statusMap]);

  // Build cross-module edges
  const edges: Edge[] = useMemo(() => {
    const edgeMap = new Map<string, { count: number; hasBlockers: boolean }>();

    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const info = depMap.get(key);
        if (!info) continue;

        for (const dep of info.deps) {
          if (dep.moduleId === moduleId) continue; // skip same-module
          const edgeKey = `${dep.moduleId}->${moduleId}`;
          const existing = edgeMap.get(edgeKey);
          const isBlocker = info.blockers.some((b) => b.key === dep.key);
          if (existing) {
            existing.count++;
            if (isBlocker) existing.hasBlockers = true;
          } else {
            edgeMap.set(edgeKey, { count: 1, hasBlockers: isBlocker });
          }
        }
      }
    }

    return Array.from(edgeMap.entries()).map(([key, val]) => {
      const [from, to] = key.split('->');
      return { from, to, count: val.count, hasBlockers: val.hasBlockers };
    });
  }, [depMap]);

  // Feature-level details for selected module
  const selectedDetails = useMemo(() => {
    if (!selectedModule) return null;
    const features = MODULE_FEATURE_DEFINITIONS[selectedModule] ?? [];
    return features.map((feat) => {
      const key = `${selectedModule}::${feat.featureName}`;
      const status = statusMap.get(key) ?? 'unknown';
      const info = depMap.get(key);
      return {
        featureName: feat.featureName,
        status,
        deps: info?.deps ?? [],
        blockers: info?.blockers ?? [],
        isBlocked: (info?.isBlocked ?? false) && status !== 'implemented',
      };
    });
  }, [selectedModule, depMap, statusMap]);

  const svgWidth = PAD_X * 2 + 3 * COL_WIDTH + NODE_W;
  const svgHeight = PAD_Y * 2 + 2 * ROW_HEIGHT + NODE_H;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (statusMap.size === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No Feature Data Yet"
        description="Review your module features first so the dependency graph can show implementation status and blockers across modules."
        iconColor="#ef4444"
        action={onNavigateTab ? {
          label: 'Review Features',
          onClick: () => onNavigateTab('features'),
          color: '#ef4444',
        } : undefined}
      />
    );
  }

  const highlightModule = hoveredModule ?? selectedModule;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-[#ef4444]" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Cross-Module Dependencies
          </span>
          <span className="text-2xs text-text-muted">
            {edges.length} connections across {nodes.length} modules
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-2xs text-text-muted w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph */}
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
              <path d="M 0 0 L 10 3.5 L 0 7 z" fill="#fb923c" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const fromCenter = getNodeCenter(edge.from);
            const toCenter = getNodeCenter(edge.to);

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
                  stroke={edge.hasBlockers ? '#fb923c' : 'var(--text-muted)'}
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
                onClick={() => setSelectedModule(isSelected ? null : node.moduleId)}
                onMouseEnter={() => setHoveredModule(node.moduleId)}
                onMouseLeave={() => setHoveredModule(null)}
                className="cursor-pointer"
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
                  stroke={isSelected ? '#ef4444' : isHighlighted ? 'var(--border-bright)' : 'var(--border)'}
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
                  fill="#4ade80"
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
                </text>

                {/* Blocked indicator */}
                {node.blockedCount > 0 && (
                  <g transform={`translate(${node.cx + NODE_W / 2 - 10}, ${node.cy - NODE_H / 2 + 6})`}>
                    <circle r="7" fill="#f8717120" />
                    <text fill="#fb923c" fontSize="9" fontWeight="700" textAnchor="middle" dy="3">!</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-px" style={{ backgroundColor: 'var(--text-muted)' }} />
          Dependency
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-t border-dashed" style={{ borderColor: '#fb923c' }} />
          Has blockers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f8717120] flex items-center justify-center text-[#fb923c] text-2xs font-bold">!</span>
          Module has blocked features
        </span>
      </div>

      {/* Selected module detail */}
      <AnimatePresence>
        {selectedModule && selectedDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <SurfaceCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-text">
                  {MODULE_LABELS[selectedModule] ?? selectedModule}
                </span>
                <span className="text-xs text-text-muted">
                  {selectedDetails.filter((f) => f.isBlocked).length} blocked features
                </span>
              </div>

              <div className="space-y-1">
                {selectedDetails
                  .filter((f) => f.deps.length > 0)
                  .map((feat) => (
                    <div
                      key={feat.featureName}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
                    >
                      {/* Status indicator */}
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{
                          backgroundColor:
                            feat.status === 'implemented'
                              ? '#4ade80'
                              : feat.status === 'partial'
                                ? '#fbbf24'
                                : feat.status === 'missing'
                                  ? '#f87171'
                                  : 'var(--text-muted)',
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#d0d4e8] truncate">
                            {feat.featureName}
                          </span>
                          {feat.isBlocked && (
                            <AlertTriangle className="w-3 h-3 text-[#fb923c] flex-shrink-0" />
                          )}
                        </div>

                        {/* Dependency pills */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {feat.deps.map((dep) => {
                            const isBlocker = feat.blockers.some((b) => b.key === dep.key);
                            const isCross = dep.moduleId !== selectedModule;
                            return (
                              <span
                                key={dep.key}
                                className={`inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 rounded border ${
                                  isBlocker
                                    ? 'bg-[#f8717108] border-[#f87171]/20 text-[#fb923c]'
                                    : 'bg-[#4ade8008] border-[#4ade80]/15 text-text-muted'
                                }`}
                              >
                                {isCross && (
                                  <span className="text-2xs text-text-muted">
                                    {MODULE_LABELS[dep.moduleId] ?? dep.moduleId}/
                                  </span>
                                )}
                                {dep.featureName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </SurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
