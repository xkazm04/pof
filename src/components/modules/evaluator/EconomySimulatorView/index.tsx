'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Coins, AlertTriangle, Play,
  ArrowUpRight, ArrowDownRight,
  RefreshCw, Settings2,
  Scale, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { EconomyCodeGenPanel } from '../EconomyCodeGenPanel';
import { EconomyRunsStrip } from '../EconomyRunsStrip';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { SimulationConfig } from '@/types/economy-simulator';
import { MOTION } from '@/lib/constants';
import { EMPTY_METRICS, EMPTY_ALERTS, EMPTY_SUPPLY, PHILOSOPHY_LABELS } from './constants';
import { runBlockReason, formatGold } from './helpers';
import { ConfigPanel } from './ConfigPanel';
import { GoldFlowChart } from './GoldFlowChart';
import { WealthDistributionChart } from './WealthDistributionChart';
import { SupplyDemandSection } from './SupplyDemandSection';
import { AlertsSection } from './AlertsSection';
import { TornadoSection } from './TornadoSection';
import { GoalSeekPanel } from './GoalSeekPanel';
import { StatCard } from './StatCard';

// Public re-exports (preserve every symbol the original module exported).
export { wealthGridClass, runBlockReason } from './helpers';
export { ConfigField } from './ConfigPanel';
export { WealthDistributionChart } from './WealthDistributionChart';

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
  // Out-of-range config fields, keyed by label → human reason. A non-empty map
  // blocks the Run button (config can never carry an out-of-range value — those
  // are held in each field's draft until corrected or clamped on blur).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch defaults on mount
  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  // Sync config when defaults arrive (state-during-render pattern)
  if (defaultConfig && !config) setConfig(defaultConfig);

  // Toggle the config panel, resetting field errors each time. Collapsing
  // unmounts the inputs, so a lingering invalid draft must not keep Run disabled
  // from behind a hidden panel; reopening simply starts clean.
  const toggleConfig = useCallback(() => {
    setShowConfig((open) => !open);
    setFieldErrors((errs) => (Object.keys(errs).length ? {} : errs));
  }, []);

  const handleFieldValidity = useCallback((label: string, error: string | null) => {
    setFieldErrors((prev) => {
      if (error) {
        return prev[label] === error ? prev : { ...prev, [label]: error };
      }
      if (!(label in prev)) return prev;
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }, []);

  const handleRun = useCallback(async () => {
    if (!config) return;
    await runSimulation(config);
  }, [config, runSimulation]);

  const blockReason = runBlockReason({
    isSimulating,
    hasConfig: !!config,
    invalidLabels: Object.keys(fieldErrors),
  });

  // Summary stats from last metric
  const lastMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
  const warningAlerts = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <DashboardHeader
          icon={Coins}
          title="Economy Simulator"
          subtitle="Agent-based economy simulation with inflation prediction"
          accent="amber"
          accentTo="orange"
          className="mb-4"
          action={
            // Config + Run share one wrapping flex group: as the title shrinks and
            // the action area is squeezed on narrow/zoomed viewports, the two
            // buttons wrap past each other (Run drops below Config) instead of
            // overflowing or colliding.
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={toggleConfig}
                aria-expanded={showConfig}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border rounded-lg text-text-muted text-xs font-medium hover:text-text hover:border-border-bright transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Config
              </button>
              {/* Tooltip lives on the wrapper span: a disabled button doesn't
                  reliably surface `title` on hover, but its enabled parent does. */}
              <span className="inline-flex" title={blockReason ?? undefined}>
                <button
                  onClick={handleRun}
                  disabled={!!blockReason}
                  aria-label={blockReason ? `Run Simulation — unavailable: ${blockReason}` : 'Run Simulation'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSimulating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {isSimulating ? 'Simulating...' : 'Run Simulation'}
                </button>
              </span>
            </div>
          }
        />

        {/* Config panel */}
        <AnimatePresence>
          {showConfig && config && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: MOTION.base }}
              className="overflow-hidden mb-4"
            >
              <ConfigPanel config={config} onChange={setConfig} onValidity={handleFieldValidity} />
            </motion.div>
          )}
        </AnimatePresence>

        <EconomyRunsStrip />

        {/* Stats bar */}
        {lastMetric && (
          <div className="flex flex-wrap gap-3 mb-4">
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
        {isLoading && <LoadingRow label="Loading economy parameters…" color={STATUS_WARNING} />}

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
              Configure your economy parameters and click &quot;Run Simulation&quot; to model
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

            {/* Parameter Sensitivity (tornado) */}
            {config && <TornadoSection config={config} />}

            {/* Goal-seek: auto-balance a lever to a target */}
            {config && <GoalSeekPanel config={config} />}

            {/* UE5 Code Generator */}
            <EconomyCodeGenPanel />
          </div>
        )}
      </div>
    </div>
  );
}
