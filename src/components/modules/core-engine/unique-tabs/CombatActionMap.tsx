'use client';

import { useMemo, useState, useCallback } from 'react';
import { Swords, Shield, Zap, ChevronDown, ChevronRight, ExternalLink, Play, Target, Gauge, Crosshair, Flame, BarChart3, Activity, GitBranch, Timer, TrendingUp, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MODULE_COLORS, STATUS_WARNING, STATUS_SUCCESS, STATUS_ERROR,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_PINK,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import {
  STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, LoadingSpinner,
  HeatmapGrid, LiveMetricGauge, TimelineStrip, SubTabNavigation, SubTab
} from './_shared';
import type { HeatmapCell, GaugeMetric, TimelineEvent } from '@/types/unique-tab-improvements';

const ACCENT = MODULE_COLORS.core;

/* ── Lane definitions ──────────────────────────────────────────────────── */

interface LaneConfig {
  id: string;
  label: string;
  icon: typeof Swords;
  color: string;
  featureNames: string[];
}

const LANES: LaneConfig[] = [
  {
    id: 'offensive',
    label: 'Offensive',
    icon: Swords,
    color: '#ef4444', // Red for offensive
    featureNames: ['Melee attack ability', 'Combo system', 'Dodge ability (GAS)'],
  },
  {
    id: 'pipeline',
    label: 'Damage Pipeline',
    icon: Zap,
    color: '#f59e0b', // Amber for pipeline
    featureNames: ['Hit detection', 'GAS damage application', 'Death flow'],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: Shield,
    color: '#3b82f6', // Blue for feedback
    featureNames: ['Hit reaction system', 'Combat feedback'],
  },
];

/* ── Flow arrows between features ──────────────────────────────────────── */

interface FlowArrow {
  from: string;
  to: string;
  label?: string;
}

const FLOW_ARROWS: FlowArrow[] = [
  { from: 'Melee attack ability', to: 'Combo system', label: 'chains' },
  { from: 'Melee attack ability', to: 'Hit detection', label: 'triggers' },
  { from: 'Combo system', to: 'Hit detection', label: 'per section' },
  { from: 'Hit detection', to: 'GAS damage application', label: 'on hit' },
  { from: 'GAS damage application', to: 'Hit reaction system', label: 'applies' },
  { from: 'GAS damage application', to: 'Combat feedback', label: 'triggers' },
  { from: 'GAS damage application', to: 'Death flow', label: 'HP <= 0' },
];

/* ── 4.1 Combat Event Sequence Diagram data ────────────────────────────── */

interface SequenceLane {
  id: string;
  label: string;
  color: string;
}

interface SequenceEvent {
  label: string;
  fromLane: string;
  toLane: string;
  color: string;
}

const SEQ_LANES: SequenceLane[] = [
  { id: 'player', label: 'Player', color: ACCENT_EMERALD },
  { id: 'anim', label: 'AnimSystem', color: ACCENT_CYAN },
  { id: 'gas', label: 'GAS', color: ACCENT_ORANGE },
  { id: 'feedback', label: 'FeedbackSystem', color: ACCENT_VIOLET },
];

const SEQ_EVENTS: SequenceEvent[] = [
  { label: 'InputPressed', fromLane: 'player', toLane: 'player', color: ACCENT_EMERALD },
  { label: 'AbilityActivated', fromLane: 'player', toLane: 'gas', color: ACCENT_ORANGE },
  { label: 'MontageStarted', fromLane: 'gas', toLane: 'anim', color: ACCENT_CYAN },
  { label: 'HitDetectionBegin', fromLane: 'anim', toLane: 'anim', color: ACCENT_CYAN },
  { label: 'DamageApplied', fromLane: 'anim', toLane: 'gas', color: ACCENT_ORANGE },
  { label: 'FeedbackTriggered', fromLane: 'gas', toLane: 'feedback', color: ACCENT_VIOLET },
];

/* ── 4.2 Hit Detection Debug data ──────────────────────────────────────── */

interface TraceFrame {
  cx: number;
  cy: number;
  r: number;
  hit: boolean;
}

const TRACE_FRAMES: TraceFrame[] = [
  { cx: 30, cy: 80, r: 12, hit: false },
  { cx: 55, cy: 60, r: 14, hit: false },
  { cx: 85, cy: 42, r: 15, hit: true },
  { cx: 115, cy: 35, r: 14, hit: true },
  { cx: 145, cy: 40, r: 12, hit: false },
];

const HIT_STATS = [
  { label: 'Hit Rate', value: '67%', color: ACCENT_EMERALD },
  { label: 'Avg Hits/Swing', value: '2.3', color: ACCENT_CYAN },
  { label: 'Trace Coverage', value: '85%', color: ACCENT_ORANGE },
];

/* ── 4.3 Feedback Intensity Tuner data ─────────────────────────────────── */

interface FeedbackParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

const FEEDBACK_PARAMS: FeedbackParam[] = [
  { id: 'shakeScale', label: 'ShakeScale', min: 0, max: 2, step: 0.05, defaultValue: 0.8, unit: 'x' },
  { id: 'hitstopDuration', label: 'HitstopDuration', min: 0, max: 0.2, step: 0.005, defaultValue: 0.05, unit: 's' },
  { id: 'vfxScale', label: 'VFXScale', min: 0, max: 3, step: 0.1, defaultValue: 1.5, unit: 'x' },
  { id: 'sfxVolume', label: 'SFXVolume', min: 0, max: 1, step: 0.05, defaultValue: 0.7, unit: '' },
  { id: 'screenFlashAlpha', label: 'ScreenFlashAlpha', min: 0, max: 0.5, step: 0.01, defaultValue: 0.15, unit: '' },
];

interface FeedbackPreset {
  name: string;
  values: Record<string, number>;
  color: string;
}

const FEEDBACK_PRESETS: FeedbackPreset[] = [
  { name: 'Subtle', values: { shakeScale: 0.3, hitstopDuration: 0.02, vfxScale: 0.8, sfxVolume: 0.4, screenFlashAlpha: 0.05 }, color: ACCENT_CYAN },
  { name: 'Normal', values: { shakeScale: 0.8, hitstopDuration: 0.05, vfxScale: 1.5, sfxVolume: 0.7, screenFlashAlpha: 0.15 }, color: ACCENT_EMERALD },
  { name: 'Juicy', values: { shakeScale: 1.6, hitstopDuration: 0.12, vfxScale: 2.5, sfxVolume: 0.95, screenFlashAlpha: 0.35 }, color: ACCENT_ORANGE },
];

/* ── 4.4 Projectile Trajectory data ────────────────────────────────────── */

interface ProjectilePath {
  label: string;
  color: string;
  speed: number;
  flightTime: string;
  maxRange: string;
  points: { x: number; y: number }[];
}

const PROJECTILE_PATHS: ProjectilePath[] = [
  {
    label: 'Straight',
    color: '#3b82f6',
    speed: 2000,
    flightTime: '0.5s',
    maxRange: '1000u',
    points: [
      { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 }, { x: 130, y: 50 }, { x: 180, y: 50 },
    ],
  },
  {
    label: 'Arced',
    color: ACCENT_ORANGE,
    speed: 1200,
    flightTime: '1.2s',
    maxRange: '800u',
    points: [
      { x: 10, y: 80 }, { x: 50, y: 45 }, { x: 90, y: 25 }, { x: 130, y: 30 }, { x: 180, y: 80 },
    ],
  },
  {
    label: 'Homing',
    color: ACCENT_VIOLET,
    speed: 800,
    flightTime: '1.8s',
    maxRange: '1200u',
    points: [
      { x: 10, y: 80 }, { x: 40, y: 70 }, { x: 80, y: 55 }, { x: 130, y: 30 }, { x: 180, y: 25 },
    ],
  },
];

/* ── 4.5 DPS Calculator data ───────────────────────────────────────────── */

interface DPSStrategy {
  name: string;
  dps: number;
  time: string;
  color: string;
}

const DPS_STRATEGIES: DPSStrategy[] = [
  { name: 'SingleAttackSpam', dps: 180, time: 'Infinite', color: '#64748b' },
  { name: 'Full3HitCombo', dps: 245, time: '1.55s', color: ACCENT_CYAN },
  { name: 'CancelIntoAbility', dps: 310, time: '1.2s', color: ACCENT_EMERALD },
];

const DPS_MAX = 310;

// Cumulative damage over 5 seconds at each DPS rate
const CUMULATIVE_POINTS = [0, 1, 2, 3, 4, 5];

/* ── 4.6 Damage Type Effectiveness data ────────────────────────────────── */

const DMG_TYPES = ['Physical', 'Fire', 'Ice', 'Lightning'];
const ARMOR_TYPES = ['Light', 'Medium', 'Heavy', 'Magical'];

const EFFECTIVENESS_DATA: HeatmapCell[] = [
  // Physical row (0)
  { row: 0, col: 0, value: 0.8, label: '1.2', tooltip: 'Physical vs Light: 1.2x (effective)' },
  { row: 0, col: 1, value: 0.6, label: '1.0', tooltip: 'Physical vs Medium: 1.0x (neutral)' },
  { row: 0, col: 2, value: 0.2, label: '0.5', tooltip: 'Physical vs Heavy: 0.5x (resisted)' },
  { row: 0, col: 3, value: 0.4, label: '0.8', tooltip: 'Physical vs Magical: 0.8x (slightly resisted)' },
  // Fire row (1)
  { row: 1, col: 0, value: 1.0, label: '1.5', tooltip: 'Fire vs Light: 1.5x (very effective)' },
  { row: 1, col: 1, value: 0.7, label: '1.1', tooltip: 'Fire vs Medium: 1.1x (slightly effective)' },
  { row: 1, col: 2, value: 0.5, label: '0.9', tooltip: 'Fire vs Heavy: 0.9x (slightly resisted)' },
  { row: 1, col: 3, value: 0.25, label: '0.7', tooltip: 'Fire vs Magical: 0.7x (resisted)' },
  // Ice row (2)
  { row: 2, col: 0, value: 0.5, label: '0.9', tooltip: 'Ice vs Light: 0.9x (slightly resisted)' },
  { row: 2, col: 1, value: 0.85, label: '1.3', tooltip: 'Ice vs Medium: 1.3x (effective)' },
  { row: 2, col: 2, value: 0.7, label: '1.1', tooltip: 'Ice vs Heavy: 1.1x (slightly effective)' },
  { row: 2, col: 3, value: 0.6, label: '1.0', tooltip: 'Ice vs Magical: 1.0x (neutral)' },
  // Lightning row (3)
  { row: 3, col: 0, value: 0.6, label: '1.0', tooltip: 'Lightning vs Light: 1.0x (neutral)' },
  { row: 3, col: 1, value: 0.5, label: '0.9', tooltip: 'Lightning vs Medium: 0.9x (slightly resisted)' },
  { row: 3, col: 2, value: 0.3, label: '0.6', tooltip: 'Lightning vs Heavy: 0.6x (resisted)' },
  { row: 3, col: 3, value: 1.0, label: '1.5', tooltip: 'Lightning vs Magical: 1.5x (very effective)' },
];

/* ── 4.7 Combat Flow Sankey data ───────────────────────────────────────── */

interface SankeyColumn {
  label: string;
  items: { id: string; label: string; pct: number; color: string }[];
}

const SANKEY_COLUMNS: SankeyColumn[] = [
  {
    label: 'Input',
    items: [
      { id: 'light', label: 'LightAttack', pct: 60, color: ACCENT_CYAN },
      { id: 'heavy', label: 'HeavyAttack', pct: 25, color: ACCENT_ORANGE },
      { id: 'dodge', label: 'Dodge', pct: 15, color: ACCENT_EMERALD },
    ],
  },
  {
    label: 'Result',
    items: [
      { id: 'hit', label: 'Hit', pct: 70, color: ACCENT_EMERALD },
      { id: 'miss', label: 'Miss', pct: 20, color: '#64748b' },
      { id: 'blocked', label: 'Blocked', pct: 10, color: ACCENT_ORANGE },
    ],
  },
  {
    label: 'Outcome',
    items: [
      { id: 'damage', label: 'Damage', pct: 55, color: ACCENT_EMERALD },
      { id: 'stagger', label: 'Stagger', pct: 15, color: ACCENT_VIOLET },
      { id: 'kill', label: 'Kill', pct: 5, color: STATUS_ERROR },
      { id: 'noDmg', label: 'NoDamage', pct: 25, color: '#64748b' },
    ],
  },
];

// Flow connections between sankey columns
interface SankeyFlow {
  from: string;
  to: string;
  value: number; // percent of total
  color: string;
}

const SANKEY_FLOWS: SankeyFlow[] = [
  // Input -> Result
  { from: 'light', to: 'hit', value: 45, color: ACCENT_CYAN },
  { from: 'light', to: 'miss', value: 10, color: '#64748b' },
  { from: 'light', to: 'blocked', value: 5, color: ACCENT_ORANGE },
  { from: 'heavy', to: 'hit', value: 18, color: ACCENT_ORANGE },
  { from: 'heavy', to: 'miss', value: 5, color: '#64748b' },
  { from: 'heavy', to: 'blocked', value: 2, color: ACCENT_ORANGE },
  { from: 'dodge', to: 'hit', value: 7, color: ACCENT_EMERALD },
  { from: 'dodge', to: 'miss', value: 5, color: '#64748b' },
  { from: 'dodge', to: 'blocked', value: 3, color: ACCENT_ORANGE },
  // Result -> Outcome
  { from: 'hit', to: 'damage', value: 45, color: ACCENT_EMERALD },
  { from: 'hit', to: 'stagger', value: 15, color: ACCENT_VIOLET },
  { from: 'hit', to: 'kill', value: 5, color: STATUS_ERROR },
  { from: 'hit', to: 'noDmg', value: 5, color: '#64748b' },
  { from: 'miss', to: 'noDmg', value: 15, color: '#64748b' },
  { from: 'miss', to: 'damage', value: 5, color: ACCENT_EMERALD },
  { from: 'blocked', to: 'damage', value: 5, color: ACCENT_EMERALD },
  { from: 'blocked', to: 'noDmg', value: 5, color: '#64748b' },
];

/* ── 4.8 Hitstop Timing data ──────────────────────────────────────────── */

interface HitstopAbility {
  name: string;
  hitstop: number;
  animDuration: number;
  color: string;
}

const HITSTOP_ABILITIES: HitstopAbility[] = [
  { name: 'LightAttack1', hitstop: 0.03, animDuration: 0.4, color: ACCENT_CYAN },
  { name: 'LightAttack2', hitstop: 0.04, animDuration: 0.5, color: ACCENT_CYAN },
  { name: 'LightAttack3', hitstop: 0.06, animDuration: 0.6, color: ACCENT_ORANGE },
  { name: 'HeavyAttack', hitstop: 0.10, animDuration: 0.9, color: ACCENT_VIOLET },
  { name: 'Slam', hitstop: 0.15, animDuration: 1.2, color: STATUS_ERROR },
];

const MAX_HITSTOP = 0.15;

/* ── 4.9 Combat Metrics data ──────────────────────────────────────────── */

interface KPICard {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  barPct?: number;
  barColor?: string;
}

const KPI_CARDS: KPICard[] = [
  { label: 'Total Damage Dealt', value: '12,450', trend: '+15%', trendColor: ACCENT_EMERALD },
  { label: 'Crit Rate', value: '18%', barPct: 18, barColor: ACCENT_ORANGE },
  { label: 'Dodge Success', value: '85%', barPct: 85, barColor: ACCENT_CYAN },
  { label: 'Avg Combo Length', value: '2.3', barPct: 46, barColor: ACCENT_VIOLET },
];

const HIT_ACCURACY_GAUGE: GaugeMetric = {
  label: 'Hit Accuracy',
  current: 73,
  target: 100,
  unit: '%',
  trend: 'up',
};

interface PieSlice {
  label: string;
  pct: number;
  color: string;
}

const ABILITY_USAGE: PieSlice[] = [
  { label: 'MeleeAttack', pct: 45, color: ACCENT_ORANGE },
  { label: 'Dodge', pct: 25, color: ACCENT_CYAN },
  { label: 'Fireball', pct: 20, color: STATUS_ERROR },
  { label: 'Other', pct: 10, color: '#64748b' },
];

/* ── 4.10 Stagger & Status Effect data ─────────────────────────────────── */

const STAGGER_CONFIG = {
  currentStagger: 67,
  threshold: 100,
  decayRate: 5,
};

const STAGGER_PIPELINE_STEPS = ['Hits Accumulate', 'Threshold Reached', 'Stun Triggered', 'Recovery'];

const STAGGER_TIMELINE: TimelineEvent[] = [
  { id: 'st1', timestamp: 0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st2', timestamp: 1.2, label: '+20', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st3', timestamp: 2.5, label: '-5 decay', category: 'decay', color: '#64748b', duration: 1.0 },
  { id: 'st4', timestamp: 3.8, label: '+25', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st5', timestamp: 5.0, label: '+15', category: 'hit', color: ACCENT_ORANGE, duration: 0.3 },
  { id: 'st6', timestamp: 6.2, label: '-5 decay', category: 'decay', color: '#64748b', duration: 1.0 },
  { id: 'st7', timestamp: 7.5, label: 'STUN', category: 'stun', color: STATUS_ERROR, duration: 1.5 },
  { id: 'st8', timestamp: 9.0, label: 'Recovery', category: 'recovery', color: ACCENT_EMERALD, duration: 1.0 },
];

/* ── Component ─────────────────────────────────────────────────────────── */

interface CombatActionMapProps {
  moduleId: SubModuleId;
}

export function CombatActionMap({ moduleId }: CombatActionMapProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [activeTab, setActiveTab] = useState('flow');
  const [expanded, setExpanded] = useState<string | null>(null);

  const tabs: SubTab[] = useMemo(() => [
    { id: 'flow', label: 'Flow & Sequences', icon: GitBranch },
    { id: 'hits', label: 'Analysis & Hits', icon: Crosshair },
    { id: 'feedback', label: 'Polish & Tuner', icon: Gauge },
    { id: 'metrics', label: 'Combat Metrics', icon: Activity },
  ], []);

  const [feedbackValues, setFeedbackValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const p of FEEDBACK_PARAMS) defaults[p.id] = p.defaultValue;
    return defaults;
  });

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0, partial = 0, missing = 0;
    for (const d of defs) {
      const status = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (status === 'implemented' || status === 'improved') implemented++;
      else if (status === 'partial') partial++;
      else if (status === 'missing') missing++;
    }
    return { total, implemented, partial, missing };
  }, [defs, featureMap]);

  const toggleExpand = useCallback((name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  }, []);

  const juiceLevel = useMemo(() => {
    let total = 0;
    for (const p of FEEDBACK_PARAMS) {
      const norm = (feedbackValues[p.id] - p.min) / (p.max - p.min);
      total += norm;
    }
    return total / FEEDBACK_PARAMS.length;
  }, [feedbackValues]);

  const applyPreset = useCallback((preset: FeedbackPreset) => {
    setFeedbackValues({ ...preset.values });
  }, []);

  const updateFeedbackParam = useCallback((id: string, value: number) => {
    setFeedbackValues(prev => ({ ...prev, [id]: value }));
  }, []);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={Swords} title="Combat Action Map" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
      </div>

      <div className="mt-2.5 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'flow' && (
            <motion.div key="flow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <SurfaceCard level={2} className="p-3.5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
                <SectionLabel icon={Zap} label="Execution Flow" />
                <div className="mt-3 relative z-10"><PipelineFlow steps={['Attack', 'Combo', 'Hit Detect', 'Damage', 'Reaction', 'Feedback']} accent={ACCENT} /></div>
              </SurfaceCard>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <div className="space-y-2.5">
                  <SectionLabel icon={Swords} label="Combat Lanes" />
                  <div className="space-y-2.5">
                    {LANES.map(lane => (
                      <LaneSection key={lane.id} lane={lane} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={toggleExpand} arrows={FLOW_ARROWS} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <ComboChainDiagram status={featureMap.get('Combo system')?.status ?? 'unknown'} />
                  <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                    <SectionLabel icon={GitBranch} label="Combat Event Sequence" />
                    <div className="mt-3 overflow-x-auto custom-scrollbar">
                      <svg width="400" height="200" viewBox="0 0 400 200" className="overflow-visible">
                        {SEQ_LANES.map((lane, i) => {
                          const x = 60 + i * 100;
                          return (
                            <g key={lane.id}>
                              <line x1={x} y1={30} x2={x} y2={240} stroke={lane.color} strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
                              <rect x={x - 38} y={4} width="76" height="22" rx="4" fill={`${lane.color}20`} stroke={lane.color} strokeWidth="1" />
                              <text x={x} y={18} textAnchor="middle" className="text-[9px] font-mono font-bold" fill={lane.color}>{lane.label}</text>
                            </g>
                          );
                        })}
                        {SEQ_EVENTS.map((evt, i) => {
                          const y = 50 + i * 34;
                          const fromIdx = SEQ_LANES.findIndex(l => l.id === evt.fromLane);
                          const toIdx = SEQ_LANES.findIndex(l => l.id === evt.toLane);
                          const fromX = 60 + fromIdx * 100;
                          const toX = 60 + toIdx * 100;
                          const isSelf = fromIdx === toIdx;

                          return (
                            <g key={evt.label + i}>
                              {isSelf ? (
                                <>
                                  <circle cx={fromX} cy={y} r="4" fill={evt.color} opacity="0.8" />
                                  <text x={fromX + 10} y={y + 3} className="text-[8px] font-mono" fill={evt.color}>{evt.label}</text>
                                </>
                              ) : (
                                <>
                                  <line x1={fromX} y1={y} x2={toX} y2={y} stroke={evt.color} strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                                  <circle cx={fromX} cy={y} r="3" fill={evt.color} />
                                  <polygon points={`${toX - 6},${y - 3} ${toX},${y} ${toX - 6},${y + 3}`} fill={evt.color} />
                                  <text x={(fromX + toX) / 2} y={y - 6} textAnchor="middle" className="text-[8px] font-mono" fill={evt.color}>{evt.label}</text>
                                </>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'hits' && (
            <motion.div key="hits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <SectionLabel icon={Crosshair} label="Hit Detection Debug" />
                  <div className="mt-3 flex gap-2.5 flex-wrap items-start">
                    <svg width="160" height="100" viewBox="0 0 160 100" className="overflow-visible flex-shrink-0">
                      <path d="M 20,100 Q 50,20 90,15 Q 130,10 160,30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="28" strokeLinecap="round" />
                      {TRACE_FRAMES.map((frame, i) => (
                        <g key={i}>
                          <circle cx={frame.cx} cy={frame.cy} r={frame.r} fill={frame.hit ? `${STATUS_ERROR}30` : 'rgba(255,255,255,0.05)'} stroke={frame.hit ? STATUS_ERROR : '#64748b'} strokeWidth="1.5" strokeDasharray={frame.hit ? 'none' : '3 2'} />
                          {frame.hit && <circle cx={frame.cx} cy={frame.cy} r={frame.r + 3} fill="none" stroke={STATUS_ERROR} strokeWidth="0.5" opacity="0.4" />}
                          <text x={frame.cx} y={frame.cy + 3} textAnchor="middle" className="text-[7px] font-mono" fill={frame.hit ? STATUS_ERROR : '#64748b'}>
                            {frame.hit ? 'HIT' : 'MISS'}
                          </text>
                        </g>
                      ))}
                      <path d={`M ${TRACE_FRAMES[0].cx},${TRACE_FRAMES[0].cy} ${TRACE_FRAMES.slice(1).map(f => `L ${f.cx},${f.cy}`).join(' ')}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 3" />
                    </svg>
                    <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
                      {HIT_STATS.map((stat) => (
                        <div key={stat.label} className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface/50">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
                          <span className="text-2xs font-mono text-text-muted flex-shrink-0">{stat.label}</span>
                          <span className="text-xs font-mono font-bold ml-auto" style={{ color: stat.color }}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <SectionLabel icon={Flame} label="Damage Type Effectiveness" />
                  <div className="mt-3">
                    <HeatmapGrid rows={DMG_TYPES} cols={ARMOR_TYPES} cells={EFFECTIVENESS_DATA} lowColor="#7f1d1d" highColor="#065f46" accent={ACCENT} />
                    <div className="flex items-center gap-2.5 mt-2 text-[9px] font-mono text-text-muted">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#065f46' }} /> Effective</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#374151' }} /> Neutral</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#7f1d1d' }} /> Resisted</span>
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <SectionLabel icon={Target} label="Projectile Trajectory Planner" />
                  <div className="mt-3">
                    <svg width="180" height="80" viewBox="0 0 180 80" className="w-full overflow-visible" preserveAspectRatio="xMidYMid meet">
                      <line x1="5" y1="90" x2="195" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <circle cx="180" cy="25" r="6" fill="none" stroke={STATUS_ERROR} strokeWidth="1" opacity="0.5" />
                      <circle cx="180" cy="25" r="3" fill={`${STATUS_ERROR}50`} />
                      <text x="180" y="18" textAnchor="middle" className="text-[7px] font-mono" fill={STATUS_ERROR}>TARGET</text>
                      {PROJECTILE_PATHS.map((path) => {
                        const d = `M ${path.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                        return (
                          <g key={path.label}>
                            <path d={d} fill="none" stroke={path.color} strokeWidth="1.5" opacity="0.7" />
                            {path.points.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r="2" fill={path.color} opacity={i === 0 || i === path.points.length - 1 ? 1 : 0.4} />
                            ))}
                          </g>
                        );
                      })}
                    </svg>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {PROJECTILE_PATHS.map((path) => (
                        <div key={path.label} className="px-2 py-1.5 rounded bg-surface/50 border border-border/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: path.color }} />
                            <span className="text-2xs font-mono font-bold" style={{ color: path.color }}>{path.label}</span>
                          </div>
                          <div className="text-[9px] font-mono text-text-muted space-y-0.5">
                            <div>Speed: {path.speed} u/s</div>
                            <div>Flight: {path.flightTime}</div>
                            <div>Range: {path.maxRange}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'feedback' && (
            <motion.div key="feedback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel icon={Gauge} label="Feedback Intensity Tuner" />
                    <div className="flex gap-1.5">
                      {FEEDBACK_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPreset(preset)}
                          className="text-2xs font-mono font-bold px-2 py-0.5 rounded border transition-colors hover:brightness-125"
                          style={{ color: preset.color, borderColor: `${preset.color}40`, backgroundColor: `${preset.color}10` }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {FEEDBACK_PARAMS.map((param) => {
                      const val = feedbackValues[param.id];
                      const pct = ((val - param.min) / (param.max - param.min)) * 100;
                      return (
                        <div key={param.id} className="flex items-center gap-3">
                          <span className="text-2xs font-mono text-text-muted w-[120px] flex-shrink-0 truncate">{param.label}</span>
                          <div className="flex-1 relative">
                            <div className="h-1.5 rounded-full bg-surface-deep overflow-hidden">
                              <motion.div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ACCENT }} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                            </div>
                            <input type="range" min={param.min} max={param.max} step={param.step} value={val} onChange={(e) => updateFeedbackParam(param.id, parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                          </div>
                          <span className="text-2xs font-mono font-bold w-[50px] text-right" style={{ color: ACCENT }}>
                            {val.toFixed(param.step < 0.01 ? 3 : 2)}{param.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="flex items-center gap-3">
                      <span className="text-2xs font-mono font-bold text-text-muted uppercase tracking-wider">Juice Level</span>
                      <div className="flex-1 h-3 rounded-full bg-surface-deep overflow-hidden shadow-inner">
                        <motion.div className="h-full rounded-full" style={{ width: `${juiceLevel * 100}%`, backgroundColor: juiceLevel < 0.33 ? ACCENT_CYAN : juiceLevel < 0.66 ? ACCENT_EMERALD : ACCENT_ORANGE }} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: juiceLevel < 0.33 ? ACCENT_CYAN : juiceLevel < 0.66 ? ACCENT_EMERALD : ACCENT_ORANGE }}>
                        {(juiceLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </SurfaceCard>
                
                <div className="space-y-2.5">
                  <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                    <SectionLabel icon={Timer} label="Hitstop Timing Configurations" />
                    <div className="mt-3 space-y-2">
                      {HITSTOP_ABILITIES.map((ability, idx) => (
                        <motion.div key={ability.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3">
                          <span className="text-2xs font-mono text-text-muted w-[100px] flex-shrink-0">{ability.name}</span>
                          <div className="flex-1 h-2 rounded-full border border-border/20 bg-surface-deep relative">
                            <div className="absolute top-0 bottom-0 left-0 bg-surface-hover border-r border-border/50" style={{ width: `${(ability.animDuration / 1.5) * 100}%` }} />
                            <div className="absolute top-0 bottom-0 left-0 animate-pulse" style={{ width: `${(ability.hitstop / MAX_HITSTOP) * 30}%`, left: '10%', backgroundColor: ability.color, boxShadow: `0 0 8px ${ability.color}80` }} />
                          </div>
                          <span className="text-xs font-mono font-bold w-[45px] text-right" style={{ color: ability.color }}>{ability.hitstop}s</span>
                        </motion.div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                    <SectionLabel icon={TrendingUp} label="Stagger Pipeline" />
                    <div className="mt-3">
                      <TimelineStrip events={STAGGER_TIMELINE} accent={STATUS_ERROR} />
                      <div className="flex justify-between mt-3 text-2xs font-mono text-text-muted">
                        <span>Threshold: {STAGGER_CONFIG.threshold}</span>
                        <span>Decay: {STAGGER_CONFIG.decayRate}/s</span>
                      </div>
                    </div>
                  </SurfaceCard>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'metrics' && (
            <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-2.5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                  <SectionLabel icon={BarChart3} label="DPS Calculator" />
                  <div className="mt-3 space-y-1.5">
                    {DPS_STRATEGIES.map((strat, idx) => (
                      <motion.div key={strat.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors">
                        <span className="text-2xs font-mono text-text w-[130px] flex-shrink-0 truncate">{strat.name}</span>
                        <span className="text-2xs font-mono text-text-muted w-[50px] flex-shrink-0">{strat.time}</span>
                        <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden shadow-inner">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(strat.dps / DPS_MAX) * 100}%` }} transition={{ delay: idx * 0.1 + 0.2, duration: 0.5 }} className="h-full rounded-full" style={{ backgroundColor: strat.color }} />
                        </div>
                        <span className="text-xs font-mono font-bold w-[55px] text-right" style={{ color: strat.color }}>{strat.dps} DPS</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <span className="text-2xs font-mono text-text-muted uppercase tracking-wider">Cumulative Damage (5s)</span>
                    <svg width="100%" height="60" viewBox="0 0 260 60" className="mt-2 overflow-visible" preserveAspectRatio="xMidYMid meet">
                      {[0, 20, 40, 60].map(y => <line key={y} x1="30" y1={y + 5} x2="255" y2={y + 5} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
                      {CUMULATIVE_POINTS.map((t) => <text key={t} x={30 + t * 45} y="78" textAnchor="middle" className="text-[7px] font-mono" fill="rgba(255,255,255,0.3)">{t}s</text>)}
                      {DPS_STRATEGIES.map((strat) => {
                        const maxDmg = DPS_MAX * 5;
                        const pts = CUMULATIVE_POINTS.map(t => ({ x: 30 + t * 45, y: 65 - ((strat.dps * t) / maxDmg) * 60 }));
                        const d = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
                        return (
                          <g key={strat.name}>
                            <path d={d} fill="none" stroke={strat.color} strokeWidth="1.5" opacity="0.8" />
                            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2" fill={strat.color} />)}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </SurfaceCard>

                <div className="space-y-2.5">
                  <SurfaceCard level={2} className="p-3 relative overflow-hidden">
                    <SectionLabel icon={Activity} label="Combat Flow Sankey" />
                    <div className="mt-3 flex justify-between relative h-[150px]">
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                        {SANKEY_FLOWS.map((flow, i) => {
                          const colWidth = 100 / (SANKEY_COLUMNS.length - 1);
                          const fromColIdx = SANKEY_COLUMNS.findIndex(c => c.items.some(it => it.id === flow.from));
                          const toColIdx = SANKEY_COLUMNS.findIndex(c => c.items.some(it => it.id === flow.to));
                          if (fromColIdx === -1 || toColIdx === -1) return null;
                          const fromItemIdx = SANKEY_COLUMNS[fromColIdx].items.findIndex(it => it.id === flow.from);
                          const toItemIdx = SANKEY_COLUMNS[toColIdx].items.findIndex(it => it.id === flow.to);
                          const x1 = `${fromColIdx * colWidth + 5}%`;
                          const x2 = `${toColIdx * colWidth - 5}%`;
                          const y1 = `${(fromItemIdx + 0.5) * (100 / SANKEY_COLUMNS[fromColIdx].items.length)}%`;
                          const y2 = `${(toItemIdx + 0.5) * (100 / SANKEY_COLUMNS[toColIdx].items.length)}%`;
                          return (
                            <path key={i} d={`M ${x1} ${y1} C ${fromColIdx * colWidth + 25}% ${y1}, ${toColIdx * colWidth - 25}% ${y2}, ${x2} ${y2}`} fill="none" stroke={flow.color} strokeWidth={Math.max(1, (flow.value / 100) * 20)} strokeOpacity="0.15" />
                          );
                        })}
                      </svg>
                      {SANKEY_COLUMNS.map((col, cIdx) => (
                        <div key={col.label} className="flex flex-col h-full justify-between" style={{ zIndex: 1, width: '25%' }}>
                          <span className="text-2xs font-mono font-bold text-text-muted text-center mb-2">{col.label}</span>
                          {col.items.map((item) => (
                            <div key={item.id} className="flex-1 flex flex-col justify-center items-center py-1 relative">
                              <div className="w-full rounded border py-1.5 px-1 relative overflow-hidden backdrop-blur-sm" style={{ borderColor: `${item.color}40`, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                <div className="absolute inset-0 opacity-20" style={{ backgroundColor: item.color }} />
                                <div className="text-[10px] font-mono leading-tight text-center text-text shadow-sm truncate relative z-10">{item.label}</div>
                                <div className="text-[8px] font-mono font-bold text-center mt-0.5 relative z-10" style={{ color: item.color }}>{item.pct}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </SurfaceCard>

                  <div className="grid grid-cols-2 gap-2.5">
                    {KPI_CARDS.map((kpi, idx) => (
                      <SurfaceCard key={idx} level={3} className="p-3">
                        <span className="text-2xs font-mono text-text-muted">{kpi.label}</span>
                        <div className="mt-1 flex items-end justify-between">
                          <span className="text-lg font-mono font-bold text-text-strong">{kpi.value}</span>
                          {kpi.trend && <span className="text-xs font-mono font-bold" style={{ color: kpi.trendColor }}>{kpi.trend}</span>}
                        </div>
                        {kpi.barPct !== undefined && kpi.barColor && (
                          <div className="mt-2 h-1 bg-surface-deep rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${kpi.barPct}%`, backgroundColor: kpi.barColor }} />
                          </div>
                        )}
                      </SurfaceCard>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Lane section ──────────────────────────────────────────────────────── */

function LaneSection({
  lane,
  featureMap,
  defs,
  expanded,
  onToggle,
}: {
  lane: LaneConfig;
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
  arrows: FlowArrow[];
}) {
  const LaneIcon = lane.icon;

  return (
    <div className="relative">
      <div className="absolute -left-1 top-0 bottom-0 w-1 rounded-l opacity-50" style={{ backgroundColor: lane.color }} />

      <div className="pl-3 py-1">
        <div className="flex items-center gap-2 mb-2">
          <LaneIcon className="w-3.5 h-3.5" style={{ color: lane.color }} />
          <span className="text-xs font-bold uppercase tracking-widest text-text">{lane.label}</span>
        </div>

        <div className="space-y-0.5">
          {lane.featureNames.map((name) => {
            const row = featureMap.get(name);
            const def = defs.find((d) => d.featureName === name);
            const status: FeatureStatus = row?.status ?? 'unknown';
            const sc = STATUS_COLORS[status];
            const isExpanded = expanded === name;

            return (
              <div key={name}>
                <button
                  onClick={() => onToggle(name)}
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/50 transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color }} />
                  <span className="text-xs font-medium text-text w-[180px] flex-shrink-0 truncate">{name}</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.dot }}>{sc.label}</span>
                  {row?.qualityScore != null && (
                    <span className="text-2xs font-mono text-emerald-400 bg-emerald-400/10 px-1 rounded-sm border border-emerald-400/20 flex-shrink-0">
                      Q{row.qualityScore}
                    </span>
                  )}
                  {row?.filePaths && row.filePaths.length > 0 && (
                    <span className="text-2xs text-text-muted flex-shrink-0">{row.filePaths.length} files</span>
                  )}
                  <span className="ml-auto flex-shrink-0">
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-text-muted" />
                      : <ChevronRight className="w-3 h-3 text-text-muted" />}
                  </span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-8 pb-2 space-y-2">
                        <p className="text-2xs text-text-muted leading-relaxed">
                          {def?.description ?? row?.description ?? 'No description'}
                        </p>
                        {row?.filePaths && row.filePaths.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {row.filePaths.slice(0, 3).map((fp) => (
                              <span key={fp} className="flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
                                <ExternalLink className="w-2.5 h-2.5" />
                                {fp.split('/').pop()}
                              </span>
                            ))}
                          </div>
                        )}
                        {row?.nextSteps && (
                          <p className="text-2xs border-l-2 pl-2" style={{ borderColor: STATUS_WARNING, color: STATUS_WARNING }}>
                            <span className="font-semibold opacity-70 mr-1">Next:</span>{row.nextSteps}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Combo chain diagram ───────────────────────────────────────────────── */

function ComboChainDiagram({ status }: { status: FeatureStatus }) {
  const sc = STATUS_COLORS[status];

  const sections = [
    { name: 'Attack 1', timing: '0.0s - 0.4s', window: 'Combo Window', pct: 60 },
    { name: 'Attack 2', timing: '0.0s - 0.5s', window: 'Combo Window', pct: 70 },
    { name: 'Attack 3', timing: '0.0s - 0.6s', window: 'Finisher', pct: 85 },
  ];

  return (
    <SurfaceCard level={2} className="p-3 relative overflow-hidden">
      <div className="flex items-center gap-2.5 mb-3">
        <Play className="w-4 h-4 text-red-400" />
        <span className="text-sm font-bold text-text">Combo Chain Analysis</span>
        <span className="text-2xs px-2 py-0.5 rounded-md ml-auto" style={{ backgroundColor: sc.bg, color: sc.dot }}>
          {sc.label}
        </span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-2 py-1 text-2xs font-bold uppercase tracking-wider text-text-muted border-b border-border/40">
        <span className="w-[100px] flex-shrink-0">Attack</span>
        <span className="w-[100px] flex-shrink-0">Timing</span>
        <span className="w-[100px] flex-shrink-0">Window</span>
        <span className="flex-1">Progress</span>
      </div>

      {/* Table rows */}
      <div className="space-y-0.5">
        {sections.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-hover/30 transition-colors"
          >
            <span className="text-xs font-medium text-text w-[100px] flex-shrink-0">{s.name}</span>
            <span className="text-2xs font-mono text-text-muted w-[100px] flex-shrink-0">{s.timing}</span>
            <span
              className="text-2xs font-medium w-[100px] flex-shrink-0"
              style={{ color: i === 2 ? '#ef4444' : ACCENT }}
            >
              {s.window}
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface-deep overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ delay: i * 0.15 + 0.2, duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: i === 2 ? '#ef444480' : `${ACCENT}80` }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </SurfaceCard>
  );
}

/* ── 4.7 Combat Flow Sankey (sub-component) ────────────────────────────── */

function CombatFlowSankey() {
  const totalHeight = 180;
  const colWidth = 100;
  const colGap = 60;
  const svgWidth = SANKEY_COLUMNS.length * colWidth + (SANKEY_COLUMNS.length - 1) * colGap;
  const barWidth = 16;
  const padding = 8;

  // Calculate Y positions for each item in each column
  const colPositions = useMemo(() => {
    return SANKEY_COLUMNS.map((col) => {
      const items: { id: string; y: number; height: number; color: string; label: string; pct: number }[] = [];
      let currentY = 10;
      const usableHeight = totalHeight - 20;
      for (const item of col.items) {
        const h = Math.max((item.pct / 100) * usableHeight, 12);
        items.push({ id: item.id, y: currentY, height: h, color: item.color, label: item.label, pct: item.pct });
        currentY += h + padding;
      }
      return items;
    });
  }, []);

  // Build flow path lookup
  const getItemPos = (id: string) => {
    for (let ci = 0; ci < colPositions.length; ci++) {
      const item = colPositions[ci].find(it => it.id === id);
      if (item) return { colIdx: ci, ...item };
    }
    return null;
  };

  return (
    <svg width={svgWidth} height={totalHeight + 20} viewBox={`0 0 ${svgWidth} ${totalHeight + 20}`} className="overflow-visible">
      {/* Column labels */}
      {SANKEY_COLUMNS.map((col, ci) => (
        <text key={col.label} x={ci * (colWidth + colGap) + barWidth / 2} y={totalHeight + 16} textAnchor="middle" className="text-[9px] font-mono font-bold" fill="rgba(255,255,255,0.4)">
          {col.label}
        </text>
      ))}

      {/* Flow paths (draw first so bars are on top) */}
      {SANKEY_FLOWS.map((flow, i) => {
        const from = getItemPos(flow.from);
        const to = getItemPos(flow.to);
        if (!from || !to) return null;

        const fromX = from.colIdx * (colWidth + colGap) + barWidth;
        const toX = to.colIdx * (colWidth + colGap);
        const fromY = from.y + from.height / 2;
        const toY = to.y + to.height / 2;
        const thickness = Math.max((flow.value / 100) * 30, 1.5);
        const midX = (fromX + toX) / 2;

        return (
          <path
            key={i}
            d={`M ${fromX},${fromY} C ${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
            fill="none"
            stroke={flow.color}
            strokeWidth={thickness}
            opacity="0.25"
          />
        );
      })}

      {/* Column bars */}
      {colPositions.map((items, ci) => (
        <g key={ci}>
          {items.map((item) => (
            <g key={item.id}>
              <rect
                x={ci * (colWidth + colGap)}
                y={item.y}
                width={barWidth}
                height={item.height}
                rx="3"
                fill={item.color}
                opacity="0.7"
              />
              <text
                x={ci * (colWidth + colGap) + barWidth + 4}
                y={item.y + item.height / 2 + 3}
                className="text-[8px] font-mono"
                fill={item.color}
              >
                {item.label} ({item.pct}%)
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ── 4.9 Ability Pie Chart (sub-component) ─────────────────────────────── */

function AbilityPieChart({ slices, size = 80 }: { slices: PieSlice[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  let cumulativePct = 0;
  const arcs = slices.map((slice) => {
    const startAngle = (cumulativePct / 100) * 2 * Math.PI - Math.PI / 2;
    cumulativePct += slice.pct;
    const endAngle = (cumulativePct / 100) * 2 * Math.PI - Math.PI / 2;
    const largeArc = slice.pct > 50 ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    return {
      ...slice,
      d: `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((arc) => (
        <path key={arc.label} d={arc.d} fill={arc.color} opacity="0.7" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--surface-card, #1a1a2e)" />
      <text x={cx} y={cy + 3} textAnchor="middle" className="text-[8px] font-mono font-bold" fill="rgba(255,255,255,0.5)">Usage</text>
    </svg>
  );
}
