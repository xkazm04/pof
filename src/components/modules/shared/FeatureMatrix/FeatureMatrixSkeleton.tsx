import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';

/**
 * Content-shaped loading state. Mirrors {@link FeatureRowItem}'s anatomy — a 4px
 * left rail, a status dot, a 150px name bar, a flex-1 description bar, and a
 * trailing badge — so the skeleton→content handoff has no layout shift or empty
 * void. Rows reuse the StaggerContainer entrance rhythm of the real list, and each
 * row's pulse is offset (0/60/120ms) for a downward wave. `animate-pulse` is
 * neutralised by the global prefers-reduced-motion rule, so this is motion-safe.
 */
export function FeatureMatrixSkeleton() {
  const ROW_COUNT = 7;
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading feature matrix"
      data-testid="pof-feature-matrix-skeleton"
      className="space-y-4"
    >
      <div aria-hidden="true" className="space-y-4">
        {/* Summary bar + review button placeholders */}
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 rounded bg-border animate-pulse" />
            <div className="h-1.5 w-full rounded-full bg-border animate-pulse" />
          </div>
          <div className="h-7 w-32 rounded-md bg-border animate-pulse flex-shrink-0" />
        </div>

        {/* Skeleton rows — same rhythm + anatomy as the real feature list */}
        <StaggerContainer className="space-y-px">
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <StaggerItem key={`skeleton-${i}`}>
              <SkeletonRow delayMs={(i % 3) * 60} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}

function SkeletonRow({ delayMs }: { delayMs: number }) {
  const pulse = { animationDelay: `${delayMs}ms` };
  return (
    <div className="rounded-md overflow-hidden" style={{ borderLeft: '4px solid var(--border)' }}>
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Status dot */}
        <span className="w-2 h-2 rounded-full bg-border animate-pulse flex-shrink-0" style={pulse} />
        {/* Name bar */}
        <span className="h-3 w-[150px] rounded bg-border animate-pulse flex-shrink-0" style={pulse} />
        {/* Description bar (hidden on small screens, mirroring the real row) */}
        <span className="h-3 flex-1 rounded bg-border animate-pulse hidden sm:block" style={pulse} />
        {/* Trailing status badge */}
        <span className="h-4 w-14 rounded bg-border animate-pulse flex-shrink-0" style={pulse} />
      </div>
    </div>
  );
}
