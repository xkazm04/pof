'use client';

import { useMemo, useState, useCallback } from 'react';
import { TrendingUp, Award, Settings2, Target, FastForward, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN,
  OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, FeatureGrid, LoadingSpinner } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

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
