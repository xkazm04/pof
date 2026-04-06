'use client';

import { useState, useMemo, useCallback } from 'react';
import { Play, Target, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ACCENT_EMERALD, ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_20, OPACITY_25, OPACITY_50,
  GLOW_SM,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader, GlowStat } from '../_design';
import { SubTabNavigation } from '../_shared';
import {
  runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG,
  type ItemEconomyConfig, type ItemEconomyResult,
} from '@/lib/economy/item-economy-engine';
import { ACCENT, SUB_TABS } from './constants';
import { PowerTab, RarityTab } from './PowerRarityTabs';
import { AffixTab, AlertsTab } from './AffixAlertsTabs';

/* ── Config Input ─────────────────────────────────────────────────────── */

const INPUT_CLS =
  'w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50';

function ConfigInput({ label, value, onChange, min, max, step, wide }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; wide?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted block mb-0.5">
        {label}
      </span>
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className={wide ? 'w-20 ' + INPUT_CLS.replace('w-16 ', '') : INPUT_CLS}
      />
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

interface Props { moduleId: string }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemEconomySimulator({ moduleId }: Props) {
  const [config, setConfig] = useState<ItemEconomyConfig>({ ...DEFAULT_ITEM_ECON_CONFIG });
  const [result, setResult] = useState<ItemEconomyResult | null>(null);
  const [activeTab, setActiveTab] = useState('power');
  const [isRunning, setIsRunning] = useState(false);

  const runSim = useCallback(() => {
    setIsRunning(true);
    requestAnimationFrame(() => {
      const r = runItemEconomySim(config);
      setResult(r);
      setIsRunning(false);
    });
  }, [config]);

  const updateConfig = useCallback(
    <K extends keyof ItemEconomyConfig>(key: K, value: ItemEconomyConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }, [],
  );

  const summary = useMemo(() => {
    if (!result) return null;
    const endgame = result.brackets[result.brackets.length - 1];
    const mid = result.brackets[Math.floor(result.brackets.length / 2)];
    return {
      peakPower: Math.max(...result.powerCurve.map((d) => d.avgPower)),
      endgamePower: endgame?.avgItemPower ?? 0,
      midPower: mid?.avgItemPower ?? 0,
      alertCount: result.alerts.length,
      criticalCount: result.alerts.filter((a) => a.severity === 'critical').length,
      rarityInflation: result.rarityInflation,
      simTime: result.durationMs,
    };
  }, [result]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
            <Activity
              className="w-4 h-4 relative z-10"
              style={{ color: ACCENT, filter: `drop-shadow(${GLOW_SM} ${withOpacity(ACCENT, OPACITY_50)})` }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-text tracking-wide">
              Item Economy Simulator
            </span>
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              Monte Carlo loot distribution &amp; balance analysis
            </span>
          </div>
        </div>
        {summary && (
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
            {summary.simTime.toFixed(0)}ms
          </span>
        )}
      </div>

      {/* Config + Run */}
      <BlueprintPanel color={ACCENT} className="p-3 space-y-3">
        <SectionHeader icon={Target} label="Simulation Config" color={ACCENT} />
        <div className="flex items-end gap-3 flex-wrap">
          <ConfigInput label="Players" value={config.playerCount}
            onChange={(v) => updateConfig('playerCount', v)} min={10} max={5000} step={50} wide />
          <ConfigInput label="Max Level" value={config.maxLevel}
            onChange={(v) => updateConfig('maxLevel', v)} min={5} max={100} step={5} />
          <ConfigInput label="Hours" value={config.maxHours}
            onChange={(v) => updateConfig('maxHours', v)} min={10} max={500} step={10} />
          <ConfigInput label="Drops/Hr" value={config.dropsPerHour}
            onChange={(v) => updateConfig('dropsPerHour', v)} min={1} max={30} step={1} />
          <ConfigInput label="Seed" value={config.seed}
            onChange={(v) => updateConfig('seed', v)} min={1} max={99999} step={1} />
          <div className="flex-1" />
          <button
            onClick={runSim} disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold
              transition-all hover:scale-105 disabled:opacity-50"
            style={{
              backgroundColor: `${ACCENT}${OPACITY_20}`,
              color: ACCENT,
              border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}`,
            }}
          >
            <Play className="w-3.5 h-3.5" />
            {isRunning ? 'Running...' : `Simulate ${config.playerCount} Players`}
          </button>
        </div>
      </BlueprintPanel>

      {/* Summary stats */}
      {summary && result && (
        <div className="grid grid-cols-6 gap-2">
          <GlowStat label="Peak Power" value={summary.peakPower.toFixed(0)}
            color={ACCENT} delay={0} />
          <GlowStat label="Mid Power" value={summary.midPower.toFixed(0)}
            color={ACCENT_EMERALD} delay={0.05} />
          <GlowStat label="End Power" value={summary.endgamePower.toFixed(0)}
            color={ACCENT_CYAN} delay={0.1} />
          <GlowStat label="Inflation" value={`${summary.rarityInflation.toFixed(1)}x`}
            color={summary.rarityInflation > 3 ? STATUS_WARNING : STATUS_SUCCESS} delay={0.15} />
          <GlowStat label="Alerts" value={String(summary.alertCount)}
            color={summary.criticalCount > 0 ? STATUS_ERROR
              : summary.alertCount > 0 ? STATUS_WARNING : STATUS_SUCCESS} delay={0.2} />
          <GlowStat label="Critical" value={String(summary.criticalCount)}
            color={summary.criticalCount > 0 ? STATUS_ERROR : STATUS_SUCCESS} delay={0.25} />
        </div>
      )}

      {/* Tab navigation */}
      {result && (
        <SubTabNavigation tabs={SUB_TABS} activeTabId={activeTab}
          onChange={setActiveTab} accent={ACCENT} />
      )}

      {/* Tab content */}
      {result && activeTab === 'power' && <PowerTab result={result} config={config} />}
      {result && activeTab === 'rarity' && <RarityTab result={result} config={config} />}
      {result && activeTab === 'affixes' && <AffixTab result={result} />}
      {result && activeTab === 'alerts' && <AlertsTab result={result} config={config} />}

      {/* Empty state */}
      {!result && (
        <BlueprintPanel color={ACCENT} className="flex flex-col items-center justify-center py-16">
          <Activity className="w-10 h-10 text-text-muted/20 mb-3" />
          <p className="text-sm font-bold text-text-muted">No simulation results yet</p>
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mt-1">
            Configure parameters above and click &ldquo;Simulate&rdquo; to run a
            Monte Carlo economy analysis
          </p>
        </BlueprintPanel>
      )}
    </motion.div>
  );
}
