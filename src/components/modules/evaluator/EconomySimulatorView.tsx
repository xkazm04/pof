'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Coins, TrendingUp, TrendingDown, AlertTriangle, Play,
  BarChart3, ArrowUpRight, ArrowDownRight, Users,
  ChevronDown, ChevronRight, RefreshCw, Settings2,
  Scale, Zap, ShieldAlert, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EconomyCodeGenPanel } from './EconomyCodeGenPanel';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type {
  SimulationConfig,
  EconomyMetrics,
  InflationAlert,
  SupplyDemandPoint,
  PlayerSnapshot,
  ItemCategory,
} from '@/types/economy-simulator';

// ── Constants ───────────────────────────────────────────────────────────────

const EMPTY_METRICS: EconomyMetrics[] = [];
const EMPTY_ALERTS: InflationAlert[] = [];
const EMPTY_SUPPLY: SupplyDemandPoint[] = [];

const SEVERITY_STYLE = {
  info: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400', icon: Activity },
  warning: { bg: 'bg-amber-400/10', border: 'border-amber-400/20', text: 'text-amber-400', icon: AlertTriangle },
  critical: { bg: 'bg-red-400/10', border: 'border-red-400/20', text: 'text-red-400', icon: ShieldAlert },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  inflation: 'Inflation',
  deflation: 'Deflation',
  'price-imbalance': 'Price Imbalance',
  'wealth-inequality': 'Wealth Gap',
  'dead-zone': 'Dead Zone',
};

const CATEGORY_COLORS: Record<ItemCategory, string> = {
  weapon: '#ef4444',
  armor: '#3b82f6',
  consumable: '#10b981',
  material: '#f59e0b',
  gem: '#a855f7',
  recipe: '#06b6d4',
};

const PHILOSOPHY_LABELS = {
  'loot-driven': 'Loot-Driven (Diablo-like)',
  'scarcity-based': 'Scarcity-Based (Souls-like)',
  balanced: 'Balanced',
} as const;

// ── Main Component ──────────────────────────────────────────────────────────

export function EconomySimulatorView() {
  const defaultConfig = useEconomySimulatorStore((s) => s.defaultConfig);
  const metrics = useEconomySimulatorStore((s) => s.metrics) ?? EMPTY_METRICS;
  const alerts = useEconomySimulatorStore((s) => s.alerts) ?? EMPTY_ALERTS;
  const supplyDemand = useEconomySimulatorStore((s) => s.supplyDemand) ?? EMPTY_SUPPLY;
  const result = useEconomySimulatorStore((s) => s.result);
  const isLoading = useEconomySimulatorStore((s) => s.isLoading);
  const isSimulating = useEconomySimulatorStore((s) => s.isSimulating);
  const error = useEconomySimulatorStore((s) => s.error);

  const fetchDefaults = useEconomySimulatorStore((s) => s.fetchDefaults);
  const runSimulation = useEconomySimulatorStore((s) => s.runSimulation);

  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<SimulationConfig | null>(null);

  // Fetch defaults on mount
  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  // Sync config when defaults arrive
  useEffect(() => {
    if (defaultConfig && !config) setConfig(defaultConfig);
  }, [defaultConfig, config]);

  const handleRun = useCallback(async () => {
    if (!config) return;
    await runSimulation(config);
  }, [config, runSimulation]);

  // Summary stats from last metric
  const lastMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
  const warningAlerts = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text">Economy Simulator</h1>
            <p className="text-xs text-text-muted">
              Agent-based economy simulation with inflation prediction
            </p>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-text-muted text-xs font-medium hover:text-text hover:border-border-bright transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Config
          </button>
          <button
            onClick={handleRun}
            disabled={isSimulating || !config}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {isSimulating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>

        {/* Config panel */}
        <AnimatePresence>
          {showConfig && config && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden mb-4"
            >
              <ConfigPanel config={config} onChange={setConfig} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats bar */}
        {lastMetric && (
          <div className="flex gap-3 mb-4">
            <StatCard
              icon={<Coins className="w-4 h-4 text-amber-400" />}
              value={formatGold(lastMetric.avgGold)}
              label="Avg Gold (endgame)"
              color="text-amber-400"
            />
            <StatCard
              icon={<Scale className="w-4 h-4 text-violet-400" />}
              value={lastMetric.giniCoefficient.toFixed(3)}
              label="Gini Coefficient"
              color={lastMetric.giniCoefficient > 0.6 ? 'text-red-400' : lastMetric.giniCoefficient > 0.4 ? 'text-amber-400' : 'text-violet-400'}
            />
            <StatCard
              icon={lastMetric.netFlowPerHour >= 0
                ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                : <ArrowDownRight className="w-4 h-4 text-red-400" />
              }
              value={`${lastMetric.netFlowPerHour >= 0 ? '+' : ''}${formatGold(lastMetric.netFlowPerHour)}/hr`}
              label="Net Flow"
              color={lastMetric.netFlowPerHour >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              value={`${criticalAlerts}/${warningAlerts}`}
              label="Critical/Warnings"
              color={criticalAlerts > 0 ? 'text-red-400' : 'text-amber-400'}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-text-muted">Loading economy parameters...</span>
          </div>
        )}

        {error && (
          <SurfaceCard className="p-4 mb-4 border-status-red-strong">
            <p className="text-sm text-red-400">{error}</p>
          </SurfaceCard>
        )}

        {!isLoading && !result && !isSimulating && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coins className="w-12 h-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">No simulation data yet</p>
            <p className="text-xs text-text-muted/70 mt-1 max-w-sm">
              Configure your economy parameters and click "Run Simulation" to model
              currency flow across {config?.agentCount ?? 100} virtual players
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Duration banner */}
            <div className="flex items-center gap-2 text-2xs text-text-muted">
              <Zap className="w-3 h-3" />
              Simulated {result.config.agentCount} players × {result.config.maxPlayHours}h in {result.durationMs}ms
              <span className="text-text-muted/50">|</span>
              Seed: {result.config.seed}
              <span className="text-text-muted/50">|</span>
              Philosophy: {PHILOSOPHY_LABELS[result.config.philosophy]}
            </div>

            {/* Gold Flow Chart */}
            <GoldFlowChart metrics={metrics} />

            {/* Wealth Distribution */}
            <WealthDistributionChart metrics={metrics} snapshots={result.finalSnapshots} />

            {/* Supply/Demand */}
            <SupplyDemandSection data={supplyDemand} maxLevel={config?.maxLevel ?? 25} />

            {/* Inflation Alerts */}
            <AlertsSection alerts={alerts} />

            {/* UE5 Code Generator */}
            <EconomyCodeGenPanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Config Panel ────────────────────────────────────────────────────────────

function ConfigPanel({ config, onChange }: { config: SimulationConfig; onChange: (c: SimulationConfig) => void }) {
  return (
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <ConfigField
          label="Virtual Players"
          value={config.agentCount}
          onChange={(v) => onChange({ ...config, agentCount: v })}
          min={10}
          max={500}
        />
        <ConfigField
          label="Max Level"
          value={config.maxLevel}
          onChange={(v) => onChange({ ...config, maxLevel: v })}
          min={10}
          max={100}
        />
        <ConfigField
          label="Play Hours"
          value={config.maxPlayHours}
          onChange={(v) => onChange({ ...config, maxPlayHours: v })}
          min={20}
          max={200}
        />
        <ConfigField
          label="Seed"
          value={config.seed}
          onChange={(v) => onChange({ ...config, seed: v })}
          min={1}
          max={999999}
        />
      </div>
      <div>
        <label className="text-2xs text-text-muted font-medium block mb-1">Economy Philosophy</label>
        <div className="flex gap-2">
          {(['loot-driven', 'scarcity-based', 'balanced'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...config, philosophy: p })}
              className={`px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors border ${
                config.philosophy === p
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-surface border-border text-text-muted hover:text-text'
              }`}
            >
              {PHILOSOPHY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

function ConfigField({ label, value, onChange, min, max }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="text-2xs text-text-muted font-medium block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-amber-500/40"
        min={min}
        max={max}
      />
    </div>
  );
}

// ── Gold Flow Chart (ASCII bar chart) ───────────────────────────────────────

function GoldFlowChart({ metrics }: { metrics: EconomyMetrics[] }) {
  if (metrics.length === 0) return null;

  const maxFlow = Math.max(
    ...metrics.map((m) => Math.max(m.inflowPerHour, m.outflowPerHour, 1)),
  );
  // Sample ~20 data points for the chart
  const step = Math.max(1, Math.floor(metrics.length / 20));
  const sampled = metrics.filter((_, i) => i % step === 0);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-medium text-text">Gold Flow Over Time</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-2xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Inflow</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Outflow</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Net</span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-32">
        {sampled.map((m, i) => {
          const inflowH = (m.inflowPerHour / maxFlow) * 100;
          const outflowH = (m.outflowPerHour / maxFlow) * 100;
          const net = m.netFlowPerHour;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-surface-deep border border-border rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-lg">
                  <div className="text-text-muted">Hour {m.hour} · Lvl {m.level}</div>
                  <div className="text-emerald-400">In: {formatGold(m.inflowPerHour)}/hr</div>
                  <div className="text-red-400">Out: {formatGold(m.outflowPerHour)}/hr</div>
                  <div className={net >= 0 ? 'text-amber-400' : 'text-red-400'}>
                    Net: {net >= 0 ? '+' : ''}{formatGold(net)}/hr
                  </div>
                  <div className="text-text-muted">Avg Gold: {formatGold(m.avgGold)}</div>
                </div>
              </div>
              {/* Bars */}
              <div className="w-full flex gap-px h-full items-end">
                <div
                  className="flex-1 bg-emerald-400/40 rounded-t-sm transition-all hover:bg-emerald-400/60"
                  style={{ height: `${inflowH}%` }}
                />
                <div
                  className="flex-1 bg-red-400/40 rounded-t-sm transition-all hover:bg-red-400/60"
                  style={{ height: `${outflowH}%` }}
                />
              </div>
              {/* X-axis label */}
              {i % Math.max(1, Math.floor(sampled.length / 8)) === 0 && (
                <span className="text-2xs text-text-muted/60 mt-1">{m.hour}h</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Gold accumulation line (text-based) */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-3 h-3 text-amber-400" />
          <span className="text-2xs text-text-muted font-medium">Avg Gold Accumulation</span>
        </div>
        <div className="flex items-end gap-px h-12">
          {sampled.map((m, i) => {
            const maxGold = Math.max(...sampled.map((s) => s.avgGold), 1);
            const h = (m.avgGold / maxGold) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-amber-400/30 rounded-t-sm"
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Wealth Distribution ─────────────────────────────────────────────────────

function WealthDistributionChart({ metrics, snapshots }: {
  metrics: EconomyMetrics[];
  snapshots: PlayerSnapshot[];
}) {
  if (snapshots.length === 0) return null;

  // Gini over time
  const step = Math.max(1, Math.floor(metrics.length / 20));
  const giniSampled = metrics.filter((_, i) => i % step === 0);

  // Wealth buckets for histogram
  const golds = snapshots.map((s) => s.gold).sort((a, b) => a - b);
  const maxG = golds[golds.length - 1] || 1;
  const bucketCount = 10;
  const bucketSize = maxG / bucketCount;
  const buckets = new Array(bucketCount).fill(0);
  for (const g of golds) {
    const idx = Math.min(Math.floor(g / bucketSize), bucketCount - 1);
    buckets[idx]++;
  }
  const maxBucket = Math.max(...buckets, 1);

  const lastGini = metrics.length > 0 ? metrics[metrics.length - 1].giniCoefficient : 0;

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-medium text-text">Wealth Distribution</h2>
        <div className="flex-1" />
        <Badge variant={lastGini > 0.6 ? 'error' : lastGini > 0.4 ? 'warning' : 'success'}>
          Gini: {lastGini.toFixed(3)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Gini over time */}
        <div>
          <div className="text-2xs text-text-muted font-medium mb-1">Gini Coefficient Over Time</div>
          <div className="flex items-end gap-px h-20">
            {giniSampled.map((m, i) => {
              const h = m.giniCoefficient * 100;
              const color = m.giniCoefficient > 0.6 ? 'bg-red-400/50' : m.giniCoefficient > 0.4 ? 'bg-amber-400/50' : 'bg-violet-400/50';
              return (
                <div key={i} className="flex-1 group relative">
                  <div className={`${color} rounded-t-sm w-full`} style={{ height: `${h}%` }} />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 left-1/2 -translate-x-1/2">
                    <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                      H{m.hour}: {m.giniCoefficient.toFixed(3)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
            <span>0h</span>
            <span>{metrics[metrics.length - 1]?.hour ?? 0}h</span>
          </div>
        </div>

        {/* Wealth histogram */}
        <div>
          <div className="text-2xs text-text-muted font-medium mb-1">Endgame Gold Distribution</div>
          <div className="flex items-end gap-1 h-20">
            {buckets.map((count, i) => {
              const h = (count / maxBucket) * 100;
              return (
                <div key={i} className="flex-1 group relative">
                  <div className="bg-amber-400/40 rounded-t-sm w-full" style={{ height: `${h}%` }} />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 left-1/2 -translate-x-1/2">
                    <div className="bg-surface-deep border border-border rounded px-1.5 py-0.5 text-2xs text-text-muted whitespace-nowrap">
                      {formatGold(Math.round(i * bucketSize))}-{formatGold(Math.round((i + 1) * bucketSize))}: {count} players
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
            <span>0g</span>
            <span>{formatGold(maxG)}</span>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

// ── Supply/Demand Section ───────────────────────────────────────────────────

function SupplyDemandSection({ data, maxLevel }: { data: SupplyDemandPoint[]; maxLevel: number }) {
  const [selectedCat, setSelectedCat] = useState<ItemCategory>('weapon');

  const categories: ItemCategory[] = ['weapon', 'armor', 'consumable', 'material', 'gem'];
  const filtered = useMemo(() =>
    data.filter((d) => d.category === selectedCat),
    [data, selectedCat],
  );

  if (data.length === 0) return null;

  const maxRate = Math.max(...filtered.map((d) => Math.max(d.supplyRate, d.demandRate)), 1);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Supply / Demand per Item Category</h2>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors ${
              selectedCat === cat
                ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                : 'border-border text-text-muted bg-surface hover:text-text'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
            {cat}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1 h-28">
        {filtered.map((d, i) => {
          const supH = (d.supplyRate / maxRate) * 100;
          const demH = (d.demandRate / maxRate) * 100;
          return (
            <div key={i} className="flex-1 flex gap-px items-end group relative">
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 left-1/2 -translate-x-1/2">
                <div className="bg-surface-deep border border-border rounded px-2 py-1 text-2xs whitespace-nowrap shadow-lg">
                  <div className="text-text-muted">Level {d.level}</div>
                  <div className="text-emerald-400">Supply: {d.supplyRate}/hr</div>
                  <div className="text-orange-400">Demand: {d.demandRate}/hr</div>
                  <div className="text-text-muted">Avg Price: {formatGold(d.avgPrice)}</div>
                  <div className="text-text-muted">Afford: {d.affordabilityIndex.toFixed(2)}</div>
                </div>
              </div>
              <div className="flex-1 bg-emerald-400/40 rounded-t-sm" style={{ height: `${supH}%` }} />
              <div className="flex-1 bg-orange-400/40 rounded-t-sm" style={{ height: `${demH}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-2xs text-text-muted/50 mt-1">
        <span>Lvl 1</span>
        <span>Lvl {maxLevel}</span>
      </div>
      <div className="flex items-center gap-3 text-2xs text-text-muted mt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Supply</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Demand</span>
      </div>
    </SurfaceCard>
  );
}

// ── Alerts Section ──────────────────────────────────────────────────────────

function AlertsSection({ alerts }: { alerts: InflationAlert[] }) {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) {
    return (
      <SurfaceCard className="p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-text">Economy Health</span>
          <Badge variant="success">No Issues Detected</Badge>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <ShieldAlert className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-text">Inflation Alerts</span>
        <Badge variant={alerts.some((a) => a.severity === 'critical') ? 'error' : 'warning'}>
          {alerts.length} issues
        </Badge>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3 space-y-2">
              {alerts.map((alert, i) => {
                const style = SEVERITY_STYLE[alert.severity];
                const Icon = style.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${style.text} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${style.text}`}>
                          {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                        </span>
                        <span className="text-2xs text-text-muted">Lvl {alert.level} · Hour {alert.hour}</span>
                      </div>
                      <p className="text-2xs text-text-muted/80 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-2.5 px-3 py-2 flex-1" level={2}>
      {icon}
      <div>
        <div className={`text-sm font-semibold ${color}`}>{value}</div>
        <div className="text-2xs text-text-muted">{label}</div>
      </div>
    </SurfaceCard>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatGold(amount: number): string {
  if (Math.abs(amount) >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return `${Math.round(amount)}`;
}
