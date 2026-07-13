import { Skeleton } from './ui/Skeleton';
import type { LabTheme } from './theme';

interface MatrixSkeletonProps {
  t: LabTheme;
  rows: number;
  cols: number;
  reduce: boolean;
}

/**
 * First-load placeholder for the CatalogMatrix grid: shimmer name cells + a grid of
 * shimmer step cells, so a catalog switch reads as "loading" rather than flashing
 * every cell as pending (an all-empty grid the user misreads as "nothing done").
 */
export function MatrixSkeleton({ t, rows, cols, reduce }: MatrixSkeletonProps) {
  const rowIdx = Array.from({ length: Math.min(rows, 8) });
  const colIdx = Array.from({ length: Math.min(cols, 16) });
  return (
    <div data-testid="matrix-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16 }}>
      {rowIdx.map((_, r) => (
        <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Skeleton reduce={reduce} width={200} height={20} radius={t.glass ? 5 : 0} style={{ flexShrink: 0 }} />
          {colIdx.map((__, c) => (
            <Skeleton key={c} reduce={reduce} width={30} height={30} radius={t.glass ? 5 : 0} style={{ flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
