'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  TrendingUp, Award, Settings2, Target, FastForward, SlidersHorizontal,
  Swords, Wand2, Sword, Layers, Clock, AlertTriangle, Shield,
  Trophy, Compass, Hammer, Star, Zap, RotateCcw, Crosshair, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, STATUS_ERROR, STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, SectionLabel, FeatureGrid, LoadingSpinner, RadarChart, LiveMetricGauge, TimelineStrip } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { ChartSeries, RadarDataPoint, GaugeMetric, TimelineEvent } from '@/types/unique-tab-improvements';

const ACCENT = STATUS_WARNING;

/* ── Progression configuration ─────────────────────────────────────────────── */

const MAX_LEVEL = 50;

// A simple simulated curve formula: BaseXP * Level^Exponent
function calculateXpForLevel(level: number, base: number, exponent: number): number {
  return Math.floor(base * Math.pow(level, exponent));
}

// Simulated data points for the chart
const generateChartData = (base: number, exp: number) => {
  const data = [];
  // Sample every 5 levels
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl += 5) {
    // Make sure 50 is included
    const levelToUse = lvl > MAX_LEVEL ? MAX_LEVEL : lvl;
    data.push({
      level: levelToUse,
      xp: calculateXpForLevel(levelToUse, base, exp),
      totalParams: Math.floor(levelToUse * 1.5),
    });
  }
  return data;
};

/* ── Asset list ────────────────────────────────────────────────────────────── */

const PROGRESSION_FEATURES = [
  'Data Asset for curves',
  'SaveGame system integration',
  'Global parameter modifiers',
  'Level up animation',
  'Skill point allocation UI',
];

/* ── 8.1 Multi-Curve Overlay Data ──────────────────────────────────────────── */

const MULTI_CURVE_SERIES: ChartSeries[] = [
  {
    id: 'xp', label: 'XP Required', color: STATUS_WARNING,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: Math.floor(100 * Math.pow(i * 5 || 1, 1.5)) })),
    visible: true,
  },
  {
    id: 'hp', label: 'HP', color: STATUS_SUCCESS,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 100 + i * 5 * 20 })),
    visible: true,
  },
  {
    id: 'mana', label: 'Mana', color: ACCENT_CYAN,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 50 + i * 5 * 12 })),
    visible: true,
  },
  {
    id: 'damage', label: 'Damage', color: STATUS_ERROR,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 10 + i * 5 * 8 + Math.floor(Math.pow(i * 5, 1.2)) })),
    visible: true,
  },
  {
    id: 'enemy_hp', label: 'Enemy HP', color: ACCENT_VIOLET,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 5, y: 80 + i * 5 * 25 + Math.floor(Math.pow(i * 5, 1.3)) })),
    visible: true,
  },
];

/* ── 8.2 Build Path Comparison Data ────────────────────────────────────────── */

const BUILD_STATS = ['Strength', 'Intelligence', 'Dexterity', 'Vitality', 'Endurance'] as const;

interface BuildPreset {
  name: string;
  icon: typeof Swords;
  color: string;
  stats: Record<typeof BUILD_STATS[number], number>;
  radarData: RadarDataPoint[];
}

const BUILD_PRESETS: BuildPreset[] = [
  {
    name: 'Warrior', icon: Swords, color: STATUS_ERROR,
    stats: { Strength: 85, Intelligence: 20, Dexterity: 45, Vitality: 90, Endurance: 75 },
    radarData: [
      { axis: 'STR', value: 0.85 }, { axis: 'INT', value: 0.2 },
      { axis: 'DEX', value: 0.45 }, { axis: 'VIT', value: 0.9 }, { axis: 'END', value: 0.75 },
    ],
  },
  {
    name: 'Mage', icon: Wand2, color: ACCENT_CYAN,
    stats: { Strength: 15, Intelligence: 95, Dexterity: 30, Vitality: 40, Endurance: 35 },
    radarData: [
      { axis: 'STR', value: 0.15 }, { axis: 'INT', value: 0.95 },
      { axis: 'DEX', value: 0.3 }, { axis: 'VIT', value: 0.4 }, { axis: 'END', value: 0.35 },
    ],
  },
  {
    name: 'Rogue', icon: Sword, color: ACCENT_EMERALD,
    stats: { Strength: 40, Intelligence: 35, Dexterity: 95, Vitality: 50, Endurance: 45 },
    radarData: [
      { axis: 'STR', value: 0.4 }, { axis: 'INT', value: 0.35 },
      { axis: 'DEX', value: 0.95 }, { axis: 'VIT', value: 0.5 }, { axis: 'END', value: 0.45 },
    ],
  },
];

/* ── 8.3 XP Source Breakdown Data ──────────────────────────────────────────── */

const XP_SOURCES = [
  { label: 'Monster Kills', pct: 60, color: STATUS_ERROR },
  { label: 'Quest Completion', pct: 20, color: ACCENT_CYAN },
  { label: 'Boss Kills', pct: 10, color: ACCENT_VIOLET },
  { label: 'Exploration', pct: 10, color: ACCENT_EMERALD },
];

/* ── 8.4 Level-Up Reward Preview Data ──────────────────────────────────────── */

const LEVEL_REWARDS = [
  { level: 5, name: 'Dodge Roll', type: 'Ability', icon: FastForward, color: ACCENT_CYAN },
  { level: 10, name: 'Heavy Strike', type: 'Ability', icon: Swords, color: STATUS_ERROR },
  { level: 15, name: 'Fire Bolt', type: 'Spell', icon: Wand2, color: ACCENT_ORANGE },
  { level: 20, name: 'Skill Tree Tier 2', type: 'Unlock', icon: Layers, color: ACCENT_VIOLET },
  { level: 25, name: 'Ultimate', type: 'Ultimate', icon: Zap, color: STATUS_WARNING },
  { level: 30, name: 'Passive Mastery', type: 'Passive', icon: Shield, color: ACCENT_EMERALD },
  { level: 40, name: 'Ascension', type: 'Milestone', icon: Star, color: ACCENT_PINK },
  { level: 50, name: 'Prestige Unlock', type: 'Prestige', icon: Trophy, color: STATUS_WARNING },
];

/* ── 8.5 Time-to-Level Estimator Data ──────────────────────────────────────── */

const TTL_GAUGES: GaugeMetric[] = [
  { label: 'XP/min', current: 342, target: 500, unit: '/min', trend: 'up' },
  { label: 'Next Level', current: 68, target: 100, unit: '%', trend: 'up' },
  { label: 'Session XP', current: 12450, target: 20000, unit: 'XP', trend: 'stable' },
];

const TTL_TIMELINES = [
  { label: 'Casual (30min/day)', daysToMax: 145, color: ACCENT_CYAN },
  { label: 'Hardcore (4hr/day)', daysToMax: 18, color: STATUS_ERROR },
];

/* ── 8.6 Power Curve Danger Zones Data ─────────────────────────────────────── */

const DANGER_ZONE_LEVELS = Array.from({ length: 11 }, (_, i) => i * 5);
const PLAYER_POWER = [10, 35, 70, 120, 180, 250, 340, 450, 580, 730, 900];
const ENEMY_DIFFICULTY = [15, 30, 55, 100, 160, 240, 330, 420, 520, 650, 820];

const ZONE_THRESHOLDS = [
  { label: 'Easy', color: STATUS_SUCCESS, range: 'Player > Enemy +30%' },
  { label: 'Balanced', color: STATUS_WARNING, range: 'Within 30%' },
  { label: 'Hard', color: STATUS_ERROR, range: 'Enemy > Player +30%' },
];

/* ── 8.7 Diminishing Returns Data ──────────────────────────────────────────── */

const DR_ATTRIBUTES = [
  {
    name: 'Strength', color: STATUS_ERROR, softCap: 60,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 6 ? 10 - i * 0.5 : Math.max(10 - i * 1.5, 1),
    })),
  },
  {
    name: 'Dexterity', color: ACCENT_EMERALD, softCap: 50,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 5 ? 12 - i * 0.8 : Math.max(12 - i * 2, 0.5),
    })),
  },
  {
    name: 'Intelligence', color: ACCENT_CYAN, softCap: 70,
    curve: Array.from({ length: 10 }, (_, i) => ({
      points: (i + 1) * 10,
      marginalValue: i < 7 ? 8 - i * 0.3 : Math.max(8 - i * 1.2, 0.8),
    })),
  },
];

/* ── 8.8 Achievement Board Data ────────────────────────────────────────────── */

const ACHIEVEMENT_CATEGORIES = [
  {
    category: 'Combat', color: STATUS_ERROR, icon: Swords,
    achievements: [
      { name: 'First Blood', progress: 100, desc: 'Defeat your first enemy' },
      { name: 'Slayer', progress: 73, desc: 'Defeat 100 enemies' },
      { name: 'Boss Hunter', progress: 40, desc: 'Defeat 10 bosses' },
      { name: 'Untouchable', progress: 15, desc: 'Dodge 500 attacks' },
    ],
  },
  {
    category: 'Exploration', color: ACCENT_EMERALD, icon: Compass,
    achievements: [
      { name: 'Wanderer', progress: 100, desc: 'Visit 5 zones' },
      { name: 'Cartographer', progress: 60, desc: 'Reveal entire map' },
      { name: 'Secret Finder', progress: 25, desc: 'Find 20 hidden areas' },
      { name: 'Treasure Hunter', progress: 50, desc: 'Open 50 chests' },
    ],
  },
  {
    category: 'Crafting', color: ACCENT_ORANGE, icon: Hammer,
    achievements: [
      { name: 'Apprentice', progress: 100, desc: 'Craft your first item' },
      { name: 'Blacksmith', progress: 45, desc: 'Craft 50 weapons' },
      { name: 'Enchanter', progress: 20, desc: 'Enchant 25 items' },
      { name: 'Master Crafter', progress: 10, desc: 'Craft a legendary' },
    ],
  },
  {
    category: 'Progression', color: STATUS_WARNING, icon: TrendingUp,
    achievements: [
      { name: 'Level 10', progress: 100, desc: 'Reach level 10' },
      { name: 'Level 25', progress: 80, desc: 'Reach level 25' },
      { name: 'Level 50', progress: 30, desc: 'Reach level 50' },
      { name: 'Prestige', progress: 0, desc: 'Complete a prestige cycle' },
    ],
  },
];

/* ── 8.9 Rest XP System Data ──────────────────────────────────────────────── */

const REST_XP_DATA = {
  bankedXP: 4500,
  maxBankedXP: 10000,
  multiplier: 2,
  currentXP: 7800,
  nextLevelXP: 12000,
  estimatedKills: 23,
  regenRate: 150, // xp per hour offline
};

/* ── 8.10 Prestige / NG+ Data ──────────────────────────────────────────────── */

const PRESTIGE_DATA = {
  currentCycle: 0,
  maxCycles: 5,
  cycles: [
    { cycle: 1, statBonus: '+5%', diffMultiplier: '1.5x', estimatedTime: '40 hours', newAbility: 'Prestige Aura' },
    { cycle: 2, statBonus: '+12%', diffMultiplier: '2.0x', estimatedTime: '35 hours', newAbility: 'Soul Harvest' },
    { cycle: 3, statBonus: '+20%', diffMultiplier: '2.8x', estimatedTime: '30 hours', newAbility: 'Eternal Flame' },
    { cycle: 4, statBonus: '+30%', diffMultiplier: '3.5x', estimatedTime: '28 hours', newAbility: 'Void Walker' },
    { cycle: 5, statBonus: '+50%', diffMultiplier: '5.0x', estimatedTime: '25 hours', newAbility: 'Ascended Form' },
  ],
  carryOverItems: ['Gold (50%)', 'Skill Points (25%)', 'Unlocked Abilities', 'Achievement Progress'],
};

/* ── Component ─────────────────────────────────────────────────────────────── */

interface ProgressionCurveProps {
  moduleId: SubModuleId;
}

export function ProgressionCurve({ moduleId }: ProgressionCurveProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  // Modifiable parameters for the curve
  const [baseXp, setBaseXp] = useState(100);
  const [curveExp, setCurveExp] = useState(1.5);

  // 8.1 Multi-Curve visibility toggles
  const [curveVisibility, setCurveVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MULTI_CURVE_SERIES.map(s => [s.id, true]))
  );

  // 8.2 Build path toggles
  const [buildVisibility, setBuildVisibility] = useState<Record<string, boolean>>({
    Warrior: true, Mage: false, Rogue: false,
  });

  // 8.7 Selected DR attribute
  const [selectedDRAttr, setSelectedDRAttr] = useState(0);

  const chartData = useMemo(() => generateChartData(baseXp, curveExp), [baseXp, curveExp]);
  const maxXp = chartData[chartData.length - 1]?.xp ?? 10000;

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
      else if (s === 'partial') partial++;
    }
    return { total, implemented, partial };
  }, [defs, featureMap]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  // Ability unlock timeline data
  const abilityUnlocks = [
    { level: 5, name: 'Dodge Roll', class: 'Movement' },
    { level: 10, name: 'Heavy Strike', class: 'Attack' },
    { level: 25, name: 'Ultimate Power', class: 'Ultimate' },
    { level: 40, name: 'Ascension', class: 'Passive' },
  ];

  // 8.1 helpers
  const visibleSeries = MULTI_CURVE_SERIES.filter(s => curveVisibility[s.id]);
  const multiCurveMax = Math.max(...visibleSeries.flatMap(s => s.points.map(p => p.y)), 1);

  // 8.2 helpers
  const activeBuilds = BUILD_PRESETS.filter(b => buildVisibility[b.name]);
  const primaryBuild = activeBuilds[0];

  // 8.6 helpers
  const powerMax = Math.max(...PLAYER_POWER, ...ENEMY_DIFFICULTY);

  return (
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={TrendingUp} title="Progression Curve" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart Area */}
        <SurfaceCard level={2} className="lg:col-span-2 p-5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[rgba(255,255,255,0.01)] to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-1000" />

          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" /> Required XP per Level Curve
            </div>
            <div className="text-2xs font-mono text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
              Max Level: {MAX_LEVEL} | Max XP: {maxXp.toLocaleString()}
            </div>
          </div>

          <div className="w-full h-[280px] mt-2 bg-surface-deep/50 rounded-xl relative p-4 border border-border/40">
            <XpCurveChart data={chartData} maxXp={maxXp} />
          </div>
        </SurfaceCard>

        {/* Simulator Controls */}
        <SurfaceCard level={2} className="p-5 flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(255,255,255,0.01)] to-transparent pointer-events-none" />
          <div className="text-sm font-bold uppercase tracking-widest text-text-muted mb-6 flex items-center gap-2 relative z-10">
            <SlidersHorizontal className="w-4 h-4 text-amber-500" /> Curve Parameters
          </div>

          <div className="space-y-6 flex-1 relative z-10 bg-surface/30 p-4 rounded-xl border border-border/40">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-semibold text-text flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Base XP Scale
                </label>
                <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 rounded-sm border border-amber-500/20">{baseXp}</span>
              </div>
              <input
                title="Base XP"
                type="range"
                min="50"
                max="500"
                step="10"
                value={baseXp}
                onChange={(e) => setBaseXp(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
                <span>50</span>
                <span>Fast</span>
                <span>500</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-semibold text-text flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Exponential Factor
                </label>
                <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 rounded-sm border border-amber-500/20">{curveExp.toFixed(2)}</span>
              </div>
              <input
                title="Curve Exponential"
                type="range"
                min="1.1"
                max="2.5"
                step="0.05"
                value={curveExp}
                onChange={(e) => setCurveExp(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-surface-deep rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
                <span>Linear (1.1)</span>
                <span>Steep (2.5)</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40">
              <div className="text-xs text-text-muted mb-2">Simulation Impact</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text">Lv 10 → Lv 11</span>
                <span className="font-mono text-amber-400">
                  {Math.floor(calculateXpForLevel(11, baseXp, curveExp) - calculateXpForLevel(10, baseXp, curveExp)).toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ability Timeline */}
        <SurfaceCard level={2} className="p-4 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-1000" />
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-5 flex items-center gap-2 relative z-10">
            <Target className="w-4 h-4 text-cyan-400" /> Key Milestone Timeline
          </div>

          <div className="relative z-10 px-2">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--border)]" />
            <div className="space-y-5">
              {abilityUnlocks.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 relative"
                >
                  <div className="w-3 h-3 rounded-full border-2 border-[var(--surface-deep)] z-10 shadow-[0_0_5px_currentColor]"
                    style={{ backgroundColor: ACCENT_CYAN, color: ACCENT_CYAN }} />
                  <div className="flex-1 bg-surface/50 p-2.5 rounded-lg border border-border/40 flex justify-between items-center hover:bg-surface-hover/50 transition-colors group/milestone">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-text group-hover/milestone:text-cyan-400 transition-colors">{item.name}</span>
                      <span className="text-[10px] text-text-muted font-mono">{item.class}</span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-surface-deep px-2 py-1 rounded text-cyan-400 border border-border/60">
                      LV { } {item.level}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        {/* Feature List */}
        <SurfaceCard level={2} className="p-4 relative">
          <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-amber-500" /> System Integration Status
          </div>
          <FeatureGrid
            featureNames={PROGRESSION_FEATURES}
            featureMap={featureMap}
            defs={defs}
            expanded={expandedAsset}
            onToggle={toggleAsset}
            accent={ACCENT}
          />
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.1  MULTI-CURVE OVERLAY SYSTEM                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-amber-500/8 transition-colors duration-1000" />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <SectionLabel icon={Layers} label="Multi-Curve Overlay" color={ACCENT} />
          <div className="flex items-center gap-2 flex-wrap">
            {MULTI_CURVE_SERIES.map(s => (
              <label key={s.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={curveVisibility[s.id] ?? true}
                  onChange={() => setCurveVisibility(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                  className="w-3 h-3 rounded accent-amber-500"
                />
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-2xs font-mono text-text-muted">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="w-full h-[260px] bg-surface-deep/50 rounded-xl relative p-4 border border-border/40">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              {visibleSeries.map(s => (
                <linearGradient key={`grad-${s.id}`} id={`mcGrad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            {/* Grid lines */}
            {[25, 50, 75].map(pct => (
              <line key={pct} x1="0" y1={pct} x2="100" y2={pct} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            ))}

            {visibleSeries.map(s => {
              const pathD = s.points
                .map((p, i) => {
                  const x = (p.x / 50) * 100;
                  const y = 100 - (p.y / multiCurveMax) * 100;
                  return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
                })
                .join(' ');
              const lastPt = s.points[s.points.length - 1];
              const areaD = `${pathD} L ${(lastPt.x / 50) * 100},100 L 0,100 Z`;

              return (
                <g key={s.id}>
                  <motion.path
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                    d={areaD} fill={`url(#mcGrad-${s.id})`}
                  />
                  <motion.path
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
                    d={pathD} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-1 top-4 bottom-4 flex flex-col justify-between text-[9px] text-text-muted font-mono">
            <span>{multiCurveMax.toLocaleString()}</span>
            <span>{Math.floor(multiCurveMax / 2).toLocaleString()}</span>
            <span>0</span>
          </div>

          {/* X-axis labels */}
          <div className="absolute left-4 right-4 bottom-0 flex justify-between text-[9px] text-text-muted font-mono">
            <span>Lv 0</span><span>Lv 25</span><span>Lv 50</span>
          </div>
        </div>
      </SurfaceCard>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.2  BUILD PATH COMPARISON                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel icon={Crosshair} label="Build Path Comparison" color={ACCENT} />

        <div className="flex items-center gap-3 mt-3 mb-4">
          {BUILD_PRESETS.map(b => {
            const Icon = b.icon;
            const active = buildVisibility[b.name];
            return (
              <button
                key={b.name}
                onClick={() => setBuildVisibility(prev => ({ ...prev, [b.name]: !prev[b.name] }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                style={{
                  backgroundColor: active ? `${b.color}${OPACITY_15}` : 'transparent',
                  borderColor: active ? `${b.color}${OPACITY_30}` : 'var(--border)',
                  color: active ? b.color : 'var(--text-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {b.name}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Radar overlay */}
          <div className="flex items-center justify-center">
            {primaryBuild ? (
              <RadarChart
                data={primaryBuild.radarData}
                accent={primaryBuild.color}
                overlays={activeBuilds.slice(1).map(b => ({ data: b.radarData, color: b.color, label: b.name }))}
                size={200}
              />
            ) : (
              <div className="text-xs text-text-muted py-8">Select at least one build to compare</div>
            )}
          </div>

          {/* Stat table */}
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_repeat(3,60px)] gap-1 text-2xs font-mono font-bold text-text-muted mb-2">
              <span>Stat</span>
              {BUILD_PRESETS.map(b => (
                <span key={b.name} className="text-center" style={{ color: buildVisibility[b.name] ? b.color : 'var(--text-muted)', opacity: buildVisibility[b.name] ? 1 : 0.4 }}>
                  {b.name.slice(0, 3).toUpperCase()}
                </span>
              ))}
            </div>
            {BUILD_STATS.map(stat => (
              <div key={stat} className="grid grid-cols-[1fr_repeat(3,60px)] gap-1 text-xs font-mono py-1 border-t border-border/20">
                <span className="text-text-muted">{stat}</span>
                {BUILD_PRESETS.map(b => (
                  <span
                    key={b.name}
                    className="text-center font-bold"
                    style={{ color: buildVisibility[b.name] ? b.color : 'var(--text-muted)', opacity: buildVisibility[b.name] ? 1 : 0.3 }}
                  >
                    {b.stats[stat]}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.3  XP SOURCE BREAKDOWN                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden">
        <SectionLabel icon={BarChart3} label="XP Source Breakdown" color={ACCENT} />

        <div className="mt-4 space-y-3">
          {XP_SOURCES.map((src, i) => (
            <motion.div
              key={src.label}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="space-y-1"
            >
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text font-semibold">{src.label}</span>
                <span className="font-bold" style={{ color: src.color }}>{src.pct}%</span>
              </div>
              <div className="relative h-5 bg-surface-deep rounded-md overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${src.pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ backgroundColor: src.color, opacity: 0.7 }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${src.pct}%`, background: `linear-gradient(90deg, ${src.color}40, ${src.color}10)` }}
                />
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-2xs font-mono font-bold text-white/80 drop-shadow-sm">{src.label} - {src.pct}%</span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Combined stacked bar */}
          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="text-2xs font-mono text-text-muted mb-2 uppercase tracking-wider">Combined Distribution</div>
            <div className="flex h-6 rounded-lg overflow-hidden border border-border/30">
              {XP_SOURCES.map((src, i) => (
                <motion.div
                  key={src.label}
                  initial={{ width: 0 }} animate={{ width: `${src.pct}%` }} transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                  className="relative group/seg"
                  style={{ backgroundColor: src.color, opacity: 0.75 }}
                  title={`${src.label}: ${src.pct}%`}
                >
                  <div className="absolute inset-0 bg-white/0 group-hover/seg:bg-white/10 transition-colors" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/*  8.4  LEVEL-UP REWARD PREVIEW                                       */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-amber-500/8 transition-colors duration-1000" />
          <SectionLabel icon={Award} label="Level-Up Reward Preview" color={ACCENT} />

          <div className="relative mt-4 z-10 pl-4">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/50 via-amber-500/20 to-transparent" />

            <div className="space-y-3">
              {LEVEL_REWARDS.map((reward, i) => {
                const Icon = reward.icon;
                return (
                  <motion.div
                    key={reward.level}
                    initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-3 relative"
                  >
                    {/* Node on timeline */}
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center z-10 border-2 border-surface-deep shadow-lg"
                      style={{ backgroundColor: reward.color, boxShadow: `0 0 8px ${reward.color}60` }}
                    >
                      <Icon className="w-2.5 h-2.5 text-white" />
                    </div>

                    {/* Reward card */}
                    <div className="flex-1 flex items-center justify-between bg-surface/50 px-3 py-2 rounded-lg border border-border/40 hover:bg-surface-hover/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text">{reward.name}</span>
                        <span
                          className="text-2xs font-mono px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${reward.color}${OPACITY_10}`, color: reward.color, border: `1px solid ${reward.color}${OPACITY_20}` }}
                        >
                          {reward.type}
                        </span>
                      </div>
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                        style={{ color: reward.color, borderColor: `${reward.color}${OPACITY_20}`, backgroundColor: `${reward.color}${OPACITY_10}` }}
                      >
                        LV {reward.level}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </SurfaceCard>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/*  8.5  TIME-TO-LEVEL ESTIMATOR                                       */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <SurfaceCard level={2} className="p-5 relative overflow-hidden">
          <SectionLabel icon={Clock} label="Time-to-Level Estimator" color={ACCENT} />

          <div className="mt-4 flex items-center justify-center gap-6">
            {TTL_GAUGES.map(g => (
              <LiveMetricGauge key={g.label} metric={g} accent={ACCENT} size={90} />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border/40 space-y-3">
            <div className="text-2xs font-mono text-text-muted uppercase tracking-wider">Playstyle Comparison</div>
            {TTL_TIMELINES.map(t => (
              <div key={t.label} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-text">{t.label}</span>
                  <span className="font-bold" style={{ color: t.color }}>{t.daysToMax} days to max</span>
                </div>
                <div className="relative h-3 bg-surface-deep rounded-full overflow-hidden border border-border/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((145 / t.daysToMax) * (t.daysToMax / 145) * 100, 100)}%` }}
                    transition={{ duration: 1 }}
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ backgroundColor: t.color, opacity: 0.6 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.6  POWER CURVE DANGER ZONES                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <div className="flex items-center justify-between mb-3 relative z-10">
          <SectionLabel icon={AlertTriangle} label="Power Curve Danger Zones" color={STATUS_ERROR} />
          <div className="flex items-center gap-3">
            {ZONE_THRESHOLDS.map(z => (
              <div key={z.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: z.color, opacity: 0.6 }} />
                <span className="text-2xs font-mono text-text-muted">{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full h-[220px] bg-surface-deep/50 rounded-xl relative p-4 border border-border/40">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Zone backgrounds */}
            {/* Green zone (easy): player power > enemy * 1.3 */}
            {/* Yellow zone (balanced): within 30% */}
            {/* Red zone (hard): enemy > player * 1.3 */}
            {DANGER_ZONE_LEVELS.map((_, i) => {
              if (i >= DANGER_ZONE_LEVELS.length - 1) return null;
              const x1 = (i / (DANGER_ZONE_LEVELS.length - 1)) * 100;
              const x2 = ((i + 1) / (DANGER_ZONE_LEVELS.length - 1)) * 100;
              const ratio = PLAYER_POWER[i] / ENEMY_DIFFICULTY[i];
              const zoneColor = ratio > 1.3 ? STATUS_SUCCESS : ratio > 0.77 ? STATUS_WARNING : STATUS_ERROR;
              return (
                <rect key={i} x={x1} y={0} width={x2 - x1} height={100} fill={zoneColor} opacity={0.08} />
              );
            })}

            {/* Grid lines */}
            {[25, 50, 75].map(pct => (
              <line key={pct} x1="0" y1={pct} x2="100" y2={pct} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            ))}

            {/* Player power line */}
            <motion.polyline
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
              points={PLAYER_POWER.map((p, i) => `${(i / (PLAYER_POWER.length - 1)) * 100},${100 - (p / powerMax) * 100}`).join(' ')}
              fill="none" stroke={STATUS_SUCCESS} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 3px ${STATUS_SUCCESS})` }}
            />

            {/* Enemy difficulty line */}
            <motion.polyline
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }}
              points={ENEMY_DIFFICULTY.map((p, i) => `${(i / (ENEMY_DIFFICULTY.length - 1)) * 100},${100 - (p / powerMax) * 100}`).join(' ')}
              fill="none" stroke={STATUS_ERROR} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
              strokeDasharray="6 3"
              style={{ filter: `drop-shadow(0 0 3px ${STATUS_ERROR})` }}
            />

            {/* Data points */}
            {PLAYER_POWER.map((p, i) => (
              <circle
                key={`pp-${i}`}
                cx={`${(i / (PLAYER_POWER.length - 1)) * 100}`}
                cy={`${100 - (p / powerMax) * 100}`}
                r="3" fill={STATUS_SUCCESS} vectorEffect="non-scaling-stroke"
              >
                <title>Lv {i * 5}: Player Power {p}</title>
              </circle>
            ))}
            {ENEMY_DIFFICULTY.map((p, i) => (
              <circle
                key={`ed-${i}`}
                cx={`${(i / (ENEMY_DIFFICULTY.length - 1)) * 100}`}
                cy={`${100 - (p / powerMax) * 100}`}
                r="3" fill={STATUS_ERROR} vectorEffect="non-scaling-stroke"
              >
                <title>Lv {i * 5}: Enemy Difficulty {p}</title>
              </circle>
            ))}
          </svg>

          {/* Legend */}
          <div className="absolute top-2 right-4 flex items-center gap-4 text-2xs font-mono z-10">
            <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded" style={{ backgroundColor: STATUS_SUCCESS }} /> Player</span>
            <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded border-t border-dashed" style={{ borderColor: STATUS_ERROR, backgroundColor: STATUS_ERROR }} /> Enemy</span>
          </div>

          {/* X-axis */}
          <div className="absolute left-4 right-4 bottom-0 flex justify-between text-[9px] text-text-muted font-mono">
            {DANGER_ZONE_LEVELS.filter((_, i) => i % 2 === 0).map(lv => (
              <span key={lv}>Lv {lv}</span>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.7  DIMINISHING RETURNS VISUALIZER                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden">
        <SectionLabel icon={TrendingUp} label="Diminishing Returns Visualizer" color={ACCENT} />

        {/* Attribute selector */}
        <div className="flex items-center gap-2 mt-3 mb-4">
          {DR_ATTRIBUTES.map((attr, idx) => (
            <button
              key={attr.name}
              onClick={() => setSelectedDRAttr(idx)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
              style={{
                backgroundColor: selectedDRAttr === idx ? `${attr.color}${OPACITY_15}` : 'transparent',
                borderColor: selectedDRAttr === idx ? `${attr.color}${OPACITY_30}` : 'var(--border)',
                color: selectedDRAttr === idx ? attr.color : 'var(--text-muted)',
              }}
            >
              {attr.name}
            </button>
          ))}
        </div>

        {(() => {
          const attr = DR_ATTRIBUTES[selectedDRAttr];
          const maxMarginal = Math.max(...attr.curve.map(c => c.marginalValue));
          return (
            <div className="w-full h-[200px] bg-surface-deep/50 rounded-xl relative p-4 border border-border/40">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Soft cap marker */}
                {(() => {
                  const capX = (attr.softCap / 100) * 100;
                  return (
                    <>
                      <line x1={capX} y1="0" x2={capX} y2="100" stroke={attr.color} strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity={0.6} />
                      <text x={capX} y={8} textAnchor="middle" className="text-[8px] font-mono font-bold" fill={attr.color} vectorEffect="non-scaling-stroke">
                        Soft Cap
                      </text>
                    </>
                  );
                })()}

                {/* Curve */}
                <motion.polyline
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
                  points={attr.curve.map((c, i) => {
                    const x = (c.points / 100) * 100;
                    const y = 100 - (c.marginalValue / maxMarginal) * 90;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none" stroke={attr.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"
                  style={{ filter: `drop-shadow(0 0 3px ${attr.color})` }}
                />

                {/* Area under curve */}
                <motion.polygon
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                  points={[
                    ...attr.curve.map(c => `${(c.points / 100) * 100},${100 - (c.marginalValue / maxMarginal) * 90}`),
                    `${(attr.curve[attr.curve.length - 1].points / 100) * 100},100`,
                    `${(attr.curve[0].points / 100) * 100},100`,
                  ].join(' ')}
                  fill={`${attr.color}${OPACITY_10}`}
                />

                {/* Data points */}
                {attr.curve.map((c, i) => {
                  const x = (c.points / 100) * 100;
                  const y = 100 - (c.marginalValue / maxMarginal) * 90;
                  return (
                    <circle key={i} cx={x} cy={y} r="3" fill={attr.color} vectorEffect="non-scaling-stroke">
                      <title>{c.points} points: +{c.marginalValue.toFixed(1)} value per point</title>
                    </circle>
                  );
                })}
              </svg>

              {/* Y-axis */}
              <div className="absolute left-1 top-4 bottom-4 flex flex-col justify-between text-[9px] text-text-muted font-mono">
                <span>{maxMarginal.toFixed(1)}</span>
                <span>{(maxMarginal / 2).toFixed(1)}</span>
                <span>0</span>
              </div>

              {/* X-axis */}
              <div className="absolute left-4 right-4 bottom-0 flex justify-between text-[9px] text-text-muted font-mono">
                <span>10 pts</span>
                <span>50 pts</span>
                <span>100 pts</span>
              </div>

              {/* Info badge */}
              <div className="absolute top-2 right-4 text-2xs font-mono px-2 py-1 rounded border" style={{ color: attr.color, borderColor: `${attr.color}${OPACITY_20}`, backgroundColor: `${attr.color}${OPACITY_10}` }}>
                Soft Cap: {attr.softCap} pts
              </div>
            </div>
          );
        })()}
      </SurfaceCard>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  8.8  ACHIEVEMENT BOARD                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <SurfaceCard level={2} className="p-5 relative overflow-hidden">
        <SectionLabel icon={Trophy} label="Achievement Board" color={ACCENT} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {ACHIEVEMENT_CATEGORIES.map((cat, ci) => {
            const Icon = cat.icon;
            const completed = cat.achievements.filter(a => a.progress === 100).length;
            const total = cat.achievements.length;
            const catPct = Math.round(cat.achievements.reduce((s, a) => s + a.progress, 0) / cat.achievements.length);

            return (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.1 }}
                className="space-y-3"
              >
                {/* Category header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                    <span className="text-xs font-bold text-text">{cat.category}</span>
                  </div>
                  <span className="text-2xs font-mono font-bold" style={{ color: cat.color }}>{catPct}%</span>
                </div>

                {/* Category progress bar */}
                <div className="h-1.5 bg-surface-deep rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${catPct}%` }} transition={{ duration: 0.8, delay: ci * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>

                {/* Individual achievements */}
                <div className="space-y-2">
                  {cat.achievements.map((ach, ai) => (
                    <motion.div
                      key={ach.name}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ci * 0.1 + ai * 0.05 }}
                      className="flex items-center gap-2 group/ach"
                    >
                      {/* Progress ring */}
                      <div className="relative flex-shrink-0" style={{ width: 28, height: 28 }}>
                        <svg width={28} height={28} viewBox="0 0 28 28">
                          <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                          <circle
                            cx="14" cy="14" r="11" fill="none"
                            stroke={ach.progress === 100 ? STATUS_SUCCESS : cat.color}
                            strokeWidth="2.5"
                            strokeDasharray={`${2 * Math.PI * 11}`}
                            strokeDashoffset={`${2 * Math.PI * 11 * (1 - ach.progress / 100)}`}
                            strokeLinecap="round"
                            transform="rotate(-90 14 14)"
                            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                          />
                        </svg>
                        {ach.progress === 100 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Star className="w-2.5 h-2.5 text-amber-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-2xs font-bold text-text truncate group-hover/ach:text-amber-400 transition-colors">{ach.name}</div>
                        <div className="text-[9px] text-text-muted truncate">{ach.desc}</div>
                      </div>
                      <span className="text-2xs font-mono font-bold flex-shrink-0" style={{ color: ach.progress === 100 ? STATUS_SUCCESS : 'var(--text-muted)' }}>
                        {ach.progress}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/*  8.9  REST XP SYSTEM                                                */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-36 h-36 bg-blue-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-1000" />
          <SectionLabel icon={Zap} label="Rest XP System" color={ACCENT_CYAN} />

          <div className="mt-4 space-y-4 relative z-10">
            {/* Current XP bar with rest XP overlay */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-text">Current Level Progress</span>
                <span className="text-amber-400">{REST_XP_DATA.currentXP.toLocaleString()} / {REST_XP_DATA.nextLevelXP.toLocaleString()} XP</span>
              </div>
              <div className="relative h-6 bg-surface-deep rounded-lg overflow-hidden border border-border/30">
                {/* Base XP progress */}
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${(REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100}%` }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{ backgroundColor: ACCENT, opacity: 0.6 }}
                />
                {/* Rest XP overlay (blue) */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min((REST_XP_DATA.bankedXP / REST_XP_DATA.nextLevelXP) * 100, 100 - (REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100)}%`
                  }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="absolute inset-y-0 rounded-lg"
                  style={{
                    left: `${(REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100}%`,
                    backgroundColor: ACCENT_CYAN,
                    opacity: 0.4,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xs font-mono font-bold text-white/80 drop-shadow-sm">
                    {Math.round((REST_XP_DATA.currentXP / REST_XP_DATA.nextLevelXP) * 100)}%
                  </span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-1.5 text-2xs font-mono text-text-muted">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: ACCENT, opacity: 0.6 }} /> Earned XP</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: ACCENT_CYAN, opacity: 0.4 }} /> Rest XP</span>
              </div>
            </div>

            {/* Rest XP stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
                <div className="text-lg font-mono font-bold" style={{ color: ACCENT_CYAN }}>{REST_XP_DATA.bankedXP.toLocaleString()}</div>
                <div className="text-2xs text-text-muted mt-1">Banked XP</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
                <div className="text-lg font-mono font-bold" style={{ color: STATUS_WARNING }}>{REST_XP_DATA.multiplier}x</div>
                <div className="text-2xs text-text-muted mt-1">Multiplier</div>
              </div>
              <div className="bg-surface/50 rounded-lg p-3 border border-border/30 text-center">
                <div className="text-lg font-mono font-bold" style={{ color: STATUS_ERROR }}>~{REST_XP_DATA.estimatedKills}</div>
                <div className="text-2xs text-text-muted mt-1">Kills to Deplete</div>
              </div>
            </div>

            {/* Rest XP bank fill */}
            <div>
              <div className="flex justify-between text-2xs font-mono text-text-muted mb-1">
                <span>Rest XP Bank</span>
                <span>{REST_XP_DATA.bankedXP.toLocaleString()} / {REST_XP_DATA.maxBankedXP.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-surface-deep rounded-full overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${(REST_XP_DATA.bankedXP / REST_XP_DATA.maxBankedXP) * 100}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: ACCENT_CYAN }}
                />
              </div>
              <div className="text-[9px] text-text-muted mt-1 font-mono">Regen: +{REST_XP_DATA.regenRate} XP/hour offline</div>
            </div>
          </div>
        </SurfaceCard>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/*  8.10  PRESTIGE / NG+ PREVIEW                                       */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        <SurfaceCard level={2} className="p-5 relative overflow-hidden group">
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-violet-500/10 transition-colors duration-1000" />
          <SectionLabel icon={RotateCcw} label="Prestige / NG+ Preview" color={ACCENT_VIOLET} />

          <div className="mt-4 space-y-4 relative z-10">
            {/* Current prestige status */}
            <div className="flex items-center gap-3 bg-surface/50 rounded-lg p-3 border border-border/30">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
                <span className="text-xs font-bold text-text">Current Cycle</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {Array.from({ length: PRESTIGE_DATA.maxCycles }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: i < PRESTIGE_DATA.currentCycle ? ACCENT_VIOLET : 'var(--border)',
                      backgroundColor: i < PRESTIGE_DATA.currentCycle ? `${ACCENT_VIOLET}${OPACITY_30}` : 'transparent',
                    }}
                  >
                    {i < PRESTIGE_DATA.currentCycle && <Star className="w-2 h-2" style={{ color: ACCENT_VIOLET }} />}
                  </div>
                ))}
                <span className="text-xs font-mono font-bold" style={{ color: ACCENT_VIOLET }}>
                  {PRESTIGE_DATA.currentCycle}/{PRESTIGE_DATA.maxCycles}
                </span>
              </div>
            </div>

            {/* Carry-over items */}
            <div>
              <div className="text-2xs font-mono text-text-muted uppercase tracking-wider mb-2">Stat Carry-Over</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESTIGE_DATA.carryOverItems.map(item => (
                  <span
                    key={item}
                    className="text-2xs font-mono px-2 py-1 rounded border"
                    style={{ color: ACCENT_VIOLET, borderColor: `${ACCENT_VIOLET}${OPACITY_20}`, backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Prestige cycles table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-2xs font-mono">
                <thead>
                  <tr className="text-text-muted border-b border-border/40">
                    <th className="text-left py-1.5 pr-2">NG+</th>
                    <th className="text-center py-1.5 px-2">Stat Bonus</th>
                    <th className="text-center py-1.5 px-2">Difficulty</th>
                    <th className="text-center py-1.5 px-2">Est. Time</th>
                    <th className="text-left py-1.5 pl-2">New Ability</th>
                  </tr>
                </thead>
                <tbody>
                  {PRESTIGE_DATA.cycles.map((c, i) => (
                    <motion.tr
                      key={c.cycle}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      className="border-b border-border/20 hover:bg-surface-hover/30 transition-colors"
                    >
                      <td className="py-2 pr-2 font-bold" style={{ color: ACCENT_VIOLET }}>
                        <div className="flex items-center gap-1">
                          <RotateCcw className="w-2.5 h-2.5" /> {c.cycle}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-emerald-400 font-bold">{c.statBonus}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-red-400 font-bold">{c.diffMultiplier}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-text-muted">{c.estimatedTime}</td>
                      <td className="py-2 pl-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-2xs"
                          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}`, color: ACCENT_VIOLET }}
                        >
                          {c.newAbility}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ── Xp Curve Chart SVG ──────────────────────────────────────────────────────── */

function XpCurveChart({
  data, maxXp
}: {
  data: { level: number, xp: number }[];
  maxXp: number;
}) {
  const points = data.map((d, i) => {
    // x varies from 0 to 100% based on index 0 to data.length-1
    const x = i === 0 ? 0 : (i / (data.length - 1)) * 100;
    // y is inverted (100% is top, 0% is bottom), so it's 100 - (xp / max * 100)
    const y = 100 - (d.xp / maxXp) * 100;
    return `${x},${y}`;
  }).join(' ');

  // Create path command string for smooth curve
  const pathData = data.reduce((acc, point, i, a) => {
    const x = i === 0 ? 0 : (i / (a.length - 1)) * 100;
    const y = 100 - (point.xp / maxXp) * 100;

    if (i === 0) return `M ${x},${y}`;

    // Simple cubic bezier curve approximation
    const prevX = (i - 1) === 0 ? 0 : ((i - 1) / (a.length - 1)) * 100;
    const prevY = 100 - (a[i - 1].xp / maxXp) * 100;

    const cp1x = prevX + (x - prevX) * 0.5;
    const cp1y = prevY;
    const cp2x = prevX + (x - prevX) * 0.5;
    const cp2y = y;

    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
  }, '');

  return (
    <div className="w-full h-full relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-[10px] text-text-muted font-mono leading-none z-10">
        <span>{maxXp >= 1000 ? `${(maxXp / 1000).toFixed(1)}k` : maxXp}</span>
        <span>{maxXp >= 1000 ? `${(maxXp * 0.5 / 1000).toFixed(1)}k` : Math.floor(maxXp * 0.5)}</span>
        <span>0</span>
      </div>

      {/* Grid lines */}
      <div className="absolute left-14 right-2 top-2 bottom-6 flex flex-col justify-between pointer-events-none opacity-20 z-0">
        <div className="border-b border-dashed border-border w-full" />
        <div className="border-b border-dashed border-border w-full" />
        <div className="border-b border-solid border-border w-full" />
      </div>

      {/* SVG Canvas for the line path */}
      <div className="absolute left-14 right-2 top-2 bottom-6 z-10">
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.4" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow-curve" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Area under curve */}
          <motion.path
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
            d={`${pathData} L 100,100 L 0,100 Z`}
            fill="url(#areaGradient)"
            vectorEffect="non-scaling-stroke"
          />

          {/* Main animated curve line */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d={pathData}
            fill="none"
            stroke={ACCENT}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            style={{ filter: 'url(#glow-curve)' }}
          />

          {/* Data points */}
          {data.map((d, i) => {
            const x = i === 0 ? 0 : (i / (data.length - 1)) * 100;
            const y = 100 - (d.xp / maxXp) * 100;
            return (
              <motion.circle
                key={i}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + (i * 0.05), type: "spring" }}
                cx={`${x}%`} cy={`${y}%`}
                r="4"
                fill="var(--surface-deep)"
                stroke={ACCENT}
                strokeWidth="2"
                className="cursor-pointer transition-colors duration-200"
                vectorEffect="non-scaling-stroke"
              >
                <title>Level {d.level}: {d.xp.toLocaleString()} XP</title>
              </motion.circle>
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute left-14 right-2 bottom-0 flex justify-between text-[10px] text-text-muted font-mono leading-none pt-1 border-t border-border/40">
        {data.filter((_, i) => i % 2 === 0).map((d) => (
          <span key={d.level}>Lv {d.level}</span>
        ))}
      </div>
    </div>
  );
}
