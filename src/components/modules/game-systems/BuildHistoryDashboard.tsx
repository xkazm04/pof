'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, CheckCircle, XCircle, Clock, HardDrive, Tag, AlertTriangle,
  TrendingUp, ArrowLeftRight, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { BuildRecord, BuildStats, SizeTrendPoint } from '@/lib/packaging/build-history-store';
import { apiFetch } from '@/lib/api-utils';
import { SizeTrendChart } from './SizeTrendChart';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { BuildComparison } from './BuildComparison';

type DashboardTab = 'history' | 'trends' | 'compare';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ---------- Metric card ----------

function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <SurfaceCard level={2} className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">{label}</span>
      </div>
      <div className="text-base font-semibold text-text leading-tight">{value}</div>
      {sub && <div className="text-2xs text-text-muted mt-0.5">{sub}</div>}
    </SurfaceCard>
  );
}

// ---------- Build row ----------

function BuildRow({ build, onDelete }: { build: BuildRecord; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full grid grid-cols-[auto_1fr_80px_80px_80px_60px_auto] gap-2 items-center px-2 py-1.5 text-left hover:bg-surface-hover/30 transition-colors text-xs"
      >
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 text-text-muted" />
          : <ChevronRight className="w-2.5 h-2.5 text-text-muted" />
        }

        <div className="flex items-center gap-1.5 min-w-0">
          {build.status === 'success' ? (
            <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
          ) : build.status === 'failed' ? (
            <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
          ) : (
            <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0" />
          )}
          <span className="text-[#c8cce0] font-mono truncate">
            #{build.id}
          </span>
          {build.version && (
            <span className="text-2xs px-1 py-px rounded bg-[#8b5cf6]/15 text-[#a78bfa] font-mono">
              v{build.version}
            </span>
          )}
        </div>

        <span className="text-[#9ca0be] font-mono">{build.platform}</span>
        <span className="text-text-muted">{build.config}</span>
        <span className="text-[#9ca0be] font-mono">{build.sizeBytes != null ? formatBytes(build.sizeBytes) : '-'}</span>
        <span className="text-text-muted font-mono">{build.durationMs != null ? formatDuration(build.durationMs) : '-'}</span>

        <span className="text-2xs text-text-muted">
          {new Date(build.createdAt).toLocaleDateString()}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {build.outputPath && (
                <div>
                  <span className="text-text-muted">Output: </span>
                  <span className="text-[#9ca0be] font-mono break-all">{build.outputPath}</span>
                </div>
              )}
              {build.cookTimeMs != null && (
                <div>
                  <span className="text-text-muted">Cook time: </span>
                  <span className="text-[#9ca0be] font-mono">{formatDuration(build.cookTimeMs)}</span>
                </div>
              )}
              {(build.warningCount > 0 || build.errorCount > 0) && (
                <div className="flex items-center gap-2">
                  {build.errorCount > 0 && (
                    <span className="text-red-400">{build.errorCount} error{build.errorCount !== 1 ? 's' : ''}</span>
                  )}
                  {build.warningCount > 0 && (
                    <span className="text-yellow-400">{build.warningCount} warning{build.warningCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              )}
              {build.errorSummary && (
                <div className="col-span-2">
                  <span className="text-text-muted">Error: </span>
                  <span className="text-red-400/80 font-mono">{build.errorSummary}</span>
                </div>
              )}
              {build.notes && (
                <div className="col-span-2">
                  <span className="text-text-muted">Notes: </span>
                  <span className="text-[#9ca0be]">{build.notes}</span>
                </div>
              )}
              <div className="col-span-2 pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(build.id); }}
                  className="flex items-center gap-1 text-2xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Record build form ----------

function RecordBuildForm({ onSubmit, version }: { onSubmit: (data: Record<string, unknown>) => void; version: string }) {
  const [platform, setPlatform] = useState('Windows');
  const [config, setConfig] = useState('Shipping');
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [sizeGb, setSizeGb] = useState('');
  const [durationMin, setDurationMin] = useState('');

  const handleSubmit = () => {
    const sizeBytes = sizeGb ? Math.round(parseFloat(sizeGb) * 1024 * 1024 * 1024) : undefined;
    const durationMs = durationMin ? Math.round(parseFloat(durationMin) * 60000) : undefined;
    onSubmit({ platform, config, status, sizeBytes, durationMs });
    setSizeGb('');
    setDurationMin('');
  };

  const inputClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-[#c8cce0] font-mono outline-none focus:border-[#8b5cf6]/50 w-full';
  const selectClass = 'bg-background border border-border-bright rounded px-2 py-1 text-xs text-[#c8cce0] outline-none focus:border-[#8b5cf6]/50 w-full';

  return (
    <div className="rounded border border-border-bright bg-surface-deep/80 p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Plus className="w-3 h-3 text-[#8b5cf6]" />
        <span className="text-xs font-medium text-text">Record Build</span>
        <span className="ml-auto text-2xs text-text-muted font-mono">Next: v{version}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectClass}>
            <option>Windows</option>
            <option>Linux</option>
            <option>Mac</option>
            <option>Android</option>
            <option>iOS</option>
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Config</label>
          <select value={config} onChange={(e) => setConfig(e.target.value)} className={selectClass}>
            <option>Development</option>
            <option>DebugGame</option>
            <option>Shipping</option>
            <option>Test</option>
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'success' | 'failed')} className={selectClass}>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Size (GB)</label>
          <input value={sizeGb} onChange={(e) => setSizeGb(e.target.value)} placeholder="0.0" className={inputClass} />
        </div>
        <div>
          <label className="text-2xs text-text-muted uppercase tracking-wider">Duration (min)</label>
          <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="0" className={inputClass} />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        className="mt-2 w-full py-1.5 rounded text-xs font-medium text-white bg-[#8b5cf6]/80 hover:bg-[#8b5cf6] transition-colors"
      >
        Record Build
      </button>
    </div>
  );
}

// ---------- Version manager ----------

function VersionPanel({ version, onBump }: { version: string; onBump: (type: 'major' | 'minor' | 'patch') => void }) {
  return (
    <div className="rounded border border-border bg-surface-deep/80 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Tag className="w-3 h-3 text-[#8b5cf6]" />
        <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Version</span>
      </div>
      <div className="text-lg font-bold text-text font-mono mb-2">v{version}</div>
      <div className="flex items-center gap-1.5">
        {(['patch', 'minor', 'major'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onBump(type)}
            className="flex-1 py-1 rounded text-2xs font-medium text-[#9ca0be] bg-surface-hover hover:bg-border-bright hover:text-text transition-colors capitalize"
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Dashboard ----------

export function BuildHistoryDashboard() {
  const [tab, setTab] = useState<DashboardTab>('history');
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [stats, setStats] = useState<BuildStats | null>(null);
  const [trend, setTrend] = useState<SizeTrendPoint[]>([]);
  const [version, setVersion] = useState('0.1.0');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [buildsData, statsData, trendData, versionData] = await Promise.all([
        apiFetch<{ builds: BuildRecord[] }>('/api/packaging/history?action=list&limit=100'),
        apiFetch<{ stats: BuildStats | null }>('/api/packaging/history?action=stats'),
        apiFetch<{ trend: SizeTrendPoint[] }>('/api/packaging/history?action=trend&limit=50'),
        apiFetch<{ version: string }>('/api/packaging/history?action=version'),
      ]);
      setBuilds(buildsData.builds ?? []);
      setStats(statsData.stats ?? null);
      setTrend(trendData.trend ?? []);
      setVersion(versionData.version ?? '0.1.0');
    } catch (e) {
      console.error('Failed to fetch build history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRecord = useCallback(async (data: Record<string, unknown>) => {
    try {
      await apiFetch('/api/packaging/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', ...data }),
      });
      setShowForm(false);
      fetchAll();
    } catch (e) {
      console.error('Failed to record build:', e);
    }
  }, [fetchAll]);

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

  const tabClass = (t: DashboardTab) =>
    `px-2.5 py-1 text-xs font-medium rounded-t transition-colors ${
      tab === t
        ? 'text-text bg-surface-hover border-b-2 border-[#8b5cf6]'
        : 'text-text-muted hover:text-[#9ca0be]'
    }`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#8b5cf6]" />
          <span className="text-sm font-semibold text-text">Build History</span>
          {stats && (
            <span className="text-xs text-text-muted font-mono">{stats.totalBuilds} builds</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#8b5cf6] bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 transition-colors"
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

      {/* Metrics row */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <MetricCard
            label="Success Rate"
            value={`${stats.successRate.toFixed(0)}%`}
            sub={`${stats.successCount}/${stats.totalBuilds}`}
            icon={<CheckCircle className="w-3 h-3" />}
            color={stats.successRate >= 80 ? 'text-green-400' : stats.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}
          />
          <MetricCard
            label="Avg Duration"
            value={stats.avgDurationMs ? formatDuration(stats.avgDurationMs) : '-'}
            icon={<Clock className="w-3 h-3" />}
            color="text-blue-400"
          />
          <MetricCard
            label="Avg Size"
            value={stats.avgSizeBytes ? formatBytes(stats.avgSizeBytes) : '-'}
            icon={<HardDrive className="w-3 h-3" />}
            color="text-purple-400"
          />
          <MetricCard
            label="Failed"
            value={stats.failedCount}
            sub={stats.totalBuilds > 0 ? `${(100 - stats.successRate).toFixed(0)}%` : undefined}
            icon={<AlertTriangle className="w-3 h-3" />}
            color="text-red-400"
          />
          <VersionPanel version={version} onBump={handleBump} />
        </div>
      )}

      {/* Platform breakdown */}
      {stats && stats.platforms.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {stats.platforms.map((p) => (
            <div key={p.platform} className="rounded border border-border bg-surface-deep/60 px-2.5 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#c8cce0]">{p.platform}</span>
                <span className={`text-2xs font-mono ${p.successRate >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {p.successRate.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-1 rounded-full bg-surface-hover overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${p.successRate >= 80 ? 'bg-green-500' : p.successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${p.successRate}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-2xs text-text-muted">
                <span>{p.total} builds</span>
                {p.latestSizeBytes != null && <span>{formatBytes(p.latestSizeBytes)}</span>}
              </div>
            </div>
          ))}
        </div>
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
        <div className="rounded border border-border bg-background/60 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_80px_80px_80px_60px_auto] gap-2 px-2 py-1 bg-surface-deep border-b border-border text-2xs uppercase tracking-wider text-text-muted font-medium">
            <span className="w-2.5" />
            <span>Build</span>
            <span>Platform</span>
            <span>Config</span>
            <span>Size</span>
            <span>Time</span>
            <span>Date</span>
          </div>
          {builds.length === 0 ? (
            <div className="text-center text-text-muted text-xs py-8">
              No builds recorded yet. Use "Record" to add your first build.
            </div>
          ) : (
            builds.map((b) => (
              <BuildRow key={b.id} build={b} onDelete={handleDelete} />
            ))
          )}
        </div>
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
