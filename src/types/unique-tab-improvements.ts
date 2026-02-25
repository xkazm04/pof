/* ── Shared types for unique tab improvements ────────────────────────────── */

/** Radar chart data point (used by Character, Enemy, Combat, GAS tabs) */
export interface RadarDataPoint {
  axis: string;
  value: number;      // 0-1 normalized
  maxLabel?: string;   // display label for max (e.g., "100 HP")
}

/** Timeline event (used by Animation, Combat, Progression tabs) */
export interface TimelineEvent {
  id: string;
  timestamp: number;   // seconds or frame number
  label: string;
  category: string;
  color: string;
  details?: string;
  duration?: number;   // for range-based events
}

/** Heatmap cell (used by Zone, Debug, Loot, Animation tabs) */
export interface HeatmapCell {
  row: number;
  col: number;
  value: number;       // 0-1 normalized intensity
  label?: string;
  tooltip?: string;
}

/** Heatmap configuration */
export interface HeatmapConfig {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
  colorScale?: [string, string]; // [low, high] colors
}

/** Live metric gauge data */
export interface GaugeMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
}

/** Diff entry for before/after comparisons (Save, Progression) */
export interface DiffEntry {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  changeType: 'added' | 'removed' | 'changed' | 'unchanged';
}

/** Tag cloud item */
export interface TagCloudItem {
  tag: string;
  count: number;
  category?: string;
  color?: string;
}

/** Node/edge graph data (reused by multiple graph visualizations) */
export interface GraphNode {
  id: string;
  label: string;
  group?: string;
  color?: string;
  size?: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

/** Sankey diagram data */
export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

/** Budget bar data */
export interface BudgetBar {
  label: string;
  current: number;
  max: number;
  unit?: string;
  color?: string;
  threshold?: { warn: number; danger: number };
}

/** Curve point for chart visualizations */
export interface CurvePoint {
  x: number;
  y: number;
  label?: string;
}

/** Multi-series chart data */
export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  points: CurvePoint[];
  visible?: boolean;
}

/** Stat comparison row (used by Character, Enemy, Item comparison) */
export interface StatComparison {
  stat: string;
  valueA: number;
  valueB: number;
  unit?: string;
  higherIsBetter?: boolean;
}

/** Probability entry for loot/affix trees */
export interface ProbabilityEntry {
  id: string;
  label: string;
  probability: number;
  children?: ProbabilityEntry[];
  color?: string;
}

/** Loadout slot */
export interface LoadoutSlot {
  slotId: string;
  slotName: string;
  item?: { name: string; rarity: string; stats: Record<string, number> };
  isEmpty: boolean;
}
