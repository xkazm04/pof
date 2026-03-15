'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, Play, BarChart3, AlertTriangle, Layers,
  Zap, Coins, Target, PieChart, Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN,
  ACCENT_VIOLET, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL,
  OPACITY_10, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel, SubTabNavigation, SubTab } from './_shared';
import type { ItemRarity } from '@/types/economy-simulator';
import {
  runItemEconomySim, DEFAULT_ITEM_ECON_CONFIG,
  type ItemEconomyConfig, type ItemEconomyResult, type EconomyAlert,
} from '@/lib/economy/item-economy-engine';

const ACCENT = ACCENT_ORANGE;

/* ── Rarity colors ─────────────────────────────────────────────────────── */

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: STATUS_NEUTRAL,
  uncommon: STATUS_SUCCESS,
  rare: MODULE_COLORS.core,
  epic: ACCENT_VIOLET,
  legendary: STATUS_WARNING,
};

const RARITY_LABELS: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/* ── Stat display names ────────────────────────────────────────────────── */

const STAT_LABELS: Record<string, string> = {
  strength: 'STR', attackPower: 'ATK', armor: 'ARM', maxHealth: 'HP',
  critChance: 'CRIT%', critDamage: 'CDMG', attackSpeed: 'ASPD', armorPen: 'PEN',
  healthRegen: 'REGEN', maxMana: 'MANA', cooldownReduction: 'CDR', dodgeChance: 'DODGE',
  moveSpeed: 'SPD', goldFind: 'GOLD', magicFind: 'MF', xpBonus: 'XP',
};

/* ── Alert severity colors ─────────────────────────────────────────────── */

const ALERT_COLORS: Record<string, string> = {
  info: MODULE_COLORS.core,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

/* ── Sub-tabs ──────────────────────────────────────────────────────────── */

const SUB_TABS: SubTab[] = [
  { id: 'power', label: 'Power Curves', icon: TrendingUp },
  { id: 'rarity', label: 'Rarity Flow', icon: Layers },
  { id: 'affixes', label: 'Affix Saturation', icon: BarChart3 },
  { id: 'alerts', label: 'Balance Alerts', icon: AlertTriangle },
];

/* ── SVG Power Curve Chart ─────────────────────────────────────────────── */

function PowerCurveChart({ data }: {
  data: { level: number; avgPower: number; p10: number; p90: number }[];
}) {
  const width = 520;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxPower = Math.max(...data.map((d) => d.p90), 1);
  const maxLevel = Math.max(...data.map((d) => d.level), 1);

  const x = (level: number) => pad.left + (level / maxLevel) * cw;
  const y = (power: number) => pad.top + ch - (power / maxPower) * ch;

  const avgLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.avgPower)}`).join(' ');
  const p10Line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p10)}`).join(' ');
  const p90Line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p90)}`).join(' ');

  // Band between p10 and p90
  const bandPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(d.level)} ${y(d.p90)}`).join(' ')
    + data.map((d) => `L ${x(d.level)} ${y(d.p10)}`).reverse().join(' ')
    + ' Z';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <g key={pct}>
          <line
            x1={pad.left} y1={pad.top + ch * (1 - pct)}
            x2={width - pad.right} y2={pad.top + ch * (1 - pct)}
            stroke="rgba(255,255,255,0.06)" strokeWidth="1"
          />
          <text
            x={pad.left - 5} y={pad.top + ch * (1 - pct) + 4}
            textAnchor="end" className="text-xs font-mono fill-[var(--text-muted)]" style={{ fontSize: 9 }}
          >
            {Math.round(maxPower * pct)}
          </text>
        </g>
      ))}
      {/* X axis labels */}
      {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d) => (
        <text
          key={d.level}
          x={x(d.level)} y={height - 5}
          textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]" style={{ fontSize: 9 }}
        >
          Lv{d.level}
        </text>
      ))}
      {/* P10-P90 band */}
      <path d={bandPath} fill={`${ACCENT}15`} />
      {/* P10 line */}
      <path d={p10Line} fill="none" stroke={`${ACCENT}40`} strokeWidth="1" strokeDasharray="3 2" />
      {/* P90 line */}
      <path d={p90Line} fill="none" stroke={`${ACCENT}40`} strokeWidth="1" strokeDasharray="3 2" />
      {/* Average line */}
      <path d={avgLine} fill="none" stroke={ACCENT} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
      {/* Data points on average */}
      {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 10)) === 0).map((d) => (
        <circle key={d.level} cx={x(d.level)} cy={y(d.avgPower)} r="3" fill={ACCENT} />
      ))}
      {/* Labels */}
      <text x={width / 2} y={height - 0} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]" style={{ fontSize: 10 }}>
        Player Level
      </text>
      <text
        x={12} y={height / 2} textAnchor="middle" className="text-xs font-mono fill-[var(--text-muted)]"
        style={{ fontSize: 10 }} transform={`rotate(-90, 12, ${height / 2})`}
      >
        Item Power
      </text>
    </svg>
  );
}

/* ── Rarity Stacked Bar ────────────────────────────────────────────────── */

function RarityStackChart({ brackets }: {
  brackets: { level: number; rarityDistribution: Record<ItemRarity, number> }[];
}) {
  const width = 520;
  const height = 160;
  const pad = { top: 10, right: 20, bottom: 25, left: 40 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const barWidth = Math.max(2, cw / brackets.length - 1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {brackets.map((b, i) => {
        const bx = pad.left + (i / brackets.length) * cw;
        let cumY = 0;
        return (
          <g key={b.level}>
            {RARITY_LABELS.map((rarity) => {
              const pct = b.rarityDistribution[rarity] ?? 0;
              const barH = pct * ch;
              const by = pad.top + ch - cumY - barH;
              cumY += barH;
              return (
                <rect
                  key={rarity} x={bx} y={by} width={barWidth} height={Math.max(0, barH)}
                  fill={RARITY_COLORS[rarity]} opacity={0.8}
                >
                  <title>Lv{b.level} {rarity}: {(pct * 100).toFixed(1)}%</title>
                </rect>
              );
            })}
            {i % Math.max(1, Math.floor(brackets.length / 8)) === 0 && (
              <text
                x={bx + barWidth / 2} y={height - 5}
                textAnchor="middle" className="fill-[var(--text-muted)]" style={{ fontSize: 9 }}
              >
                {b.level}
              </text>
            )}
          </g>
        );
      })}
      {/* Y axis */}
      {[0, 0.5, 1].map((pct) => (
        <text
          key={pct} x={pad.left - 5} y={pad.top + ch * (1 - pct) + 4}
          textAnchor="end" className="fill-[var(--text-muted)]" style={{ fontSize: 9 }}
        >
          {Math.round(pct * 100)}%
        </text>
      ))}
    </svg>
  );
}

/* ── Affix Saturation Heatmap ──────────────────────────────────────────── */

function AffixHeatmap({ brackets }: {
  brackets: { level: number; affixSaturation: Record<string, number> }[];
}) {
  // Collect all stat keys
  const allStats = Array.from(
    new Set(brackets.flatMap((b) => Object.keys(b.affixSaturation)))
  ).sort();

  if (allStats.length === 0) return <p className="text-xs text-text-muted italic">No affix data</p>;

  const maxVal = Math.max(
    ...brackets.flatMap((b) => Object.values(b.affixSaturation)),
    0.01,
  );

  const cellSize = 22;
  const labelW = 50;
  const width = labelW + brackets.length * (cellSize + 1);
  const height = allStats.length * (cellSize + 1) + 20;

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Row labels */}
        {allStats.map((stat, ri) => (
          <text
            key={stat} x={labelW - 4} y={ri * (cellSize + 1) + cellSize / 2 + 4}
            textAnchor="end" className="fill-[var(--text-muted)]" style={{ fontSize: 9 }}
          >
            {STAT_LABELS[stat] ?? stat}
          </text>
        ))}
        {/* Cells */}
        {brackets.map((b, ci) => (
          <g key={b.level}>
            {allStats.map((stat, ri) => {
              const val = b.affixSaturation[stat] ?? 0;
              const intensity = val / maxVal;
              return (
                <rect
                  key={stat}
                  x={labelW + ci * (cellSize + 1)}
                  y={ri * (cellSize + 1)}
                  width={cellSize} height={cellSize}
                  rx={2}
                  fill={ACCENT}
                  opacity={0.1 + intensity * 0.8}
                >
                  <title>Lv{b.level} {stat}: {(val * 100).toFixed(1)}%</title>
                </rect>
              );
            })}
            {ci % Math.max(1, Math.floor(brackets.length / 8)) === 0 && (
              <text
                x={labelW + ci * (cellSize + 1) + cellSize / 2}
                y={allStats.length * (cellSize + 1) + 14}
                textAnchor="middle" className="fill-[var(--text-muted)]" style={{ fontSize: 8 }}
              >
                {b.level}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Alert Card ────────────────────────────────────────────────────────── */

function AlertCard({ alert }: { alert: EconomyAlert }) {
  const color = ALERT_COLORS[alert.severity] ?? STATUS_WARNING;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 px-2.5 py-2 rounded-md text-xs"
      style={{ backgroundColor: `${color}${OPACITY_10}`, border: `1px solid ${color}30` }}
    >
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold uppercase" style={{ color }}>
            {alert.severity}
          </span>
          <span className="font-mono text-text-muted">
            {alert.type}
          </span>
          {alert.level > 0 && (
            <span className="font-mono text-text-muted ml-auto">Lv{alert.level}</span>
          )}
        </div>
        <p className="text-text mt-0.5">{alert.message}</p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

interface Props { moduleId: string }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ItemEconomySimulator({ moduleId }: Props) {
  const [config, setConfig] = useState<ItemEconomyConfig>({ ...DEFAULT_ITEM_ECON_CONFIG });
  const [result, setResult] = useState<ItemEconomyResult | null>(null);
  const [activeTab, setActiveTab] = useState('power');
  const [isRunning, setIsRunning] = useState(false);

  const runSim = useCallback(() => {
    setIsRunning(true);
    // Run async to avoid blocking UI
    requestAnimationFrame(() => {
      const r = runItemEconomySim(config);
      setResult(r);
      setIsRunning(false);
    });
  }, [config]);

  const updateConfig = useCallback(<K extends keyof ItemEconomyConfig>(key: K, value: ItemEconomyConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Summary stats
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 p-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
            <Activity className="w-4 h-4 relative z-10" style={{ color: ACCENT, filter: `drop-shadow(0 0 4px ${ACCENT}80)` }} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-text tracking-wide">Item Economy Simulator</span>
            <span className="text-xs text-text-muted">
              Monte Carlo loot distribution &amp; balance analysis
            </span>
          </div>
        </div>
        {summary && (
          <span className="text-xs font-mono text-text-muted">
            {summary.simTime.toFixed(0)}ms
          </span>
        )}
      </div>

      {/* Config + Run */}
      <SurfaceCard level={1} className="p-3 space-y-2">
        <SectionLabel icon={Target} label="Simulation Config" color={ACCENT} />
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <span className="text-xs font-mono text-text-muted block mb-0.5">Players</span>
            <input
              type="number" min={10} max={5000} step={50}
              value={config.playerCount}
              onChange={(e) => updateConfig('playerCount', parseInt(e.target.value) || 100)}
              className="w-20 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <span className="text-xs font-mono text-text-muted block mb-0.5">Max Level</span>
            <input
              type="number" min={5} max={100} step={5}
              value={config.maxLevel}
              onChange={(e) => updateConfig('maxLevel', parseInt(e.target.value) || 25)}
              className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <span className="text-xs font-mono text-text-muted block mb-0.5">Hours</span>
            <input
              type="number" min={10} max={500} step={10}
              value={config.maxHours}
              onChange={(e) => updateConfig('maxHours', parseInt(e.target.value) || 80)}
              className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <span className="text-xs font-mono text-text-muted block mb-0.5">Drops/Hr</span>
            <input
              type="number" min={1} max={30} step={1}
              value={config.dropsPerHour}
              onChange={(e) => updateConfig('dropsPerHour', parseInt(e.target.value) || 8)}
              className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <span className="text-xs font-mono text-text-muted block mb-0.5">Seed</span>
            <input
              type="number" min={1} max={99999}
              value={config.seed}
              onChange={(e) => updateConfig('seed', parseInt(e.target.value) || 42)}
              className="w-16 text-xs font-mono font-bold px-1.5 py-1 rounded bg-surface-deep border border-border/40 text-text focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex-1" />
          <button
            onClick={runSim}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
          >
            <Play className="w-3.5 h-3.5" />
            {isRunning ? 'Running...' : `Simulate ${config.playerCount} Players`}
          </button>
        </div>
      </SurfaceCard>

      {/* Summary cards */}
      {summary && result && (
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Peak Power', value: summary.peakPower.toFixed(0), color: ACCENT },
            { label: 'Mid Power', value: summary.midPower.toFixed(0), color: ACCENT_EMERALD },
            { label: 'End Power', value: summary.endgamePower.toFixed(0), color: ACCENT_CYAN },
            { label: 'Inflation', value: `${summary.rarityInflation.toFixed(1)}x`, color: summary.rarityInflation > 3 ? STATUS_WARNING : STATUS_SUCCESS },
            { label: 'Alerts', value: String(summary.alertCount), color: summary.criticalCount > 0 ? STATUS_ERROR : summary.alertCount > 0 ? STATUS_WARNING : STATUS_SUCCESS },
            { label: 'Critical', value: String(summary.criticalCount), color: summary.criticalCount > 0 ? STATUS_ERROR : STATUS_SUCCESS },
          ].map((card) => (
            <SurfaceCard key={card.label} level={2} className="p-2 text-center">
              <span className="text-xs font-mono text-text-muted block">{card.label}</span>
              <span className="text-lg font-bold font-mono" style={{ color: card.color }}>{card.value}</span>
            </SurfaceCard>
          ))}
        </div>
      )}

      {/* Tab navigation */}
      {result && (
        <SubTabNavigation tabs={SUB_TABS} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      )}

      {/* ── Power Curves Tab ───────────────────────────────────────────── */}
      {result && activeTab === 'power' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={TrendingUp} label="Item Power vs. Level" color={ACCENT} />
            <p className="text-xs text-text-muted">
              Average equipped item power per level bracket. Band shows P10–P90 spread.
            </p>
            <PowerCurveChart data={result.powerCurve} />
          </SurfaceCard>

          {/* Gear replacement cadence */}
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={Zap} label="Gear Replacement Cadence" color={ACCENT_EMERALD} />
            <div className="flex gap-1 items-end h-24">
              {result.brackets.map((b) => {
                const maxReplace = Math.max(...result.brackets.map((br) => br.gearReplacementCount), 1);
                const h = (b.gearReplacementCount / maxReplace) * 80;
                return (
                  <div
                    key={b.level}
                    className="flex-1 rounded-t-sm transition-all hover:opacity-80"
                    style={{
                      height: `${Math.max(h, 2)}%`,
                      backgroundColor: b.gearReplacementCount > 0 ? ACCENT_EMERALD : `${ACCENT_EMERALD}30`,
                      opacity: b.gearReplacementCount > 0 ? 0.7 : 0.2,
                    }}
                    title={`Lv${b.level}: ${b.gearReplacementCount} upgrades`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs font-mono text-text-muted">
              <span>Lv1</span>
              <span>Lv{config.maxLevel}</span>
            </div>
          </SurfaceCard>

          {/* Gold economy overlay */}
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={Coins} label="Average Gold by Level" color={ACCENT_ORANGE} />
            <div className="flex gap-1 items-end h-20">
              {result.brackets.map((b) => {
                const maxGold = Math.max(...result.brackets.map((br) => br.avgGold), 1);
                const h = (b.avgGold / maxGold) * 80;
                return (
                  <div
                    key={b.level}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${Math.max(h, 2)}%`, backgroundColor: ACCENT_ORANGE, opacity: 0.6 }}
                    title={`Lv${b.level}: ${b.avgGold}g avg`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs font-mono text-text-muted">
              <span>Lv1</span>
              <span>Lv{config.maxLevel}</span>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── Rarity Flow Tab ────────────────────────────────────────────── */}
      {result && activeTab === 'rarity' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={Layers} label="Rarity Distribution by Level" color={ACCENT} />
            <p className="text-xs text-text-muted">
              Stacked rarity breakdown showing how item quality shifts as players level up.
            </p>
            <RarityStackChart brackets={result.brackets} />
            {/* Legend */}
            <div className="flex gap-3 justify-center flex-wrap">
              {RARITY_LABELS.map((r) => (
                <div key={r} className="flex items-center gap-1 text-xs font-mono">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RARITY_COLORS[r] }} />
                  <span className="capitalize" style={{ color: RARITY_COLORS[r] }}>{r}</span>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* Rarity inflation metric */}
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={PieChart} label="Rarity Inflation Index" color={ACCENT_ORANGE} />
            <div className="grid grid-cols-3 gap-3">
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Early Game</span>
                <span className="text-xs font-mono text-text block">(Lv 1-5)</span>
                <div className="flex gap-1 mt-1 justify-center">
                  {RARITY_LABELS.map((r) => {
                    const early = result.brackets.slice(0, 5);
                    const avg = early.reduce((s, b) => s + (b.rarityDistribution[r] ?? 0), 0) / Math.max(early.length, 1);
                    return avg > 0.005 ? (
                      <span key={r} className="text-xs font-mono font-bold" style={{ color: RARITY_COLORS[r] }}>
                        {(avg * 100).toFixed(0)}%
                      </span>
                    ) : null;
                  })}
                </div>
              </SurfaceCard>
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Inflation</span>
                <span className="text-lg font-bold font-mono" style={{
                  color: result.rarityInflation > 5 ? STATUS_ERROR : result.rarityInflation > 3 ? STATUS_WARNING : STATUS_SUCCESS
                }}>
                  {result.rarityInflation.toFixed(1)}x
                </span>
              </SurfaceCard>
              <SurfaceCard level={2} className="p-2 text-center">
                <span className="text-xs font-mono text-text-muted block">Endgame</span>
                <span className="text-xs font-mono text-text block">(Lv {config.maxLevel - 3}+)</span>
                <div className="flex gap-1 mt-1 justify-center">
                  {RARITY_LABELS.map((r) => {
                    const end = result.brackets.slice(-4);
                    const avg = end.reduce((s, b) => s + (b.rarityDistribution[r] ?? 0), 0) / Math.max(end.length, 1);
                    return avg > 0.005 ? (
                      <span key={r} className="text-xs font-mono font-bold" style={{ color: RARITY_COLORS[r] }}>
                        {(avg * 100).toFixed(0)}%
                      </span>
                    ) : null;
                  })}
                </div>
              </SurfaceCard>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── Affix Saturation Tab ───────────────────────────────────────── */}
      {result && activeTab === 'affixes' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={BarChart3} label="Affix Saturation Heatmap" color={ACCENT} />
            <p className="text-xs text-text-muted">
              How affix distribution shifts per level. Brighter = higher prevalence. Watch for
              stats that become trivially available (saturation points).
            </p>
            <AffixHeatmap brackets={result.brackets} />
          </SurfaceCard>

          {/* Global affix breakdown */}
          <SurfaceCard level={1} className="p-3 space-y-2">
            <SectionLabel icon={PieChart} label="Global Affix Distribution" color={ACCENT_CYAN} />
            <div className="space-y-1">
              {Object.entries(result.globalAffixSaturation)
                .sort(([, a], [, b]) => b - a)
                .map(([stat, pct]) => {
                  const isSaturated = pct > 0.15;
                  return (
                    <div key={stat} className="flex items-center gap-2 text-xs font-mono">
                      <span className="w-12 text-right font-bold" style={{
                        color: isSaturated ? STATUS_WARNING : 'var(--text)',
                      }}>
                        {STAT_LABELS[stat] ?? stat}
                      </span>
                      <div className="flex-1 h-1.5 bg-surface-deep rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct * 100 * 5}%`, // scale to visual range
                            backgroundColor: isSaturated ? STATUS_WARNING : ACCENT_CYAN,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right" style={{
                        color: isSaturated ? STATUS_WARNING : 'var(--text-muted)',
                      }}>
                        {(pct * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── Balance Alerts Tab ──────────────────────────────────────────── */}
      {result && activeTab === 'alerts' && (
        <div className="space-y-3">
          <SurfaceCard level={1} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel icon={AlertTriangle} label="Balance Alerts" color={STATUS_WARNING} />
              <span className="text-xs font-mono text-text-muted">
                {result.alerts.length} alert{result.alerts.length !== 1 ? 's' : ''} detected
              </span>
            </div>
            {result.alerts.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-xs font-mono" style={{ color: STATUS_SUCCESS }}>
                  No balance issues detected
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {result.alerts
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, info: 2 };
                    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
                  })
                  .map((alert, i) => (
                    <AlertCard key={`${alert.type}-${alert.level}-${i}`} alert={alert} />
                  ))}
              </div>
            )}
          </SurfaceCard>

          {/* Simulation pipeline */}
          <SurfaceCard level={2} className="p-2 space-y-1.5">
            <span className="text-xs font-mono text-text-muted font-bold uppercase tracking-widest">Simulation Pipeline</span>
            {[
              { step: '1. Agent Init', desc: `${config.playerCount} players, Lv1, 50g`, color: ACCENT },
              { step: '2. Hourly Ticks', desc: `${config.maxHours} hours of play`, color: ACCENT_EMERALD },
              { step: '3. Gold Flow', desc: 'Faucets (kills, quests) - Sinks (pots, repairs)', color: ACCENT_ORANGE },
              { step: '4. Item Drops', desc: `${config.dropsPerHour}/hr, UE5 rarity-gated rolling`, color: ACCENT_CYAN },
              { step: '5. Affix Rolling', desc: 'Weighted selection, magnitude * (1+0.1*level)', color: ACCENT_VIOLET },
              { step: '6. Equip Logic', desc: 'Replace if new totalPower > equipped', color: STATUS_SUCCESS },
              { step: '7. Alert Detection', desc: 'Power plateaus, rarity inflation, saturation', color: STATUS_WARNING },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${s.color}${OPACITY_10}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-bold" style={{ color: s.color }}>{s.step}</span>
                <span className="text-text-muted ml-auto">{s.desc}</span>
              </div>
            ))}
          </SurfaceCard>
        </div>
      )}

      {/* Empty state */}
      {!result && (
        <SurfaceCard level={1} className="flex flex-col items-center justify-center py-16">
          <Activity className="w-10 h-10 text-text-muted/20 mb-3" />
          <p className="text-sm font-bold text-text-muted">No simulation results yet</p>
          <p className="text-xs text-text-muted mt-1">
            Configure parameters above and click &ldquo;Simulate&rdquo; to run a Monte Carlo economy analysis
          </p>
        </SurfaceCard>
      )}
    </motion.div>
  );
}
