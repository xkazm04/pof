'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Link2, Loader2, ZoomIn, ZoomOut, Maximize2, X,
  Network, Eye, EyeOff, Play, CheckCircle2, XCircle, Clock,
  Zap, BookOpen, BarChart3, Swords, Sparkles,
} from 'lucide-react';
import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers } from '@/lib/feature-definitions';
import { MODULE_LABELS, SUB_MODULE_MAP } from '@/lib/module-registry';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { SUB_GENRE_TEMPLATES } from '@/lib/genre-evolution-engine';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { SubModuleId, ChecklistItem } from '@/types/modules';
import type { Recommendation } from '@/types/evaluator';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER, STATUS_NEUTRAL, ACCENT_VIOLET, MODULE_COLORS, OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30 } from '@/lib/chart-colors';

// ─── Layout constants (same as DependencyGraph) ────────────────────────────

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

const COL_WIDTH = 200;
const ROW_HEIGHT = 130;
const NODE_W = 160;
const NODE_H = 80;
const PAD_X = 50;
const PAD_Y = 50;

function getNodeCenter(moduleId: SubModuleId) {
  const pos = MODULE_POSITIONS[moduleId] ?? { col: 0, row: 0 };
  return {
    x: PAD_X + pos.col * COL_WIDTH + NODE_W / 2,
    y: PAD_Y + pos.row * ROW_HEIGHT + NODE_H / 2,
  };
}

// ─── Data layer toggle ─────────────────────────────────────────────────────

type LayerId = 'patterns' | 'builds' | 'sessions' | 'genre';

interface LayerConfig {
  id: LayerId;
  label: string;
  color: string;
  icon: typeof Eye;
}

const LAYERS: LayerConfig[] = [
  { id: 'patterns', label: 'Pattern Success', color: STATUS_SUCCESS, icon: BookOpen },
  { id: 'builds', label: 'Build Health', color: MODULE_COLORS.evaluator, icon: AlertTriangle },
  { id: 'sessions', label: 'Session Activity', color: STATUS_INFO, icon: BarChart3 },
  { id: 'genre', label: 'Genre Features', color: ACCENT_VIOLET, icon: Swords },
];

// ─── Types ─────────────────────────────────────────────────────────────────

interface NexusNode {
  moduleId: SubModuleId;
  label: string;
  cx: number;
  cy: number;
  featureCount: number;
  implementedCount: number;
  blockedCount: number;
  // Layer 1: pattern success
  patternSuccessRate: number | null; // 0-1 or null if no patterns
  patternCount: number;
  // Layer 2: build health
  hasBuildFailure: boolean;
  // Layer 3: session activity
  sessionCount: number;
  avgDurationMs: number;
  lastTaskSuccess: boolean | null;
  // Layer 4: genre coverage
  genreItemCount: number; // how many genre priority items belong to this module
  // Checklist
  checklistTotal: number;
  checklistDone: number;
  // Health
  healthScore: number;
  healthStatus: string;
}

interface NexusEdge {
  from: string;
  to: string;
  count: number;
  hasBlockers: boolean;
}

// ─── Stable empty constants ────────────────────────────────────────────────

const EMPTY_PATTERNS: ImplementationPattern[] = [];
const EMPTY_PROGRESS: Record<string, boolean> = {};
const EMPTY_HISTORY: { id: string; prompt: string; status: string; timestamp: number }[] = [];

// ─── Genre item → module mapping ───────────────────────────────────────────

const ITEM_PREFIX_TO_MODULE: Record<string, string> = {
  ac: 'arpg-character',
  aa: 'arpg-animation',
  ag: 'arpg-gas',
  acb: 'arpg-combat',
  ae: 'arpg-enemy-ai',
  ai: 'arpg-inventory',
  al: 'arpg-loot',
  au: 'arpg-ui',
  ap: 'arpg-progression',
  aw: 'arpg-world',
  as: 'arpg-save',
  apl: 'arpg-polish',
};

function itemIdToModule(itemId: string): string | undefined {
  // Try longest prefix first (acb before ac)
  for (const prefix of ['acb', 'apl', 'ac', 'aa', 'ag', 'ae', 'ai', 'al', 'au', 'ap', 'aw', 'as']) {
    if (itemId.startsWith(prefix + '-')) return ITEM_PREFIX_TO_MODULE[prefix];
  }
  return undefined;
}

// Count genre priority items per module across all templates
function computeGenreCoverage(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const template of SUB_GENRE_TEMPLATES) {
    for (const itemId of template.priorityItems) {
      const mod = itemIdToModule(itemId);
      if (mod) counts[mod] = (counts[mod] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NexusView() {
  // State
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['patterns', 'builds']));

  // Stores
  const patterns = usePatternLibraryStore((s) => s.patterns) ?? EMPTY_PATTERNS;
  const checklistProgress = useModuleStore((s) => s.checklistProgress);
  const moduleHealth = useModuleStore((s) => s.moduleHealth);
  const moduleHistory = useModuleStore((s) => s.moduleHistory);
  const lastScan = useEvaluatorStore((s) => s.lastScan);
  const sessions = useCLIPanelStore((s) => s.sessions);

  // Fetch feature statuses
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

  // Build dep map
  const depMap = useMemo(() => {
    const base = buildDependencyMap();
    return computeBlockers(base, statusMap);
  }, [statusMap]);

  // Genre coverage
  const genreCoverage = useMemo(() => computeGenreCoverage(), []);

  // Compute pattern stats per module
  const patternStats = useMemo(() => {
    const stats: Record<string, { rate: number; count: number }> = {};
    const grouped: Record<string, ImplementationPattern[]> = {};
    for (const p of patterns) {
      if (!grouped[p.moduleId]) grouped[p.moduleId] = [];
      grouped[p.moduleId].push(p);
    }
    for (const [moduleId, pats] of Object.entries(grouped)) {
      const avgRate = pats.reduce((s, p) => s + p.successRate, 0) / pats.length;
      stats[moduleId] = { rate: avgRate, count: pats.length };
    }
    return stats;
  }, [patterns]);

  // Session stats per module from CLI store
  const sessionStats = useMemo(() => {
    const stats: Record<string, { count: number; lastSuccess: boolean | null }> = {};
    for (const session of Object.values(sessions)) {
      if (!session.moduleId) continue;
      const existing = stats[session.moduleId];
      if (!existing) {
        stats[session.moduleId] = { count: 1, lastSuccess: session.lastTaskSuccess };
      } else {
        existing.count++;
        if (session.lastActivityAt > 0) {
          existing.lastSuccess = session.lastTaskSuccess;
        }
      }
    }
    return stats;
  }, [sessions]);

  // Build nodes
  const nodes: NexusNode[] = useMemo(() => {
    return Object.keys(MODULE_FEATURE_DEFINITIONS).map((moduleId) => {
      const features = MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? [];
      const center = getNodeCenter(moduleId as SubModuleId);
      let blockedCount = 0;
      let implementedCount = 0;

      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const status = statusMap.get(key) ?? 'unknown';
        if (status === 'implemented') implementedCount++;
        const info = depMap.get(key);
        if (info?.isBlocked && status !== 'implemented') blockedCount++;
      }

      const ps = patternStats[moduleId];
      const ss = sessionStats[moduleId];
      const health = moduleHealth[moduleId];
      const progress = checklistProgress[moduleId] ?? EMPTY_PROGRESS;
      const moduleDef = SUB_MODULE_MAP[moduleId as SubModuleId];
      const checklist = moduleDef?.checklist ?? [];
      const checklistDone = checklist.filter((item: ChecklistItem) => progress[item.id]).length;

      // Build failure: check if last scan has critical recs for this module
      const hasBuildFailure = lastScan?.recommendations.some(
        (r) => r.moduleId === moduleId && r.priority === 'critical',
      ) ?? false;

      // Session average duration from module history
      const history = moduleHistory[moduleId] ?? EMPTY_HISTORY;
      const avgDuration = history.length > 0
        ? history.reduce((s, h) => s + (h.duration ?? 0), 0) / history.length
        : 0;

      return {
        moduleId: moduleId as SubModuleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        cx: center.x,
        cy: center.y,
        featureCount: features.length,
        implementedCount,
        blockedCount,
        patternSuccessRate: ps?.rate ?? null,
        patternCount: ps?.count ?? 0,
        hasBuildFailure,
        sessionCount: ss?.count ?? 0,
        avgDurationMs: avgDuration,
        lastTaskSuccess: ss?.lastSuccess ?? null,
        genreItemCount: genreCoverage[moduleId] ?? 0,
        checklistTotal: checklist.length,
        checklistDone,
        healthScore: health?.score ?? 0,
        healthStatus: health?.status ?? 'not-started',
      };
    });
  }, [depMap, statusMap, patternStats, sessionStats, moduleHealth, checklistProgress, moduleHistory, lastScan, genreCoverage]);

  // Build edges
  const edges: NexusEdge[] = useMemo(() => {
    const edgeMap = new Map<string, { count: number; hasBlockers: boolean }>();
    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      for (const feat of features) {
        const key = `${moduleId}::${feat.featureName}`;
        const info = depMap.get(key);
        if (!info) continue;
        for (const dep of info.deps) {
          if (dep.moduleId === moduleId) continue;
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

  // Layer toggle
  const toggleLayer = (id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const svgWidth = PAD_X * 2 + 3 * COL_WIDTH + NODE_W;
  const svgHeight = PAD_Y * 2 + 2 * ROW_HEIGHT + NODE_H;
  const highlightModule = hoveredModule ?? selectedModule;

  // Selected module data for deep-dive
  const selectedNode = nodes.find((n) => n.moduleId === selectedModule);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#a78bfa]" />
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Nexus Intelligence Map
          </span>
          <span className="text-2xs text-text-muted">
            {nodes.length} modules · {edges.length} connections
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles */}
          {LAYERS.map((layer) => {
            const active = activeLayers.has(layer.id);
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium border transition-colors ${
                  active
                    ? 'border-border-bright bg-surface text-text'
                    : 'border-border bg-surface-deep text-text-muted hover:text-text'
                }`}
              >
                <Icon className="w-2.5 h-2.5" style={{ color: active ? layer.color : undefined }} />
                {layer.label}
                {active ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 opacity-40" />}
              </button>
            );
          })}

          {/* Zoom */}
          <div className="flex items-center gap-0.5 ml-2">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-2xs text-text-muted w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button onClick={() => setZoom(1)} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Graph */}
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-2xs text-text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-px bg-text-muted" /> Dependency
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t border-dashed" style={{ borderColor: STATUS_BLOCKER }} /> Blocker
        </span>
        {activeLayers.has('patterns') && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-4 rounded-sm bg-[#4ade80]" /> Pattern success
          </span>
        )}
        {activeLayers.has('builds') && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[#ef4444] opacity-60" style={{ boxShadow: '0 0 4px #ef4444' }} /> Build failure
          </span>
        )}
        {activeLayers.has('genre') && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[#a78bfa] opacity-60" style={{ boxShadow: '0 0 4px #a78bfa' }} /> Genre feature
          </span>
        )}
      </div>

      {/* Deep-dive panel */}
      <AnimatePresence>
        {selectedModule && selectedNode && (
          <NodeDeepDivePanel
            node={selectedNode}
            patterns={patterns.filter((p) => p.moduleId === selectedModule)}
            recommendations={lastScan?.recommendations.filter((r) => r.moduleId === selectedModule) ?? []}
            history={(moduleHistory[selectedModule] ?? EMPTY_HISTORY) as { id: string; prompt: string; status: string; timestamp: number; duration?: number }[]}
            onClose={() => setSelectedModule(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Deep Dive Panel ───────────────────────────────────────────────────────

function NodeDeepDivePanel({
  node,
  patterns,
  recommendations,
  history,
  onClose,
}: {
  node: NexusNode;
  patterns: ImplementationPattern[];
  recommendations: Recommendation[];
  history: { id: string; prompt: string; status: string; timestamp: number; duration?: number }[];
  onClose: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>('checklist');

  const healthColor = node.healthScore >= 70 ? STATUS_SUCCESS : node.healthScore >= 40 ? STATUS_WARNING : STATUS_ERROR;
  const successCount = history.filter((h) => h.status === 'completed').length;
  const failCount = history.filter((h) => h.status === 'failed').length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <SurfaceCard className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, border: `1px solid ${ACCENT_VIOLET}${OPACITY_30}` }}
            >
              <Network className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{node.label}</h3>
              <div className="flex items-center gap-2 text-2xs text-text-muted">
                <span>{node.implementedCount}/{node.featureCount} features</span>
                <span>·</span>
                <span>{node.checklistDone}/{node.checklistTotal} checklist</span>
                {node.healthScore > 0 && (
                  <>
                    <span>·</span>
                    <span style={{ color: healthColor }}>Health: {node.healthScore}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <MiniStat label="Patterns" value={patterns.length.toString()} color={STATUS_SUCCESS} />
          <MiniStat
            label="Success Rate"
            value={node.patternSuccessRate !== null ? `${Math.round(node.patternSuccessRate * 100)}%` : '—'}
            color={node.patternSuccessRate !== null && node.patternSuccessRate >= 0.7 ? STATUS_SUCCESS : STATUS_WARNING}
          />
          <MiniStat label="Sessions" value={`${successCount}/${successCount + failCount}`} color={STATUS_INFO} />
          <MiniStat label="Genre Items" value={node.genreItemCount.toString()} color={ACCENT_VIOLET} />
        </div>

        {/* Sections */}
        <div className="space-y-1">
          {/* Patterns section */}
          {patterns.length > 0 && (
            <CollapsibleSection
              title="Matching Patterns"
              count={patterns.length}
              color={STATUS_SUCCESS}
              isOpen={expandedSection === 'patterns'}
              onToggle={() => setExpandedSection(expandedSection === 'patterns' ? null : 'patterns')}
            >
              <div className="space-y-1.5">
                {patterns.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                    <BookOpen className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                    <span className="text-xs text-text flex-1 truncate">{p.title}</span>
                    <span className="text-2xs font-medium" style={{ color: p.successRate >= 0.7 ? STATUS_SUCCESS : STATUS_WARNING }}>
                      {Math.round(p.successRate * 100)}%
                    </span>
                    <span className="text-2xs text-text-muted">{p.sessionCount} uses</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Recommendations section */}
          {recommendations.length > 0 && (
            <CollapsibleSection
              title="Recommendations"
              count={recommendations.length}
              color={MODULE_COLORS.evaluator}
              isOpen={expandedSection === 'recs'}
              onToggle={() => setExpandedSection(expandedSection === 'recs' ? null : 'recs')}
            >
              <div className="space-y-1.5">
                {recommendations.map((rec) => {
                  const prioColor = rec.priority === 'critical' ? STATUS_ERROR : rec.priority === 'high' ? STATUS_BLOCKER : STATUS_WARNING;
                  return (
                    <div key={rec.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-background">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: prioColor }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-text">{rec.title}</span>
                        <p className="text-2xs text-text-muted mt-0.5 line-clamp-2">{rec.description}</p>
                      </div>
                      <span className="text-2xs font-bold uppercase px-1 py-0.5 rounded" style={{ color: prioColor, backgroundColor: `${prioColor}15` }}>
                        {rec.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Session history section */}
          {history.length > 0 && (
            <CollapsibleSection
              title="Recent CLI Sessions"
              count={history.length}
              color={STATUS_INFO}
              isOpen={expandedSection === 'sessions'}
              onToggle={() => setExpandedSection(expandedSection === 'sessions' ? null : 'sessions')}
            >
              <div className="space-y-0.5">
                {history.slice(-8).reverse().map((h) => (
                  <div key={h.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-background">
                    {h.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-[#f87171] flex-shrink-0" />
                    )}
                    <span className="text-xs text-text-muted flex-1 truncate">{h.prompt.slice(0, 60)}</span>
                    {h.duration && (
                      <span className="text-2xs text-text-muted flex-shrink-0">
                        {h.duration > 60000 ? `${Math.round(h.duration / 60000)}m` : `${Math.round(h.duration / 1000)}s`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Genre evolution section */}
          {node.genreItemCount > 0 && (
            <CollapsibleSection
              title="Genre Evolution Features"
              count={node.genreItemCount}
              color={ACCENT_VIOLET}
              isOpen={expandedSection === 'genre'}
              onToggle={() => setExpandedSection(expandedSection === 'genre' ? null : 'genre')}
            >
              <div className="space-y-1">
                {SUB_GENRE_TEMPLATES.filter((t) =>
                  t.priorityItems.some((itemId) => itemIdToModule(itemId) === node.moduleId),
                ).map((template) => {
                  const relevantItems = template.priorityItems.filter(
                    (itemId) => itemIdToModule(itemId) === node.moduleId,
                  );
                  return (
                    <div key={template.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background">
                      <Sparkles className="w-3 h-3 text-[#a78bfa] flex-shrink-0" />
                      <span className="text-xs text-text">{template.label}</span>
                      <span className="text-2xs text-text-muted">{relevantItems.length} priority items</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-background rounded-md px-2.5 py-2 text-center">
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-2xs text-text-muted">{label}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  color,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-xs font-semibold text-text">{title}</span>
        <span className="text-2xs font-medium px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15` }}>
          {count}
        </span>
        <span className="ml-auto text-text-muted">
          {isOpen ? <X className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
