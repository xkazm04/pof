'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid3x3,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { FeatureStatusEntry } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiFetch } from '@/lib/api-utils';
import { useNavigationStore } from '@/stores/navigationStore';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

const ALL_MODULE_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS);

// ── Status colors ──

const STATUS_COLORS = {
  implemented: '#4ade80',
  partial: '#fbbf24',
  missing: '#f87171',
  unknown: 'var(--text-muted)',
} as const;

const STATUS_LABELS = {
  implemented: 'Implemented',
  partial: 'Partial',
  missing: 'Missing',
  unknown: 'Unknown',
} as const;

type StatusKey = keyof typeof STATUS_COLORS;
const STATUS_KEYS: StatusKey[] = ['implemented', 'partial', 'missing', 'unknown'];

// ── Category grouping ──

const MODULE_CATEGORIES: Record<string, string> = {};
for (const id of ALL_MODULE_IDS) {
  if (id.startsWith('arpg-')) MODULE_CATEGORIES[id] = 'Core Engine';
  else if (['models', 'animations', 'materials', 'level-design', 'ui-hud', 'audio'].includes(id)) MODULE_CATEGORIES[id] = 'Content';
  else MODULE_CATEGORIES[id] = 'Game Systems';
}

type SortKey = 'name' | 'completion' | 'missing';

// ── Types ──

interface CellData {
  moduleId: string;
  label: string;
  category: string;
  total: number;
  implemented: number;
  partial: number;
  missing: number;
  unknown: number;
  pctComplete: number;
}

interface MissingFeatureGroup {
  featureName: string;
  modules: string[];
}

// ── Component ──

export function CrossModuleFeatureDashboard() {
  const [aggregates, setAggregates] = useState<ModuleAggregate[]>([]);
  const [allStatuses, setAllStatuses] = useState<FeatureStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('completion');
  const [hoveredCell, setHoveredCell] = useState<{ module: string; status: StatusKey } | null>(null);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [aggData, statusData] = await Promise.all([
        apiFetch<{ modules: ModuleAggregate[] }>('/api/feature-matrix/aggregate'),
        apiFetch<{ statuses: FeatureStatusEntry[] }>('/api/feature-matrix/all-statuses'),
      ]);
      setAggregates(aggData.modules ?? []);
      setAllStatuses(statusData.statuses ?? []);
    } catch (err) {
      console.error('CrossModuleFeatureDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build cell data for each module
  const cells: CellData[] = useMemo(() => {
    const aggMap = new Map(aggregates.map((a) => [a.moduleId, a]));

    return ALL_MODULE_IDS.map((moduleId) => {
      const agg = aggMap.get(moduleId);
      const defCount = MODULE_FEATURE_DEFINITIONS[moduleId]?.length ?? 0;
      const total = agg?.total ?? defCount;
      const implemented = agg?.implemented ?? 0;
      const partial = agg?.partial ?? 0;
      const missing = agg?.missing ?? 0;
      const unknown = agg?.unknown ?? total;
      const pctComplete = total > 0 ? implemented / total : 0;

      return {
        moduleId,
        label: MODULE_LABELS[moduleId] ?? moduleId,
        category: MODULE_CATEGORIES[moduleId] ?? 'Other',
        total,
        implemented,
        partial,
        missing,
        unknown,
        pctComplete,
      };
    });
  }, [aggregates]);

  // Sort cells
  const sortedCells = useMemo(() => {
    const sorted = [...cells];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.label.localeCompare(b.label));
        break;
      case 'completion':
        sorted.sort((a, b) => a.pctComplete - b.pctComplete);
        break;
      case 'missing':
        sorted.sort((a, b) => b.missing - a.missing);
        break;
    }
    return sorted;
  }, [cells, sortBy]);

  // Group by category for display
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CellData[]> = {};
    for (const cell of sortedCells) {
      if (!groups[cell.category]) groups[cell.category] = [];
      groups[cell.category].push(cell);
    }
    return groups;
  }, [sortedCells]);

  // Project totals
  const totals = useMemo(() => {
    const t = { total: 0, implemented: 0, partial: 0, missing: 0, unknown: 0 };
    for (const c of cells) {
      t.total += c.total;
      t.implemented += c.implemented;
      t.partial += c.partial;
      t.missing += c.missing;
      t.unknown += c.unknown;
    }
    return t;
  }, [cells]);

  const overallPct = totals.total > 0 ? Math.round((totals.implemented / totals.total) * 100) : 0;

  // Lowest-scoring modules (least % implemented)
  const lowestModules = useMemo(() => {
    return [...cells]
      .filter((c) => c.total > 0)
      .sort((a, b) => a.pctComplete - b.pctComplete)
      .slice(0, 5);
  }, [cells]);

  // Features with most 'missing' status across modules
  const mostMissingFeatures = useMemo(() => {
    const missing = allStatuses.filter((s) => s.status === 'missing');
    const featureCount = new Map<string, string[]>();
    for (const s of missing) {
      const label = MODULE_LABELS[s.moduleId] ?? s.moduleId;
      const existing = featureCount.get(s.featureName) ?? [];
      existing.push(label);
      featureCount.set(s.featureName, existing);
    }

    const groups: MissingFeatureGroup[] = Array.from(featureCount.entries())
      .map(([featureName, modules]) => ({ featureName, modules }))
      .sort((a, b) => b.modules.length - a.modules.length);

    return groups.slice(0, 8);
  }, [allStatuses]);

  // Cell intensity (opacity based on count relative to module total)
  function cellIntensity(count: number, total: number): number {
    if (total === 0 || count === 0) return 0;
    return 0.15 + (count / total) * 0.85;
  }

  const handleCellClick = useCallback((moduleId: string) => {
    navigateToModule(moduleId);
  }, [navigateToModule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Overall progress cards ─────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard
          icon={TrendingUp}
          label="Overall"
          value={`${overallPct}%`}
          sub={`${totals.implemented}/${totals.total}`}
          color="#4ade80"
        />
        {STATUS_KEYS.map((key) => (
          <SummaryCard
            key={key}
            icon={key === 'implemented' ? CheckCircle2 : key === 'partial' ? AlertTriangle : key === 'missing' ? XCircle : HelpCircle}
            label={STATUS_LABELS[key]}
            value={`${totals[key]}`}
            sub={totals.total > 0 ? `${Math.round((totals[key] / totals.total) * 100)}%` : '0%'}
            color={STATUS_COLORS[key]}
          />
        ))}
      </div>

      {/* ── Stacked completion bar ──────────────────────── */}
      <SurfaceCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#9ca0be] uppercase tracking-wider">
            Project Feature Status
          </span>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="h-3 bg-border rounded-full overflow-hidden flex">
          {STATUS_KEYS.map((key) => {
            const pct = totals.total > 0 ? (totals[key] / totals.total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <motion.div
                key={key}
                className="h-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ backgroundColor: STATUS_COLORS[key] }}
                title={`${STATUS_LABELS[key]}: ${totals[key]} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {STATUS_KEYS.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-2xs" style={{ color: STATUS_COLORS[key] }}>
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
              {STATUS_LABELS[key]} ({totals[key]})
            </span>
          ))}
        </div>
      </SurfaceCard>

      {/* ── Heatmap Grid: Rows = modules, Columns = status categories ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="text-xs font-semibold text-[#9ca0be] uppercase tracking-wider">
              Feature Status Heatmap
            </span>
            <span className="text-2xs text-text-muted">
              {cells.length} modules / {totals.total} features
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3 h-3 text-text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-background border border-border rounded px-2 py-1 text-text outline-none focus:border-border-bright transition-colors"
            >
              <option value="completion">Sort: Least Complete</option>
              <option value="missing">Sort: Most Missing</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
          </div>
        </div>

        <div className="bg-[#0a0a1e] border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid items-center border-b border-border bg-surface-deep"
            style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
          >
            <div className="px-3 py-2 text-2xs font-semibold text-text-muted uppercase tracking-wider">
              Module
            </div>
            {STATUS_KEYS.map((key) => (
              <div
                key={key}
                className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-center"
                style={{ color: STATUS_COLORS[key] }}
              >
                {STATUS_LABELS[key]}
              </div>
            ))}
            <div className="px-2 py-2 text-2xs font-semibold text-text-muted uppercase tracking-wider text-center">
              Done %
            </div>
          </div>

          {/* Category groups */}
          {Object.entries(categoryGroups).map(([category, groupCells]) => (
            <div key={category}>
              {/* Category header */}
              <div className="px-3 py-1.5 bg-surface border-b border-border">
                <span className="text-2xs font-bold uppercase tracking-widest text-[#4a4e6a]">
                  {category}
                </span>
              </div>

              {/* Module rows */}
              {groupCells.map((cell, i) => {
                const pctDone = cell.total > 0 ? Math.round(cell.pctComplete * 100) : 0;

                return (
                  <motion.div
                    key={cell.moduleId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }}
                    className="grid items-center border-b border-border/50 hover:bg-surface transition-colors cursor-pointer group"
                    style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
                    onClick={() => handleCellClick(cell.moduleId)}
                  >
                    {/* Module name */}
                    <div className="px-3 py-2.5 flex items-center gap-2">
                      <span className="text-xs font-medium text-text group-hover:text-text truncate">
                        {cell.label}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#4a4e6a] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>

                    {/* Status cells */}
                    {STATUS_KEYS.map((key) => {
                      const count = cell[key];
                      const intensity = cellIntensity(count, cell.total);
                      const isHovered = hoveredCell?.module === cell.moduleId && hoveredCell?.status === key;

                      return (
                        <div
                          key={key}
                          className="px-2 py-2.5 flex items-center justify-center relative"
                          onMouseEnter={() => setHoveredCell({ module: cell.moduleId, status: key })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className="w-full h-7 rounded-md flex items-center justify-center transition-all duration-200"
                            style={{
                              backgroundColor: count > 0 ? `${STATUS_COLORS[key]}${Math.round(intensity * 20).toString(16).padStart(2, '0')}` : 'transparent',
                              border: isHovered && count > 0 ? `1px solid ${STATUS_COLORS[key]}60` : '1px solid transparent',
                            }}
                          >
                            {count > 0 && (
                              <span
                                className="text-xs font-semibold"
                                style={{ color: `${STATUS_COLORS[key]}${intensity > 0.5 ? 'ee' : '99'}` }}
                              >
                                {count}
                              </span>
                            )}
                          </div>

                          {/* Tooltip */}
                          {isHovered && count > 0 && (
                            <div
                              className="absolute z-20 bottom-full mb-1 px-2 py-1 rounded-md text-2xs font-medium whitespace-nowrap"
                              style={{
                                backgroundColor: 'var(--surface-hover)',
                                border: `1px solid ${STATUS_COLORS[key]}40`,
                                color: STATUS_COLORS[key],
                              }}
                            >
                              {count}/{cell.total} {STATUS_LABELS[key].toLowerCase()}
                              <span className="text-text-muted"> ({Math.round((count / cell.total) * 100)}%)</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Completion percentage */}
                    <div className="px-2 py-2.5 flex items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pctDone}%`,
                              backgroundColor: pctDone >= 80 ? '#4ade80' : pctDone >= 40 ? '#fbbf24' : pctDone > 0 ? '#f87171' : 'var(--text-muted)',
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-medium w-7 text-right"
                          style={{
                            color: pctDone >= 80 ? '#4ade80' : pctDone >= 40 ? '#fbbf24' : pctDone > 0 ? '#f87171' : 'var(--text-muted)',
                          }}
                        >
                          {pctDone}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}

          {/* Footer totals */}
          <div
            className="grid items-center bg-surface border-t border-border"
            style={{ gridTemplateColumns: '180px repeat(4, 1fr) 80px' }}
          >
            <div className="px-3 py-2.5">
              <span className="text-xs font-bold text-[#9ca0be] uppercase">
                Total ({cells.length} modules)
              </span>
            </div>
            {STATUS_KEYS.map((key) => (
              <div key={key} className="px-2 py-2.5 flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color: STATUS_COLORS[key] }}>
                  {totals[key]}
                </span>
              </div>
            ))}
            <div className="px-2 py-2.5 flex items-center justify-center">
              <span
                className="text-xs font-bold"
                style={{ color: overallPct >= 80 ? '#4ade80' : overallPct >= 40 ? '#fbbf24' : '#f87171' }}
              >
                {overallPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom panels: Lowest modules + Most missing features ────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Lowest-scoring modules */}
        <div className="bg-surface border border-[#f87171]/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f87171]" />
            <span className="text-xs font-semibold text-[#f87171] uppercase tracking-wider">
              Lowest Completion
            </span>
          </div>
          <div className="space-y-1.5">
            {lowestModules.map((m) => {
              const pct = Math.round(m.pctComplete * 100);
              return (
                <button
                  key={m.moduleId}
                  onClick={() => handleCellClick(m.moduleId)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors text-left group"
                >
                  <span className="text-xs text-text font-medium flex-1 group-hover:text-text">
                    {m.label}
                  </span>
                  <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 40 ? '#fbbf24' : pct > 0 ? '#f87171' : 'var(--text-muted)',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-medium w-7 text-right"
                    style={{ color: pct >= 40 ? '#fbbf24' : pct > 0 ? '#f87171' : 'var(--text-muted)' }}
                  >
                    {pct}%
                  </span>
                  <span className="text-2xs text-text-muted">
                    {m.missing} missing
                  </span>
                  <ChevronRight className="w-3 h-3 text-[#4a4e6a] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
            {lowestModules.length === 0 && (
              <p className="text-xs text-text-muted italic px-3 py-2">
                No reviewed modules yet
              </p>
            )}
          </div>
        </div>

        {/* Most missing features */}
        <div className="bg-surface border border-[#fbbf24]/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span className="text-xs font-semibold text-[#fbbf24] uppercase tracking-wider">
              Most Missing Features
            </span>
          </div>
          <div className="space-y-1.5">
            {mostMissingFeatures.map((f) => (
              <div
                key={f.featureName}
                className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors"
              >
                <XCircle className="w-3 h-3 text-[#f87171] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-text font-medium block truncate">
                    {f.featureName}
                  </span>
                  <span className="text-2xs text-text-muted">
                    Missing in: {f.modules.join(', ')}
                  </span>
                </div>
                <span className="text-xs font-medium text-[#f87171] flex-shrink-0">
                  {f.modules.length}x
                </span>
              </div>
            ))}
            {mostMissingFeatures.length === 0 && (
              <p className="text-xs text-text-muted italic px-3 py-2">
                No missing features found (run reviews first)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ──

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-surface border border-border rounded-lg p-3"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-2xs text-text-muted mt-0.5">{sub}</div>
    </motion.div>
  );
}
