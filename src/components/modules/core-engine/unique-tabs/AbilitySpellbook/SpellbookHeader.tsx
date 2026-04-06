'use client';

import { RefreshCw } from 'lucide-react';
import { STATUS_SUCCESS,
  withOpacity, OPACITY_25, OPACITY_5,
} from '@/lib/chart-colors';
import { useSpellbookData } from './context';

export function SyncStatusBadge() {
  const { isLive, isSyncing, parsedAt, refresh } = useSpellbookData();

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded-full bg-surface-deep/50 border border-border/30 whitespace-nowrap">
        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing UE5 source...
      </span>
    );
  }

  if (isLive) {
    return (
      <button
        onClick={refresh}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-colors hover:bg-surface-deep/80"
        style={{ color: STATUS_SUCCESS, borderColor: `${withOpacity(STATUS_SUCCESS, OPACITY_25)}`, backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_5)}` }}
        title={`Synced from C++ source at ${parsedAt ? new Date(parsedAt).toLocaleTimeString() : 'unknown'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUCCESS, boxShadow: `0 0 6px ${STATUS_SUCCESS}` }} />
        Live from UE5
        <RefreshCw className="w-3 h-3 opacity-50" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded-full bg-surface-deep/50 border border-border/30 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50" />
      Static data
    </span>
  );
}
