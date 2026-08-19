'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, TrendingUp, ArrowLeftRight, Plus, RefreshCw,
} from 'lucide-react';
import type { BuildRecord, BuildStats, SizeTrendPoint } from '@/lib/packaging/build-history-store';
import type { ProjectScopeCounts } from '@/lib/project-id';
import { PLATFORM_IDS, platformLabel, normalizePlatformId } from '@/lib/packaging/build-profiles';
import { apiFetch } from '@/lib/api-utils';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { useProjectStore } from '@/stores/projectStore';
import { SizeTrendChart } from '../SizeTrendChart';
import { BuildComparison } from '../BuildComparison';
import type { DashboardTab, SortKey, SortDir } from './types';
import { RecordBuildForm } from './RecordBuildForm';
import { MetricsRow } from './MetricsRow';
import { PlatformBreakdown } from './PlatformBreakdown';
import { HistoryTab } from './HistoryTab';
import { describeBuildScope } from './buildScope';
import { BuildScopeBanner } from './BuildScopeBanner';

// ---------- Dashboard ----------

export function BuildHistoryDashboard() {
  const [tab, setTab] = useState<DashboardTab>('history');
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [stats, setStats] = useState<BuildStats | null>(null);
  const [trend, setTrend] = useState<SizeTrendPoint[]>([]);
  const [version, setVersion] = useState('0.1.0');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [platformFilter, setPlatformFilter] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<ProjectScopeCounts | null>(null);

  // The active project travels EXPLICITLY on every read and on the manual record.
  // Wave 20 taught `insertBuild` to persist `project_id` but taught no CALLER to pass
  // one — and `projectScopeSql('')` resolves to `project_id = ''`, so an unscoped
  // dashboard returned LEGACY ROWS ONLY. Ten cooks with a project open showed zero
  // builds under "No builds recorded yet".
  const projectPath = useProjectStore((s) => s.projectPath);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir(key === 'date' ? 'desc' : 'asc');
      }
      return key;
    });
  }, []);

  const togglePlatform = useCallback((p: string) => {
    setPlatformFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }, []);

  const filteredSortedBuilds = useMemo(() => {
    let result = builds;

    // Platform filter (filter set holds canonical ids; rows may store any spelling)
    if (platformFilter.size > 0) {
      result = result.filter((b) => platformFilter.has(normalizePlatformId(b.platform)));
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'platform':
          return dir * platformLabel(a.platform).localeCompare(platformLabel(b.platform));
        case 'config':
          return dir * a.config.localeCompare(b.config);
        case 'size':
          return dir * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
        case 'duration':
          return dir * ((a.durationMs ?? 0) - (b.durationMs ?? 0));
        case 'errors':
          return dir * (a.errorCount - b.errorCount);
        default:
          return 0;
      }
    });

    return result;
  }, [builds, platformFilter, sortKey, sortDir]);

  // Canonical platform ids that actually exist in the data (any stored spelling)
  const availablePlatforms = useMemo(() => {
    const set = new Set(builds.map((b) => normalizePlatformId(b.platform)));
    return PLATFORM_IDS.filter((p) => set.has(p));
  }, [builds]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // One composite request replaces the former 4-way fan-out (list / stats /
      // trend / version). The `dashboard` action returns the identical pieces
      // produced by those same store functions in a single route invocation.
      const q = projectPath ? `&projectPath=${encodeURIComponent(projectPath)}` : '';
      const data = await apiFetch<{
        builds: BuildRecord[];
        stats: BuildStats | null;
        trend: SizeTrendPoint[];
        version: string;
        // The route has always computed this; the type used to omit it, so the one
        // fact that explains an empty tab was fetched and thrown away.
        scope?: ProjectScopeCounts;
      }>(`/api/packaging/history?action=dashboard&limit=100&trendLimit=50${q}`);
      setBuilds(data.builds ?? []);
      setStats(data.stats ?? null);
      setTrend(data.trend ?? []);
      setVersion(data.version ?? '0.1.0');
      setScope(data.scope ?? null);
    } catch (e) {
      console.error('Failed to fetch build history:', e);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRecord = useCallback(async (data: Record<string, unknown>) => {
    try {
      await apiFetch('/api/packaging/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Attributed to the same project the reads are scoped to — otherwise a
        // manual record lands in the legacy `''` bucket and is the only thing the
        // scoped tab can see, which is how this defect stayed invisible.
        body: JSON.stringify({ action: 'record', projectPath, ...data }),
      });
      setShowForm(false);
      fetchAll();
    } catch (e) {
      console.error('Failed to record build:', e);
    }
  }, [fetchAll, projectPath]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await apiFetch(`/api/packaging/history?id=${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) {
      console.error('Failed to delete build:', e);
    }
  }, [fetchAll]);

  const handleBump = useCallback(async (type: 'major' | 'minor' | 'patch') => {
    try {
      const data = await apiFetch<{ version: string }>('/api/packaging/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bump-version', type }),
      });
      setVersion(data.version);
    } catch (e) {
      console.error('Failed to bump version:', e);
    }
  }, []);

  // Escalates to `bad` exactly when the tab is BLIND — nothing on screen while builds
  // provably exist under another project.
  const scopeDesc = useMemo(() => describeBuildScope(scope, builds.length), [scope, builds.length]);

  const tabClass = (t: DashboardTab) =>
    `px-2.5 py-1 text-xs font-medium rounded-t transition-colors ${
      tab === t
        ? 'text-text bg-surface-hover border-b-2 border-[var(--systems)]'
        : 'text-text-muted hover:text-text-muted'
    }`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" style={{ color: MODULE_COLORS.systems }} />
          <span className="text-sm font-semibold text-text">Build History</span>
          {stats && (
            <span className="text-xs text-text-muted font-mono">{stats.totalBuilds} builds</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--systems)]/10 hover:bg-[var(--systems)]/20 transition-colors"
            style={{ color: MODULE_COLORS.systems }}
          >
            <Plus className="w-3 h-3" />
            Record
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Record form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <RecordBuildForm onSubmit={handleRecord} version={version} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* What this project's scope could NOT see — silent only when it hid nothing. */}
      <BuildScopeBanner desc={scopeDesc} />

      {/* Metrics row */}
      {stats && (
        <MetricsRow stats={stats} version={version} onBump={handleBump} />
      )}

      {/* Platform breakdown */}
      {stats && stats.platforms.length > 0 && (
        <PlatformBreakdown stats={stats} />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button className={tabClass('history')} onClick={() => setTab('history')}>
          <span className="flex items-center gap-1"><History className="w-2.5 h-2.5" /> History</span>
        </button>
        <button className={tabClass('trends')} onClick={() => setTab('trends')}>
          <span className="flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Trends</span>
        </button>
        <button className={tabClass('compare')} onClick={() => setTab('compare')}>
          <span className="flex items-center gap-1"><ArrowLeftRight className="w-2.5 h-2.5" /> Compare</span>
        </button>
      </div>

      {/* Tab content */}
      {tab === 'history' && (
        <HistoryTab
          availablePlatforms={availablePlatforms}
          platformFilter={platformFilter}
          togglePlatform={togglePlatform}
          setPlatformFilter={setPlatformFilter}
          sortKey={sortKey}
          sortDir={sortDir}
          handleSort={handleSort}
          filteredSortedBuilds={filteredSortedBuilds}
          builds={builds}
          handleDelete={handleDelete}
          scope={scope}
        />
      )}

      {tab === 'trends' && (
        <div className="rounded border border-border bg-background/60 p-4">
          <SizeTrendChart data={trend} height={200} />
        </div>
      )}

      {tab === 'compare' && (
        <BuildComparison builds={builds} />
      )}
    </div>
  );
}
