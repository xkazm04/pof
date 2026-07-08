import type { HealthTrendPoint } from '@/lib/game-director-db';

export interface HealthTrendChartProps {
  data: HealthTrendPoint[];
  height?: number;
}

export interface SeriesPoint {
  x: number;
  y: number;
  d: HealthTrendPoint;
}
