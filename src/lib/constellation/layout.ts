/**
 * Feature-constellation layout engine.
 *
 * Turns a single module's slice of `buildDependencyMap()` into a layered graph
 * of feature nodes — the data backbone for the "living tech-tree constellation"
 * visualization. Each feature becomes a node, placed in a column (layer) equal
 * to its longest intra-module dependency chain so foundations sit on the left
 * and advanced features fan out to the right, like a skill tree.
 *
 * This module is deliberately **presentation-free and pure**: it carries each
 * feature's verified matrix `status` (the component maps it to a chart-colors
 * token) and computes positions deterministically, so it is fully unit-testable
 * without a DOM and renders identically on the server and client.
 */

import type { SubModuleId } from '@/types/modules';
import type { FeatureStatus } from '@/types/feature-matrix';
import {
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
  computeBlockers,
  type ResolvedDependency,
} from '@/lib/feature-definitions';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ConstellationNode {
  /** Fully qualified key: "moduleId::featureName". */
  key: string;
  featureName: string;
  category: string;
  description: string;
  /** Verified matrix status (defaults to 'unknown' when unseeded). */
  status: FeatureStatus;
  /** Column index — longest intra-module dependency chain depth (0 = root). */
  layer: number;
  /** Row index within the layer (after vertical centering). */
  row: number;
  /** Center coordinates in SVG space. */
  x: number;
  y: number;
  /** Same-module prerequisites that resolve to a node in this layout. */
  deps: ResolvedDependency[];
  /** Cross-module prerequisites (rendered as external inputs, not laid out). */
  externalDeps: ResolvedDependency[];
  /** Unmet prerequisites (intra + cross) — drives the dimmed/blocked treatment. */
  blockers: ResolvedDependency[];
  /** True when any prerequisite is not yet implemented. */
  isBlocked: boolean;
  /** How many features in this module depend on this one (local fan-out). */
  dependentCount: number;
}

export interface ConstellationEdge {
  /** Prerequisite node key (arrow tail). */
  fromKey: string;
  /** Dependent node key (arrow head). */
  toKey: string;
  /** True when the prerequisite is not yet implemented. */
  blocked: boolean;
}

export interface ConstellationLayout {
  moduleId: SubModuleId;
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  /** SVG viewport size. */
  width: number;
  height: number;
  /** Number of columns (max layer + 1), 0 when empty. */
  layerCount: number;
  /** Key of the recommended "do this next" feature, or null. */
  nextKey: string | null;
}

export interface LayoutOptions {
  /** Horizontal center-to-center spacing between layers. */
  colGap: number;
  /** Vertical center-to-center spacing between rows. */
  rowGap: number;
  nodeW: number;
  nodeH: number;
  padX: number;
  padY: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  colGap: 210,
  rowGap: 84,
  nodeW: 158,
  nodeH: 56,
  padX: 32,
  padY: 32,
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** A feature counts as "done" when implemented or improved. */
export function isFeatureDone(status: FeatureStatus): boolean {
  return status === 'implemented' || status === 'improved';
}

// ── Engine ────────────────────────────────────────────────────────────────

/**
 * Build the layered constellation layout for one module.
 *
 * @param moduleId  module whose features to render
 * @param statusMap feature-status map keyed by "moduleId::featureName"
 * @param options   layout spacing overrides
 */
export function layoutModuleConstellation(
  moduleId: SubModuleId,
  statusMap: Map<string, string>,
  options: Partial<LayoutOptions> = {},
): ConstellationLayout {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const features = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];

  if (features.length === 0) {
    return { moduleId, nodes: [], edges: [], width: opts.padX * 2, height: opts.padY * 2, layerCount: 0, nextKey: null };
  }

  const depMap = computeBlockers(buildDependencyMap(), statusMap);
  const keyOf = (featureName: string) => `${moduleId}::${featureName}`;
  const moduleKeys = new Set(features.map((f) => keyOf(f.featureName)));

  // ── Resolve each feature's intra-/cross-module dependencies ────────────────
  interface Raw {
    key: string;
    featureName: string;
    category: string;
    description: string;
    status: FeatureStatus;
    deps: ResolvedDependency[];
    externalDeps: ResolvedDependency[];
    blockers: ResolvedDependency[];
    isBlocked: boolean;
  }

  const raw = new Map<string, Raw>();
  for (const feat of features) {
    const key = keyOf(feat.featureName);
    const info = depMap.get(key);
    const allDeps = info?.deps ?? [];
    // Intra-module deps that actually resolve to a node in this module.
    const deps = allDeps.filter((d) => d.moduleId === moduleId && moduleKeys.has(d.key));
    const externalDeps = allDeps.filter((d) => d.moduleId !== moduleId);
    raw.set(key, {
      key,
      featureName: feat.featureName,
      category: feat.category,
      description: feat.description,
      status: (statusMap.get(key) as FeatureStatus) ?? 'unknown',
      deps,
      externalDeps,
      blockers: info?.blockers ?? [],
      isBlocked: (info?.isBlocked ?? false) && !isFeatureDone((statusMap.get(key) as FeatureStatus) ?? 'unknown'),
    });
  }

  // ── Longest-path layering over intra-module deps (cycle-safe) ──────────────
  const layerCache = new Map<string, number>();
  const computeLayerFor = (key: string): number => {
    const cached = layerCache.get(key);
    if (cached !== undefined) return cached;
    layerCache.set(key, 0); // tentative — also breaks any accidental cycle
    const node = raw.get(key);
    if (!node || node.deps.length === 0) {
      layerCache.set(key, 0);
      return 0;
    }
    let max = 0;
    for (const dep of node.deps) {
      if (dep.key === key) continue;
      max = Math.max(max, computeLayerFor(dep.key) + 1);
    }
    layerCache.set(key, max);
    return max;
  };

  const layerOf = new Map<string, number>();
  for (const key of raw.keys()) layerOf.set(key, computeLayerFor(key));

  // ── Local fan-out (how many module features depend on each node) ───────────
  const dependentCount = new Map<string, number>();
  for (const node of raw.values()) {
    for (const dep of node.deps) {
      dependentCount.set(dep.key, (dependentCount.get(dep.key) ?? 0) + 1);
    }
  }

  // ── Group by layer, preserving feature-definition order within a layer ─────
  const layers = new Map<number, string[]>();
  for (const feat of features) {
    const key = keyOf(feat.featureName);
    const layer = layerOf.get(key) ?? 0;
    const bucket = layers.get(layer) ?? [];
    bucket.push(key);
    layers.set(layer, bucket);
  }

  const layerCount = Math.max(...layerOf.values()) + 1;
  const maxRows = Math.max(...Array.from(layers.values(), (b) => b.length));

  // ── Position nodes (columns = layers, rows vertically centered per column) ─
  const nodes: ConstellationNode[] = [];
  for (const [layer, keys] of layers) {
    const startRow = (maxRows - keys.length) / 2; // center this column
    keys.forEach((key, i) => {
      const r = raw.get(key)!;
      const row = startRow + i;
      nodes.push({
        ...r,
        layer,
        row,
        x: opts.padX + opts.nodeW / 2 + layer * opts.colGap,
        y: opts.padY + opts.nodeH / 2 + row * opts.rowGap,
        dependentCount: dependentCount.get(key) ?? 0,
      });
    });
  }
  // Stable order: by layer, then row.
  nodes.sort((a, b) => (a.layer - b.layer) || (a.row - b.row));

  // ── Intra-module dependency edges (prerequisite → dependent) ───────────────
  const edges: ConstellationEdge[] = [];
  for (const node of nodes) {
    for (const dep of node.deps) {
      const depStatus = (statusMap.get(dep.key) as FeatureStatus) ?? 'unknown';
      edges.push({ fromKey: dep.key, toKey: node.key, blocked: !isFeatureDone(depStatus) });
    }
  }

  const width = opts.padX * 2 + opts.nodeW + (layerCount - 1) * opts.colGap;
  const height = opts.padY * 2 + opts.nodeH + (maxRows - 1) * opts.rowGap;

  return {
    moduleId,
    nodes,
    edges,
    width,
    height,
    layerCount,
    nextKey: pickNextFeature(nodes),
  };
}

/**
 * Pick the single best "do this next" feature: an unbuilt, unblocked node that
 * unblocks the most downstream work. Pure — derived only from the laid-out
 * nodes, so it can pulse in the UI without any store coupling.
 */
export function pickNextFeature(nodes: ConstellationNode[]): string | null {
  const candidates = nodes.filter((n) => !isFeatureDone(n.status) && !n.isBlocked);
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const c of candidates.slice(1)) {
    if (
      c.dependentCount > best.dependentCount ||
      (c.dependentCount === best.dependentCount && c.layer < best.layer) ||
      (c.dependentCount === best.dependentCount && c.layer === best.layer && c.featureName < best.featureName)
    ) {
      best = c;
    }
  }
  return best.key;
}
