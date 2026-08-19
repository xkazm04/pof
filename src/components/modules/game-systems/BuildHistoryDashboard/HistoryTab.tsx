import type { Dispatch, SetStateAction } from 'react';
import type { BuildRecord } from '@/lib/packaging/build-history-store';
import type { ProjectScopeCounts } from '@/lib/project-id';
import { platformLabel } from '@/lib/packaging/build-profiles';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import { SortableHeader } from './SortableHeader';
import { BuildRow } from './BuildRow';
import { emptyHistoryCopy } from './buildScope';
import type { SortKey, SortDir } from './types';

export function HistoryTab({
  availablePlatforms, platformFilter, togglePlatform, setPlatformFilter,
  sortKey, sortDir, handleSort, filteredSortedBuilds, builds, handleDelete, scope,
}: {
  availablePlatforms: string[];
  platformFilter: Set<string>;
  togglePlatform: (p: string) => void;
  setPlatformFilter: Dispatch<SetStateAction<Set<string>>>;
  sortKey: SortKey;
  sortDir: SortDir;
  handleSort: (key: SortKey) => void;
  filteredSortedBuilds: BuildRecord[];
  builds: BuildRecord[];
  handleDelete: (id: number) => void;
  /** What the scoped read could and could not see — the empty state is not entitled
   *  to claim "no builds recorded" without it. */
  scope?: ProjectScopeCounts | null;
}) {
  return (
    <div className="space-y-2">
      {/* Platform filter chips */}
      {availablePlatforms.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted uppercase tracking-wider font-medium mr-1">Platform</span>
          {availablePlatforms.map((p) => {
            const active = platformFilter.has(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--systems)]/20 border border-[var(--systems)]/40'
                    : 'bg-surface-hover text-text-muted border border-transparent hover:border-border-bright hover:text-text'
                }`}
                style={active ? { color: ACCENT_VIOLET } : undefined}
              >
                {platformLabel(p)}
              </button>
            );
          })}
          {platformFilter.size > 0 && (
            <button
              onClick={() => setPlatformFilter(new Set())}
              className="px-1.5 py-0.5 text-2xs text-text-muted hover:text-text transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="rounded border border-border bg-background/60 overflow-hidden">
        {/* Sortable table header */}
        <div className="grid grid-cols-[auto_1fr_80px_80px_80px_60px_auto] gap-2 px-2 py-1.5 bg-surface-deep border-b border-border">
          <span className="w-2.5" />
          <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Build</span>
          <SortableHeader label="Platform" sortKey="platform" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Config" sortKey="config" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Size" sortKey="size" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Time" sortKey="duration" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortableHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
        </div>
        {filteredSortedBuilds.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-8">
            {builds.length === 0
              ? emptyHistoryCopy(scope)
              : 'No builds match the current filter.'}
          </div>
        ) : (
          filteredSortedBuilds.map((b) => (
            <BuildRow key={b.id} build={b} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
