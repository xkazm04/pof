/**
 * The ONE module-level projection of the feature dependency graph.
 *
 * The Dependencies (`DependencyGraph`), Nexus (`NexusView`) and Overview
 * (`UnifiedSummaryView`) evaluator views each used to rebuild the same thing —
 * per-module done/blocked counts plus cross-module edges — and laid modules out
 * on a hand-kept 12-slot table. Every module missing from that table fell back to
 * the (0,0) cell, so the 22 content / game-systems / visual-gen modules all
 * painted over arpg-character. This module owns nodes, edges, placement and the
 * viewport size in one pure, deterministic function.
 *
 * Placement policy: the curated `MODULE_POSITIONS` cells are fixed anchors;
 * every other module lands below them in a band per category (band order =
 * `CATEGORIES` order, modules ordered by id inside a band), wrapping at the
 * anchor grid's width. A module added to `MODULE_FEATURE_DEFINITIONS` is
 * placed automatically.
 *
 * Done rule: `isFeatureDone` (implemented OR improved) — the constellation's rule.
 */

import type { SubModuleId } from '@/types/modules';
import type { FeatureStatus } from '@/types/feature-matrix';
import {
  MODULE_FEATURE_DEFINITIONS, buildDependencyMap, computeBlockers, type DependencyInfo,
} from '@/lib/feature-definitions';
import { CATEGORIES, MODULE_LABELS, SUB_MODULE_MAP } from '@/lib/module-registry';
import { isFeatureDone } from '@/lib/constellation/layout';

// ── Layout presets ───────────────────────────────────────────────────────────

/** Curated 4 × 3 cells for the 12 core-engine modules (logical build flow). */
export const MODULE_POSITIONS: Readonly<Record<string, { col: number; row: number }>> = {
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

export interface TopologyLayout {
  colWidth: number;
  rowHeight: number;
  nodeW: number;
  nodeH: number;
  padX: number;
  padY: number;
}

/** Compact layout — `DependencyGraph` (smaller nodes, tighter columns). */
export const TOPOLOGY_COMPACT: TopologyLayout = { colWidth: 180, rowHeight: 120, nodeW: 140, nodeH: 72, padX: 40, padY: 40 };

/** Roomy layout — `NexusView` (larger nodes, room for layer overlays). */
export const TOPOLOGY_ROOMY: TopologyLayout = { colWidth: 200, rowHeight: 130, nodeW: 160, nodeH: 80, padX: 50, padY: 50 };

// ── Placement ────────────────────────────────────────────────────────────────

export interface ModuleCell {
  col: number;
  row: number;
  categoryId: string;
}

let cachedCells: Map<SubModuleId, ModuleCell> | null = null;

/** Grid cell per module in `MODULE_FEATURE_DEFINITIONS` (static, so memoized). */
export function placeModules(): ReadonlyMap<SubModuleId, ModuleCell> {
  if (cachedCells) return cachedCells;
  const ids = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];
  const categoryOf = (id: SubModuleId) => SUB_MODULE_MAP[id]?.categoryId ?? 'uncategorized';
  const anchors = Object.values(MODULE_POSITIONS);
  const cols = Math.max(...anchors.map((p) => p.col)) + 1;
  let nextRow = Math.max(...anchors.map((p) => p.row)) + 1;

  const cells = new Map<SubModuleId, ModuleCell>();
  const bands = new Map<string, SubModuleId[]>();
  for (const id of ids) {
    const anchor = MODULE_POSITIONS[id];
    if (anchor) cells.set(id, { ...anchor, categoryId: categoryOf(id) });
    else bands.set(categoryOf(id), [...(bands.get(categoryOf(id)) ?? []), id]);
  }

  const rank = (c: string) => {
    const i = CATEGORIES.findIndex((cat) => cat.id === c);
    return i === -1 ? CATEGORIES.length : i;
  };
  const bandOrder = [...bands.keys()].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const categoryId of bandOrder) {
    const members = [...bands.get(categoryId)!].sort();
    members.forEach((id, i) => {
      cells.set(id, { col: i % cols, row: nextRow + Math.floor(i / cols), categoryId });
    });
    nextRow += Math.ceil(members.length / cols);
  }
  cachedCells = cells;
  return cells;
}

function centreOf(cell: { col: number; row: number }, layout: TopologyLayout) {
  return {
    x: layout.padX + cell.col * layout.colWidth + layout.nodeW / 2,
    y: layout.padY + cell.row * layout.rowHeight + layout.nodeH / 2,
  };
}

/** Centre of a module's node, or null for a module with no feature definitions. */
export function getNodeCenter(moduleId: SubModuleId, layout: TopologyLayout): { x: number; y: number } | null {
  const cell = placeModules().get(moduleId);
  return cell ? centreOf(cell, layout) : null;
}

// ── Projection ───────────────────────────────────────────────────────────────

export interface TopologyNode {
  moduleId: SubModuleId;
  label: string;
  categoryId: string;
  col: number;
  row: number;
  cx: number;
  cy: number;
  featureCount: number;
  /** Features that are done (`isFeatureDone`: implemented or improved). */
  implementedCount: number;
  /** Features that are not done and have an unmet prerequisite. */
  blockedCount: number;
  /** Dependencies of this module's features that point into another module. */
  crossDepCount: number;
}

export interface TopologyEdge {
  from: string;
  to: string;
  /** Number of cross-module feature dependencies this edge aggregates. */
  count: number;
  hasBlockers: boolean;
}

export interface ModuleTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  width: number;
  height: number;
  /** `computeBlockers(buildDependencyMap(), statusMap)` — for feature-level detail panels. */
  depMap: Map<string, DependencyInfo>;
}

/** True when a feature is not done and at least one prerequisite is unmet. */
export function isOpenBlocked(info: DependencyInfo | undefined, status: string): boolean {
  return (info?.isBlocked ?? false) && !isFeatureDone(status as FeatureStatus);
}

export function buildModuleTopology(
  statusMap: Map<string, string>,
  layout: TopologyLayout = TOPOLOGY_COMPACT,
): ModuleTopology {
  const depMap = computeBlockers(buildDependencyMap(), statusMap);
  const cells = placeModules();
  const nodes: TopologyNode[] = [];
  const edgeIndex = new Map<string, TopologyEdge>();
  let width = 0;
  let height = 0;

  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    const id = moduleId as SubModuleId;
    const cell = cells.get(id)!;
    const { x, y } = centreOf(cell, layout);
    let implementedCount = 0;
    let blockedCount = 0;
    let crossDepCount = 0;

    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      const status = statusMap.get(key) ?? 'unknown';
      if (isFeatureDone(status as FeatureStatus)) implementedCount++;
      const info = depMap.get(key);
      if (isOpenBlocked(info, status)) blockedCount++;
      for (const dep of info?.deps ?? []) {
        if (dep.moduleId === moduleId) continue;
        crossDepCount++;
        const isBlocker = info!.blockers.some((b) => b.key === dep.key);
        const edgeId = JSON.stringify([dep.moduleId, moduleId]);
        const edge = edgeIndex.get(edgeId);
        if (edge) {
          edge.count++;
          edge.hasBlockers ||= isBlocker;
        } else {
          edgeIndex.set(edgeId, { from: dep.moduleId, to: moduleId, count: 1, hasBlockers: isBlocker });
        }
      }
    }

    nodes.push({
      moduleId: id,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      categoryId: cell.categoryId,
      col: cell.col,
      row: cell.row,
      cx: x,
      cy: y,
      featureCount: features.length,
      implementedCount,
      blockedCount,
      crossDepCount,
    });
    width = Math.max(width, x + layout.nodeW / 2 + layout.padX);
    height = Math.max(height, y + layout.nodeH / 2 + layout.padY);
  }

  return { nodes, edges: [...edgeIndex.values()], width, height, depMap };
}

/**
 * viewBox for a zoom level: narrow the box around the graph centre instead of
 * CSS-scaling the `<svg>` (a scaled element keeps its layout box, so inside an
 * `overflow-hidden` frame zooming in cropped the graph instead of magnifying it).
 */
export function zoomViewBox(width: number, height: number, zoom: number): string {
  const w = width / zoom;
  const h = height / zoom;
  return `${(width - w) / 2} ${(height - h) / 2} ${w} ${h}`;
}
