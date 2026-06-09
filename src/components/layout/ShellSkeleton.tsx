'use client';

import { ModuleSkeleton } from './ModuleSkeleton';

/**
 * Left-rail icon placeholders — mirrors the seven sidebar `CATEGORIES`. Kept as
 * a constant rather than imported so the skeleton stays a zero-dependency,
 * first-paint-friendly component.
 */
const RAIL_ICON_COUNT = 7;

/** Collapsed SidebarL1 width — mirrors `COLLAPSED_WIDTH` in SidebarL1.tsx. */
const RAIL_WIDTH = 56;

/**
 * Branded loading skeleton that mirrors the AppShell's three-pane chrome while
 * Zustand rehydrates from localStorage: a 44px top bar, a 56px icon rail of
 * pulsing placeholders, and the shared {@link ModuleSkeleton} tile grid for the
 * content area. AppShell crossfades this out as the real shell fades in, so the
 * first load reads as one continuous reveal rather than a spinner-to-app cut —
 * and because the placeholders land where real content will, there is no layout
 * jump on first paint.
 */
export function ShellSkeleton() {
  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-background animate-pulse"
      data-testid="pof-shell-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      {/* Top bar — mirrors TopBar (h-11 / 44px). */}
      <div
        data-testid="pof-shell-skeleton-topbar"
        className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-border bg-surface-deep"
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-surface-2" />
          <div className="h-4 w-10 rounded bg-surface-2" />
          <div className="h-3 w-24 rounded bg-surface-2/60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-28 rounded-md bg-surface-2/50" />
          <div className="h-3 w-16 rounded bg-surface-2/40" />
          <div className="w-7 h-7 rounded-md bg-surface-2/50" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left rail — mirrors the collapsed SidebarL1 (56px icon rail). */}
        <div
          data-testid="pof-shell-skeleton-rail"
          className="shrink-0 flex flex-col items-center py-3 px-2 gap-1 border-r border-border bg-background"
          style={{ width: RAIL_WIDTH }}
        >
          {Array.from({ length: RAIL_ICON_COUNT }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-lg bg-surface-2/60" />
          ))}
          {/* Collapse toggle sits pinned at the bottom of the real rail. */}
          <div className="mt-auto w-10 h-10 rounded-lg bg-surface-2/40" />
        </div>

        {/* Content area — reuse the shared module tile grid. */}
        <div className="flex-1 min-w-0">
          <ModuleSkeleton />
        </div>
      </div>
    </div>
  );
}
