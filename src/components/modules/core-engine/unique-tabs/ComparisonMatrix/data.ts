/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface ComparisonMatrixStat {
  stat: string;
  unit: string;
  maxVal: number;
  higherIsBetter?: boolean;
}

export interface ComparisonMatrixEntity {
  id: string;
  name: string;
  color: string;
  values: number[];
}

export interface ComparisonMatrixProps {
  stats: ComparisonMatrixStat[];
  allEntities: ComparisonMatrixEntity[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  maxColumns?: number;
  minColumns?: number;
}
