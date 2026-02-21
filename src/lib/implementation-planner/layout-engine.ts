import type { SubModuleId } from '@/types/modules';
import type { PlanItem } from './plan-generator';
import { getModuleLabel } from './plan-generator';
import type { EffortLevel } from './effort-estimator';

// ---------- Types ----------

export interface CanvasNode {
  key: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  item: PlanItem;
}

export interface ModuleCluster {
  moduleId: SubModuleId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: CanvasNode[];
  categories: { label: string; x: number; y: number }[];
}

export interface CanvasLayout {
  clusters: ModuleCluster[];
  allNodes: Map<string, CanvasNode>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ---------- Constants ----------

const STATUS_COLORS: Record<string, string> = {
  implemented: '#4ade80',
  improved: '#38bdf8',
  partial: '#fbbf24',
  missing: '#f87171',
  unknown: '#6b7280',
};

const NODE_SPACING_X = 200; 
const CATEGORY_SPACING_Y = 80;
const CATEGORY_LABEL_WIDTH = 160;
const CLUSTER_PADDING = 60; 
const CLUSTER_GAP = 160;
const CLUSTER_HEADER = 80;

// ---------- Helpers ----------

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12345.6789) * 43758.5453;
  return x - Math.floor(x);
}

function impactRadius(score: number): number {
  return Math.min(12, Math.max(4, 4 + score * 0.8));
}

// ---------- Layout ----------

/**
 * Compute canvas layout: groups PlanItems into module clusters, positions nodes
 * within each cluster (X = effort, Y = sorted by impact), arranges clusters in a grid.
 */
export function computeCanvasLayout(items: PlanItem[]): CanvasLayout {
  // Group by module
  const moduleGroups = new Map<string, PlanItem[]>();
  for (const item of items) {
    const group = moduleGroups.get(item.moduleId) ?? [];
    group.push(item);
    moduleGroups.set(item.moduleId, group);
  }

  // Sort modules: largest first for visual weight balance
  const sortedModules = [...moduleGroups.entries()].sort((a, b) => b[1].length - a[1].length);

  const cols = Math.max(1, Math.ceil(Math.sqrt(sortedModules.length)));

  // First pass: compute cluster dimensions
  const clusterMeta: Array<{ w: number; h: number; categories: string[] }> = [];
  for (const [, moduleItems] of sortedModules) {
    const buckets: Record<string, number> = {};
    for (const item of moduleItems) {
      buckets[item.category] = (buckets[item.category] || 0) + 1;
    }

    const categories = Object.keys(buckets).sort(); // Alphabetical sort for categories
    const maxInRow = Math.max(...Object.values(buckets), 1);

    // Calculate width based on the maximum items in any category row
    // 180 is the card width. We need space for (maxInRow - 1) spacings + 1 full card.
    const w = CATEGORY_LABEL_WIDTH + 180 + Math.max(0, maxInRow - 1) * NODE_SPACING_X + CLUSTER_PADDING * 2;
    // Calculate height based on the number of categories
    const h = (categories.length * CATEGORY_SPACING_Y) + CLUSTER_PADDING * 2 + CLUSTER_HEADER;
    clusterMeta.push({ w, h, categories });
  }

  // Grid column widths / row heights
  const colWidths: number[] = Array(cols).fill(0);
  const rowHeights: number[] = [];
  for (let i = 0; i < sortedModules.length; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    colWidths[c] = Math.max(colWidths[c], clusterMeta[i].w);
    if (!rowHeights[r]) rowHeights[r] = 0;
    rowHeights[r] = Math.max(rowHeights[r], clusterMeta[i].h);
  }

  // Second pass: position clusters and nodes
  const clusters: ModuleCluster[] = [];
  const allNodes = new Map<string, CanvasNode>();

  for (let i = 0; i < sortedModules.length; i++) {
    const [moduleId, moduleItems] = sortedModules[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    let cx = 0;
    for (let c = 0; c < col; c++) cx += colWidths[c] + CLUSTER_GAP;
    let cy = 0;
    for (let r = 0; r < row; r++) cy += rowHeights[r] + CLUSTER_GAP;

    const categories = clusterMeta[i].categories;

    // Bucket items by category
    const buckets: Record<string, PlanItem[]> = {};
    for (const cat of categories) buckets[cat] = [];
    for (const item of moduleItems) buckets[item.category].push(item);

    // Sort each bucket: high impact first (left), then by feature name
    for (const bucket of Object.values(buckets)) {
      bucket.sort((a, b) => {
        if (b.impact.score !== a.impact.score) {
          return b.impact.score - a.impact.score;
        }
        return a.featureName.localeCompare(b.featureName);
      });
    }

    const nodes: CanvasNode[] = [];
    const categoryLabels: { label: string; x: number; y: number }[] = [];

    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const cat = categories[catIdx];
      const bucket = buckets[cat];
      
      // Center the row vertically within its CATEGORY_SPACING_Y band
      const rowY = CLUSTER_HEADER + CLUSTER_PADDING + catIdx * CATEGORY_SPACING_Y + CATEGORY_SPACING_Y / 2;
      categoryLabels.push({ label: cat, x: CLUSTER_PADDING, y: rowY });

      for (let j = 0; j < bucket.length; j++) {
        const item = bucket[j];
        const seed = hashString(item.key);
        // Minimal jitter for single-row cards to keep rows clean
        const jx = (seededRandom(seed) - 0.5) * 4;
        const jy = (seededRandom(seed + 1) - 0.5) * 4;

        // 90 is half of the card width to ensure it starts after the label
        const nx = cx + CLUSTER_PADDING + CATEGORY_LABEL_WIDTH + 90 + j * NODE_SPACING_X + jx;
        const ny = cy + rowY + jy;

        const node: CanvasNode = {
          key: item.key,
          x: nx,
          y: ny,
          radius: impactRadius(item.impact.score),
          color: STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown,
          item,
        };
        nodes.push(node);
        allNodes.set(item.key, node);
      }
    }

    // Cluster bounding box
    const cw = clusterMeta[i].w;
    const ch = clusterMeta[i].h;

    clusters.push({
      moduleId: moduleId as SubModuleId,
      label: getModuleLabel(moduleId as SubModuleId),
      x: cx,
      y: cy,
      width: cw,
      height: ch,
      nodes,
      categories: categoryLabels,
    });
  }

  // Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of clusters) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  if (clusters.length === 0) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  return { clusters, allNodes, bounds: { minX, minY, maxX, maxY } };
}

// ---------- Critical Path ----------

/**
 * Find the longest dependency chain by total effort minutes using dynamic programming.
 * Returns the set of feature keys on the critical path.
 */
export function findCriticalPath(items: PlanItem[]): Set<string> {
  const itemMap = new Map<string, PlanItem>();
  for (const item of items) itemMap.set(item.key, item);

  const memo = new Map<string, { minutes: number; path: string[] }>();

  function longest(key: string): { minutes: number; path: string[] } {
    if (memo.has(key)) return memo.get(key)!;
    const item = itemMap.get(key);
    if (!item) {
      const r = { minutes: 0, path: [] as string[] };
      memo.set(key, r);
      return r;
    }

    let best = { minutes: 0, path: [] as string[] };
    for (const dep of item.dependsOn) {
      if (!itemMap.has(dep)) continue;
      const sub = longest(dep);
      if (sub.minutes > best.minutes) best = sub;
    }

    const result = { minutes: best.minutes + item.effort.minutes, path: [...best.path, key] };
    memo.set(key, result);
    return result;
  }

  let longestResult = { minutes: 0, path: [] as string[] };
  for (const key of itemMap.keys()) {
    const r = longest(key);
    if (r.minutes > longestResult.minutes) longestResult = r;
  }

  return new Set(longestResult.path);
}
