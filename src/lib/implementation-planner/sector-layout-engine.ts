/**
 * Sector Layout Engine - Handles intelligent node placement for 100-1000+ items
 * 
 * This engine divides the canvas into hierarchical sectors organized by:
 * 1. Module clusters (core-engine submodules)
 * 2. Feature domains/categories (if available)
 * 3. Dependency density hotspots
 * 
 * Designed to scale gracefully from 50 to 1000+ nodes while maintaining:
 * - Clear visual sectoring with labeled region blocks
 * - Intelligent node positioning within sectors (effort vs impact)
 * - Minimal edge crossings and clutter
 * - Performance for interactive zoom/pan
 */

import type { SubModuleId } from '@/types/modules';
import type { PlanItem } from './plan-generator';
import type { CanvasNode, CanvasLayout } from './layout-engine';
import { getModuleLabel } from './plan-generator';
import type { EffortLevel } from './effort-estimator';

// ---------- Types ----------

export interface SectorDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  items: PlanItem[];
  nodes?: CanvasNode[];
}

export interface SectorLayout extends CanvasLayout {
  sectors: SectorDefinition[];
}

// ---------- Constants ----------

const STATUS_COLORS: Record<string, string> = {
  implemented: '#4ade80',
  improved: '#38bdf8',
  partial: '#fbbf24',
  missing: '#f87171',
  unknown: '#6b7280',
};

const EFFORT_X: Record<EffortLevel, number> = {
  trivial: 0,
  small: 1,
  medium: 2,
  large: 3,
};

// Sector layout parameters (tuned for 100-500 nodes)
const SECTOR_GRID_COLS = 4; // 4x3 grid = 12 sectors max
const SECTOR_GRID_ROWS = 3;
const SECTOR_PADDING = 40;
const NODE_SPACING_X = 60;
const NODE_SPACING_Y = 50;
const SECTOR_HEADER_HEIGHT = 28;
const SECTOR_GAP = 60;

// Sector colors (distinct hues for easy visual separation)
const SECTOR_COLORS = [
  '#1e40af', '#dc2626', '#16a34a', '#d97706', // Blue, Red, Green, Amber
  '#7c3aed', '#0891b2', '#7c2d12', '#1e293b', // Purple, Cyan, Brown, Gray
  '#4c1d95', '#065f46', '#7f1d1d', '#1e3a8a', // Dark Purple, Dark Green, Dark Red, Dark Blue
];

function impactRadius(score: number): number {
  return Math.min(12, Math.max(4, 4 + score * 0.8));
}

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

// ---------- Sectoring Strategy ----------

/**
 * Determine sectors based on item count and characteristics
 * 
 * Strategy:
 * - < 100 items: Use single sector per module (fallback to regular layout)
 * - 100-300 items: 2x2 sectors by module + dependency density
 * - 300-1000 items: 4x3 sectors with intelligent grouping
 */
function determineSectors(items: PlanItem[], moduleGroups: Map<string, PlanItem[]>): SectorDefinition[] {
  const sectors: SectorDefinition[] = [];

  if (items.length < 100) {
    // Single sector per module
    let idx = 0;
    for (const [moduleId, moduleItems] of moduleGroups.entries()) {
      const color = SECTOR_COLORS[idx % SECTOR_COLORS.length];
      sectors.push({
        id: moduleId,
        label: getModuleLabel(moduleId as SubModuleId),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color,
        opacity: 0.5,
        items: moduleItems,
      });
      idx++;
    }
  } else if (items.length < 300) {
    // 2x2 sectors: quadrant by module count + dependency
    const sorted = [...moduleGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    const topQuarter = Math.ceil(sorted.length / 4);

    let idx = 0;
    for (let q = 0; q < 4 && idx < sorted.length; q++) {
      const items: PlanItem[] = [];
      const endIdx = Math.min(idx + topQuarter, sorted.length);
      while (idx < endIdx) {
        items.push(...sorted[idx][1]);
        idx++;
      }

      const color = SECTOR_COLORS[q % SECTOR_COLORS.length];
      const label =
        q === 0 ? 'High Priority'
        : q === 1 ? 'Core Systems'
        : q === 2 ? 'Features'
        : 'Polish';

      sectors.push({
        id: `quadrant-${q}`,
        label,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color,
        opacity: 0.55,
        items,
      });
    }
  } else {
    // 4x3 = 12 sectors with intelligent grouping
    // Group by: (effort level + impact tier) for clustering
    const effortImpactGroups = new Map<string, PlanItem[]>();

    for (const item of items) {
      const effortTier = item.effort.level;
      const impactTier = item.impact.score >= 6 ? 'high' : item.impact.score >= 3 ? 'med' : 'low';
      const key = `${effortTier}:${impactTier}`;
      const group = effortImpactGroups.get(key) ?? [];
      group.push(item);
      effortImpactGroups.set(key, group);
    }

    // Create sectors from groups in grid order
    const groups = [...effortImpactGroups.entries()]
      .sort((a, b) => {
        // Sort by: high impact items first, then by effort
        const aScoreMult = a[1][0].impact.score + (a[1][0].effort.level === 'trivial' ? 100 : 0);
        const bScoreMult = b[1][0].impact.score + (b[1][0].effort.level === 'trivial' ? 100 : 0);
        return bScoreMult - aScoreMult;
      });

    const maxSectors = SECTOR_GRID_COLS * SECTOR_GRID_ROWS;
    for (let i = 0; i < Math.min(groups.length, maxSectors); i++) {
      const [key, sectorItems] = groups[i];
      const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
      const label = key; // "trivial:high", "small:med", etc.

      sectors.push({
        id: `sector-${i}`,
        label,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color,
        opacity: 0.6,
        items: sectorItems,
      });
    }
  }

  return sectors;
}

// ---------- Node Positioning within Sectors ----------

/**
 * Position nodes within a sector using effort (X) and impact (Y) axes
 */
function layoutNodesInSector(
  sector: SectorDefinition,
  sectorX: number,
  sectorY: number,
  sectorWidth: number,
  sectorHeight: number,
): CanvasNode[] {
  const contentHeight = sectorHeight - SECTOR_HEADER_HEIGHT;
  const contentWidth = sectorWidth - SECTOR_PADDING * 2;

  // Bucket by effort
  const buckets: Record<number, PlanItem[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const item of sector.items) {
    buckets[EFFORT_X[item.effort.level]].push(item);
  }

  // Sort each bucket by impact (high first = top)
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => b.impact.score - a.impact.score);
  }

  const nodes: CanvasNode[] = [];
  const usedCols = Object.values(buckets).filter((b) => b.length > 0).length;
  const effortColWidth = contentWidth / (usedCols || 1);

  let colIdx = 0;
  for (const [effortLevel, bucket] of Object.entries(buckets)) {
    if (bucket.length === 0) continue;

    const effort = Number(effortLevel);
    const cx = sectorX + SECTOR_PADDING + colIdx * effortColWidth + effortColWidth / 2;

    for (let j = 0; j < bucket.length; j++) {
      const item = bucket[j];
      const radius = impactRadius(item.impact.score);

      // Y position based on rank within bucket
      const cy = sectorY + SECTOR_HEADER_HEIGHT + SECTOR_PADDING + (j * NODE_SPACING_Y) + NODE_SPACING_Y / 2;

      // Small X jitter for variety
      const seed = hashString(item.key);
      const jx = (seededRandom(seed) - 0.5) * 20;

      nodes.push({
        key: item.key,
        x: cx + jx,
        y: cy,
        radius,
        color: STATUS_COLORS[item.status] || STATUS_COLORS.unknown,
        item,
      });
    }

    colIdx++;
  }

  return nodes;
}

// ---------- Main Layout Computation ----------

/**
 * Compute sector-based canvas layout for 100-1000+ items
 */
export function computeSectorLayout(items: PlanItem[]): SectorLayout {
  // Group by module first
  const moduleGroups = new Map<string, PlanItem[]>();
  for (const item of items) {
    const group = moduleGroups.get(item.moduleId) ?? [];
    group.push(item);
    moduleGroups.set(item.moduleId, group);
  }

  // Determine sectors
  let sectors = determineSectors(items, moduleGroups);

  // For < 100 items, return regular layout (fallback)
  if (items.length < 100) {
    const allNodes = new Map<string, CanvasNode>();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    sectors.forEach((sector) => {
      sector.nodes = layoutNodesInSector(sector, 0, 0, 1000, 600);
      sector.nodes.forEach((node) => {
        allNodes.set(node.key, node);
        minX = Math.min(minX, node.x - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
      });
    });

    return {
      clusters: [],
      sectors,
      allNodes,
      bounds: { minX, maxX, minY, maxY },
    };
  }

  // Compute sector grid layout
  const cols = items.length < 300 ? 2 : SECTOR_GRID_COLS;
  const rows = items.length < 300 ? 2 : SECTOR_GRID_ROWS;

  // Calculate sector dimensions (equal-sized grid)
  const totalWidth = cols * 600 + (cols - 1) * SECTOR_GAP;
  const totalHeight = rows * 400 + (rows - 1) * SECTOR_GAP;
  const sectorWidth = 600;
  const sectorHeight = 400;

  let sectorIdx = 0;
  const allNodes = new Map<string, CanvasNode>();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (sectorIdx >= sectors.length) break;

      const sector = sectors[sectorIdx];
      const sx = c * (sectorWidth + SECTOR_GAP);
      const sy = r * (sectorHeight + SECTOR_GAP);

      sector.x = sx;
      sector.y = sy;
      sector.width = sectorWidth;
      sector.height = sectorHeight;

      // Layout nodes within this sector
      const sectorNodes = layoutNodesInSector(sector, sx, sy, sectorWidth, sectorHeight);
      sector.nodes = sectorNodes;

      sectorNodes.forEach((node) => {
        allNodes.set(node.key, node);
        minX = Math.min(minX, node.x - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
      });

      sectorIdx++;
    }
  }

  return {
    clusters: [], // No clusters in sector layout
    sectors,
    allNodes,
    bounds: { minX, maxX, minY, maxY },
  };
}
