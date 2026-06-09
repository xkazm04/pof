/**
 * Shared loading skeleton shown while a module suspends (e.g. while a child
 * `use()` resolves or a lazy import hydrates). Mirrors typical module chrome
 * with a header bar + grid of placeholder tiles. Lightweight, no animation
 * work beyond the existing `animate-pulse` token.
 *
 * Reused by {@link ModuleRenderer}'s Suspense fallback and by the
 * {@link ShellSkeleton} content area so the first-paint shell and an in-app
 * module load share the same tile language.
 */
export function ModuleSkeleton() {
  return (
    <div
      className="h-full p-6 animate-pulse"
      aria-hidden
      role="status"
      aria-label="Loading module"
      data-testid="pof-module-skeleton"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-6 h-6 rounded bg-surface-2" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-surface-2" />
          <div className="h-3 w-64 rounded bg-surface-2/70" />
        </div>
      </div>
      <div className="h-8 w-full rounded bg-surface-2/50 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-surface-2/40 border border-border" />
        ))}
      </div>
    </div>
  );
}
