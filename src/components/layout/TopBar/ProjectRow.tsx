'use client';

import { useState } from 'react';
import type { RecentProject } from '@/stores/projectStore';
import { Gamepad2, X, Clock, Loader2 } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { formatTimeAgo } from '@/lib/format-time';

// --- Project row in the switcher list ---

export function ProjectRow({ project, isSwitching, onSwitch, onRemove }: {
  project: RecentProject;
  isSwitching: boolean;
  onSwitch: () => void;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pct = project.checklistTotal > 0
    ? Math.round((project.checklistDone / project.checklistTotal) * 100)
    : 0;

  const timeAgo = formatTimeAgo(project.lastOpenedAt, { extended: true, justNow: 'Just now', invalid: 'Unknown' });

  return (
    <div className="group relative">
      <button
        onClick={onSwitch}
        disabled={isSwitching}
        className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded bg-surface-hover flex items-center justify-center">
          {isSwitching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: MODULE_COLORS.setup }} />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text truncate">{project.projectName}</span>
            <span className="text-2xs text-text-muted flex-shrink-0">UE{project.ueVersion}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Mini progress bar */}
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 75 ? MODULE_COLORS.setup : pct >= 40 ? MODULE_COLORS.content : 'var(--text-muted)',
                  }}
                />
              </div>
              <span className="text-2xs text-text-muted">{pct}%</span>
            </div>
            <span className="text-2xs text-text-muted flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo}
            </span>
          </div>
        </div>
      </button>
      {/* Remove button on hover */}
      {confirmRemove ? (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 bg-surface border border-border rounded px-1 py-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-2xs text-red-400 hover:text-red-300 px-1"
          >
            Remove
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}
            className="text-2xs text-text-muted hover:text-text px-1"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
          className="absolute right-2 top-2 p-0.5 text-text-muted hover:text-red-400 opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all rounded hover:bg-status-red-subtle"
          title="Remove from recent"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
