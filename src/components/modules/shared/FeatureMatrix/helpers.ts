import { FEATURE_STATUSES } from '@/types/feature-matrix';
import type { FeatureStatus } from '@/types/feature-matrix';
import { formatTimeAgo } from '@/lib/format-time';
import { STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS } from '@/lib/chart-colors';
import type { SortKey, SortDir, ViewMode } from './types';

/** Read filter/sort state from URL search params */
export function readUrlParams(): {
  search?: string;
  statuses?: FeatureStatus[];
  qualityMin?: number;
  qualityMax?: number;
  sortKey?: SortKey;
  sortDir?: SortDir;
  viewMode?: ViewMode;
} {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: ReturnType<typeof readUrlParams> = {};

  const q = params.get('q');
  if (q) result.search = q;

  const st = params.get('status');
  if (st) {
    const valid = st.split(',').filter((s): s is FeatureStatus =>
      (FEATURE_STATUSES as readonly string[]).includes(s)
    );
    if (valid.length > 0) result.statuses = valid;
  }

  const qMin = params.get('qmin');
  const qMax = params.get('qmax');
  if (qMin) { const n = parseInt(qMin); if (n >= 1 && n <= 5) result.qualityMin = n; }
  if (qMax) { const n = parseInt(qMax); if (n >= 1 && n <= 5) result.qualityMax = n; }

  const sk = params.get('sort');
  if (sk && ['name', 'status', 'quality', 'reviewed'].includes(sk)) result.sortKey = sk as SortKey;

  const sd = params.get('dir');
  if (sd && ['asc', 'desc'].includes(sd)) result.sortDir = sd as SortDir;

  const vm = params.get('view');
  if (vm && ['grouped', 'flat'].includes(vm)) result.viewMode = vm as ViewMode;

  return result;
}

/** Write filter/sort state to URL search params (replaceState, no navigation) */
export function writeUrlParams(state: {
  search: string;
  statuses: FeatureStatus[];
  qualityMin: number;
  qualityMax: number;
  sortKey: SortKey;
  sortDir: SortDir;
  viewMode: ViewMode;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);

  // Only write non-default values
  if (state.search) params.set('q', state.search);
  else params.delete('q');

  const allStatuses = state.statuses.length === 5;
  if (!allStatuses) params.set('status', state.statuses.join(','));
  else params.delete('status');

  if (state.qualityMin > 1) params.set('qmin', String(state.qualityMin));
  else params.delete('qmin');

  if (state.qualityMax < 5) params.set('qmax', String(state.qualityMax));
  else params.delete('qmax');

  if (state.sortKey !== 'name' || state.sortDir !== 'asc') {
    params.set('sort', state.sortKey);
    params.set('dir', state.sortDir);
  } else {
    params.delete('sort');
    params.delete('dir');
  }

  if (state.viewMode !== 'grouped') params.set('view', state.viewMode);
  else params.delete('view');

  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

export function formatRelativeTime(dateStr: string): { label: string; dotColor: string; isOutdated: boolean } {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);

  const label = formatTimeAgo(dateStr, { extended: true });

  // Green <24h, amber 1-7d, red >7d
  const dotColor = hours < 24 ? STATUS_SUCCESS : days <= 7 ? STATUS_WARNING : STATUS_ERROR;
  const isOutdated = days > 7;

  return { label, dotColor, isOutdated };
}
