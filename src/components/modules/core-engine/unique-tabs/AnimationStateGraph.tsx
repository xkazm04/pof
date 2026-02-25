'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Activity, Play, AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { STATUS_COLORS, TabHeader, PipelineFlow, SectionLabel, FeatureCard, LoadingSpinner, HeatmapGrid, LiveMetricGauge, TimelineStrip } from './_shared';
import type { SubModuleId } from '@/types/modules';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';
import type { HeatmapCell, GaugeMetric, TimelineEvent } from '@/types/unique-tab-improvements';

const ACCENT = ACCENT_VIOLET;

/* ── State machine nodes ───────────────────────────────────────────────────── */

interface StateNode {
  name: string;
  featureName: string;
  ref: string;
  transitions: { to: string; label: string }[];
}

type StateGroup = 'Movement' | 'Combat' | 'Reaction';

interface StateGroupDef {
  group: StateGroup;
  states: string[];
}

const STATE_GROUPS: StateGroupDef[] = [
  { group: 'Movement', states: ['Locomotion', 'Dodging'] },
  { group: 'Combat', states: ['Attacking'] },
  { group: 'Reaction', states: ['HitReact', 'Death'] },
];

const STATE_NODES: StateNode[] = [
  {
    name: 'Locomotion',
    featureName: 'Locomotion Blend Space',
    ref: 'BS_Locomotion1D',
    transitions: [
      { to: 'Attacking', label: 'Input.Attack' },
      { to: 'Dodging', label: 'Input.Dodge' },
    ],
  },
  {
    name: 'Attacking',
    featureName: 'Attack montages',
    ref: 'AM_Melee_Combo',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
      { to: 'HitReact', label: 'State.Hit' },
    ],
  },
  {
    name: 'Dodging',
    featureName: 'Root motion toggle',
    ref: 'AM_Dodge',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
    ],
  },
  {
    name: 'HitReact',
    featureName: 'Animation state machine',
    ref: 'AM_HitReact',
    transitions: [
      { to: 'Locomotion', label: 'Recover' },
      { to: 'Death', label: 'HP <= 0' },
    ],
  },
  {
    name: 'Death',
    featureName: 'Animation state machine',
    ref: 'AM_Death',
    transitions: [],
  },
];

/* ── Montage notify windows ────────────────────────────────────────────────── */

interface NotifyWindow {
  name: string;
  color: string;
  start: number;
  width: number;
}

interface ComboSection {
  label: string;
  duration: string;
  windows: NotifyWindow[];
}

const COMBO_SECTIONS: ComboSection[] = [
  {
    label: 'Montage 1',
    duration: '0.45s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.55, width: 0.3 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.2, width: 0.25 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.2, width: 0.15 },
    ],
  },
  {
    label: 'Montage 2',
    duration: '0.50s',
    windows: [
      { name: 'ComboWindow', color: ACCENT_CYAN, start: 0.5, width: 0.35 },
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.18, width: 0.28 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.18, width: 0.15 },
    ],
  },
  {
    label: 'Montage 3',
    duration: '0.60s',
    windows: [
      { name: 'HitDetection', color: STATUS_ERROR, start: 0.15, width: 0.35 },
      { name: 'SpawnVFX', color: STATUS_WARNING, start: 0.15, width: 0.2 },
    ],
  },
];

/* ── Combo definitions ─────────────────────────────────────────────────────── */

interface ComboDef {
  id: string;
  label: string;
  sectionIds: number[];
}

const COMBO_DEFS: ComboDef[] = [
  { id: 'basic', label: 'Basic 3-Hit', sectionIds: [0, 1, 2] },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

const ASSET_FEATURES = [
  'UARPGAnimInstance',
  'Locomotion Blend Space',
  'Attack montages',
  'Anim Notify classes',
  'Motion Warping',
  'Mixamo import & retarget pipeline',
  'Asset automation commandlet',
];

/* ── 2.1 State Transition Heatmap data ────────────────────────────────────── */

const HEATMAP_STATE_NAMES = ['Locomotion', 'Attacking', 'Dodging', 'HitReact', 'Death'];

const HEATMAP_CELLS: HeatmapCell[] = [
  { row: 0, col: 1, value: 0.85, label: '.85', tooltip: 'Locomotion \u2192 Attacking: 85%' },
  { row: 0, col: 2, value: 0.6, label: '.60', tooltip: 'Locomotion \u2192 Dodging: 60%' },
  { row: 1, col: 0, value: 0.9, label: '.90', tooltip: 'Attacking \u2192 Locomotion: 90%' },
  { row: 1, col: 3, value: 0.3, label: '.30', tooltip: 'Attacking \u2192 HitReact: 30%' },
  { row: 2, col: 0, value: 0.95, label: '.95', tooltip: 'Dodging \u2192 Locomotion: 95%' },
  { row: 3, col: 0, value: 0.7, label: '.70', tooltip: 'HitReact \u2192 Locomotion: 70%' },
  { row: 3, col: 4, value: 0.05, label: '.05', tooltip: 'HitReact \u2192 Death: 5%' },
];

/* ── 2.2 Montage Frame Scrubber data ─────────────────────────────────────── */

interface NotifyLane {
  name: string;
  color: string;
  startFrame: number;
  endFrame: number;
}

const SCRUBBER_LANES: NotifyLane[] = [
  { name: 'HitDetection', color: STATUS_ERROR, startFrame: 6, endFrame: 14 },
  { name: 'ComboWindow', color: ACCENT_CYAN, startFrame: 16, endFrame: 24 },
  { name: 'SpawnVFX', color: STATUS_WARNING, startFrame: 6, endFrame: 10 },
  { name: 'Sound', color: STATUS_INFO, startFrame: 3, endFrame: 5 },
];

const SCRUBBER_TOTAL_FRAMES = 30;

/* ── 2.3 Blend Space Visualizer data ─────────────────────────────────────── */

interface BlendClip {
  name: string;
  x: number; // Direction: -180..180
  y: number; // Speed: 0..1
}

const BLEND_CLIPS: BlendClip[] = [
  { name: 'Idle', x: 0, y: 0 },
  { name: 'WalkFwd', x: 0, y: 0.3 },
  { name: 'RunFwd', x: 0, y: 0.7 },
  { name: 'WalkLeft', x: -90, y: 0.3 },
  { name: 'WalkRight', x: 90, y: 0.3 },
  { name: 'WalkBack', x: 180, y: 0.3 },
];

const BLEND_CURRENT = { x: 15, y: 0.5 };

/* ── 2.4 Animation Budget Tracker data ───────────────────────────────────── */

const BUDGET_GAUGES: GaugeMetric[] = [
  { label: 'Montage Slots', current: 2, target: 4, unit: '' },
  { label: 'Blend Depth', current: 3, target: 8, unit: '' },
  { label: 'Active IK', current: 1, target: 4, unit: '' },
  { label: 'Bone Count', current: 65, target: 120, unit: '' },
];

/* ── 2.5 Combo Chain Graph Editor data ───────────────────────────────────── */

interface ComboNode {
  id: string;
  name: string;
  montage: string;
  damage: number;
  x: number;
  y: number;
}

const COMBO_CHAIN_NODES: ComboNode[] = [
  { id: 'atk1', name: 'Light Slash', montage: 'AM_Combo1', damage: 25, x: 50, y: 60 },
  { id: 'atk2', name: 'Cross Cut', montage: 'AM_Combo2', damage: 35, x: 200, y: 60 },
  { id: 'atk3', name: 'Heavy Finisher', montage: 'AM_Combo3', damage: 60, x: 350, y: 60 },
];

const COMBO_CHAIN_EDGES = [
  { from: 'atk1', to: 'atk2', window: '0.4-0.6s' },
  { from: 'atk2', to: 'atk3', window: '0.35-0.55s' },
];

/* ── 2.6 Root Motion Trajectory data ─────────────────────────────────────── */

interface TrajectoryPath {
  name: string;
  color: string;
  points: { x: number; y: number }[];
  distance: string;
}

const ROOT_MOTION_PATHS: TrajectoryPath[] = [
  {
    name: 'LightAttack',
    color: STATUS_INFO,
    points: [{ x: 75, y: 130 }, { x: 75, y: 115 }, { x: 75, y: 100 }, { x: 75, y: 90 }],
    distance: '40 cm',
  },
  {
    name: 'HeavyAttack',
    color: STATUS_ERROR,
    points: [{ x: 75, y: 130 }, { x: 76, y: 110 }, { x: 77, y: 85 }, { x: 78, y: 60 }, { x: 78, y: 45 }],
    distance: '85 cm',
  },
  {
    name: 'Dodge',
    color: ACCENT_EMERALD,
    points: [{ x: 75, y: 130 }, { x: 72, y: 135 }, { x: 68, y: 140 }, { x: 62, y: 142 }, { x: 55, y: 140 }],
    distance: '55 cm',
  },
];

/* ── 2.7 Animation Retarget Pipeline data ────────────────────────────────── */

interface RetargetStep {
  name: string;
  status: 'green' | 'amber' | 'red';
  detail: string;
}

const RETARGET_PIPELINE_STEPS: RetargetStep[] = [
  { name: 'Import', status: 'green', detail: 'Mixamo FBX files imported. 24 animations loaded.' },
  { name: 'Strip', status: 'green', detail: 'Bone prefix "mixamorig:" stripped from all bones.' },
  { name: 'Retarget', status: 'amber', detail: 'IK Retargeter shows minor foot drift on RunFwd. Acceptable for now.' },
  { name: 'RootMotion', status: 'green', detail: 'Root motion extracted and validated for all locomotion clips.' },
  { name: 'Commandlet', status: 'green', detail: 'Asset automation ran successfully. All assets cooked.' },
];

const RETARGET_STATUS_COLORS: Record<string, string> = {
  green: STATUS_SUCCESS,
  amber: STATUS_WARNING,
  red: STATUS_ERROR,
};

/* ── 2.8 Notify Coverage data ────────────────────────────────────────────── */

interface NotifyCoverageIssue {
  montage: string;
  message: string;
  severity: 'error' | 'warning';
}

interface MontageCoverage {
  montage: string;
  coverage: number; // 0-1
}

const NOTIFY_ISSUES: NotifyCoverageIssue[] = [
  { montage: 'AM_HeavyAttack', message: 'Missing HitDetection notify', severity: 'error' },
  { montage: 'AM_Dodge', message: 'No sound notify', severity: 'warning' },
  { montage: 'AM_Combo3', message: 'ComboWindow has no follow-up', severity: 'warning' },
  { montage: 'AM_Death', message: 'No VFX notify', severity: 'warning' },
];

const MONTAGE_COVERAGES: MontageCoverage[] = [
  { montage: 'AM_Combo1', coverage: 1.0 },
  { montage: 'AM_Combo2', coverage: 1.0 },
  { montage: 'AM_Combo3', coverage: 0.6 },
  { montage: 'AM_HeavyAttack', coverage: 0.3 },
  { montage: 'AM_Dodge', coverage: 0.5 },
  { montage: 'AM_Death', coverage: 0.4 },
];

/* ── 2.9 State Duration Statistics data ──────────────────────────────────── */

interface BoxWhiskerData {
  state: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  hasOutlier?: boolean;
  isInfinite?: boolean;
}

const STATE_DURATIONS: BoxWhiskerData[] = [
  { state: 'Locomotion', min: 0.5, q1: 2.0, median: 5.0, q3: 10.0, max: 30.0 },
  { state: 'Attacking', min: 0.3, q1: 0.4, median: 0.5, q3: 0.6, max: 1.2 },
  { state: 'Dodging', min: 0.2, q1: 0.3, median: 0.3, q3: 0.35, max: 0.4 },
  { state: 'HitReact', min: 0.1, q1: 0.2, median: 0.3, q3: 0.5, max: 5.0, hasOutlier: true },
  { state: 'Death', min: 0, q1: 0, median: 0, q3: 0, max: 0, isInfinite: true },
];

const DURATION_SCALE_MAX = 32; // seconds, for normalization

/* ── 2.10 Animation Event Timeline data ──────────────────────────────────── */

const ANIMATION_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 'evt1', timestamp: 0.0, label: 'Locomotion', category: 'state', color: STATUS_INFO, duration: 2.5 },
  { id: 'evt2', timestamp: 2.5, label: 'Enter Attack', category: 'state', color: STATUS_INFO },
  { id: 'evt3', timestamp: 2.5, label: 'AM_Combo1', category: 'montage', color: STATUS_WARNING, duration: 0.45 },
  { id: 'evt4', timestamp: 2.7, label: 'HitDetect', category: 'notify', color: ACCENT_EMERALD, duration: 0.15 },
  { id: 'evt5', timestamp: 2.85, label: 'ComboWindow', category: 'notify', color: ACCENT_EMERALD, duration: 0.2 },
  { id: 'evt6', timestamp: 2.95, label: 'AM_Combo2', category: 'montage', color: STATUS_WARNING, duration: 0.5 },
  { id: 'evt7', timestamp: 3.2, label: 'HitDetect', category: 'notify', color: ACCENT_EMERALD, duration: 0.18 },
  { id: 'evt8', timestamp: 3.45, label: 'Return Loco', category: 'state', color: STATUS_INFO },
  { id: 'evt9', timestamp: 5.0, label: 'HitReact', category: 'state', color: STATUS_INFO, duration: 0.3 },
  { id: 'evt10', timestamp: 5.3, label: 'Recover', category: 'state', color: STATUS_INFO },
];

/* ── Component ─────────────────────────────────────────────────────────────── */

interface AnimationStateGraphProps {
  moduleId: SubModuleId;
}

export function AnimationStateGraph({ moduleId }: AnimationStateGraphProps) {
  const { features, isLoading } = useFeatureMatrix(moduleId);
  const defs = useMemo(() => MODULE_FEATURE_DEFINITIONS[moduleId] ?? [], [moduleId]);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [activeCombo, setActiveCombo] = useState(COMBO_DEFS[0].id);
  const [scrubberFrame, setScrubberFrame] = useState(0);
  const [scrubberPlaying, setScrubberPlaying] = useState(false);
  const scrubberRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedRetargetStep, setExpandedRetargetStep] = useState<string | null>(null);

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  const stateNodeMap = useMemo(() => {
    const map = new Map<string, StateNode>();
    for (const n of STATE_NODES) map.set(n.name, n);
    return map;
  }, []);

  const activeSections = useMemo(() => {
    const combo = COMBO_DEFS.find((c) => c.id === activeCombo) ?? COMBO_DEFS[0];
    return combo.sectionIds.map((idx) => COMBO_SECTIONS[idx]).filter(Boolean);
  }, [activeCombo]);

  const stats = useMemo(() => {
    const total = defs.length;
    let implemented = 0;
    for (const d of defs) {
      const s = featureMap.get(d.featureName)?.status ?? 'unknown';
      if (s === 'implemented' || s === 'improved') implemented++;
    }
    return { total, implemented };
  }, [defs, featureMap]);

  const toggleAsset = useCallback((name: string) => {
    setExpandedAsset((prev) => (prev === name ? null : name));
  }, []);

  /* Scrubber auto-play */
  useEffect(() => {
    if (scrubberPlaying) {
      scrubberRef.current = setInterval(() => {
        setScrubberFrame((f) => {
          if (f >= SCRUBBER_TOTAL_FRAMES) { setScrubberPlaying(false); return 0; }
          return f + 1;
        });
      }, 80);
    }
    return () => { if (scrubberRef.current) clearInterval(scrubberRef.current); };
  }, [scrubberPlaying]);

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <TabHeader icon={Activity} title="Animation State Graph" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* State machine */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-violet-500/10 transition-colors duration-700" />

        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2 relative z-10">
          <Activity className="w-4 h-4 text-violet-400" /> AnimBP State Machine
        </div>

        <div className="flex gap-6 mb-5 relative z-10">
          {STATE_GROUPS.map((group) => (
            <div key={group.group} className="flex-1 min-w-0">
              <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">{group.group}</div>
              <div className="space-y-1">
                {group.states.map((stateName) => {
                  const node = stateNodeMap.get(stateName);
                  if (!node) return null;
                  const status: FeatureStatus = featureMap.get(node.featureName)?.status ?? 'unknown';
                  const sc = STATUS_COLORS[status];
                  return (
                    <div key={node.name} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface-hover transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.dot }} />
                      <span className="text-xs font-medium text-text flex-1 min-w-0 truncate">{node.name}</span>
                      <span className="text-2xs font-mono text-text-muted">{node.ref}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Transition labels */}
        <div className="space-y-1.5 relative z-10 bg-surface-deep/30 p-3 rounded-xl border border-border/40">
          <div className="text-2xs text-text-muted font-bold uppercase tracking-wider mb-2">Transitions Matrix</div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
            {STATE_NODES.flatMap((node) =>
              node.transitions.map((t, i) => (
                <motion.div
                  key={`${node.name}->${t.to}`}
                  initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 text-xs bg-surface/50 px-2 py-1.5 rounded"
                >
                  <span className="font-mono font-medium text-text px-1" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>{node.name}</span>
                  <span className="text-text-muted opacity-50">&rarr;</span>
                  <span className="font-mono font-medium text-text px-1 bg-surface-hover rounded">{t.to}</span>
                  <span className="text-text-muted ml-auto italic opacity-80 text-[10px]">{t.label}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Montage timeline */}
      <SurfaceCard level={2} className="p-4 overflow-hidden relative group">
        <div className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-text/50" /> Combo Montage Timeline Data
        </div>

        {/* Combo selector (only when multiple combos) */}
        {COMBO_DEFS.length > 1 && (
          <div className="flex items-center gap-1 mb-3 border-b border-border/40 pb-2">
            {COMBO_DEFS.map((combo) => (
              <button
                key={combo.id}
                onClick={() => setActiveCombo(combo.id)}
                className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                  activeCombo === combo.id
                    ? 'text-text border-b-2'
                    : 'text-text-muted hover:text-text'
                }`}
                style={activeCombo === combo.id ? { borderColor: ACCENT } : undefined}
              >
                {combo.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-2">
          {activeSections.map((section, i) => (
            <div key={section.label} className="flex items-center gap-2 flex-1">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.2 }}
                className="flex-1"
              >
                <div
                  className="rounded-xl border px-3 py-2 mb-2 relative overflow-hidden"
                  style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}10` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <div className="flex justify-between items-center relative z-10">
                    <div className="text-sm font-bold text-text">{section.label}</div>
                    <div className="text-xs font-mono font-semibold" style={{ color: ACCENT }}>{section.duration}</div>
                  </div>
                </div>

                {/* Notify windows */}
                <div className="space-y-1.5">
                  {section.windows.map((w, wi) => (
                    <div key={w.name} className="relative h-4 rounded overflow-hidden bg-surface-deep shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${w.width * 100}%` }}
                        transition={{ delay: (i * 0.2) + (wi * 0.1) + 0.3, duration: 0.5, type: 'spring' }}
                        className="absolute top-0 h-full rounded shadow-sm"
                        style={{
                          left: `${w.start * 100}%`,
                          backgroundColor: `${w.color}50`,
                          borderLeft: `2px solid ${w.color}`,
                          boxShadow: `0 0 8px ${w.color}40`,
                        }}
                        title={w.name}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>

              {i < activeSections.length - 1 && (
                <div className="hidden md:flex flex-col items-center flex-shrink-0 w-8">
                  <div className="w-full h-[2px] bg-border relative overflow-hidden rounded-full">
                    <motion.div
                      className="absolute inset-y-0 left-0 w-full bg-text-muted/50"
                      initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-5 text-xs font-medium text-text-muted flex-wrap border-t border-border/40 pt-3">
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${ACCENT_CYAN}80`, color: ACCENT_CYAN }} />
            ComboWindow
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_ERROR}80`, color: STATUS_ERROR }} />
            HitDetection
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 rounded shadow-[0_0_5px_currentColor]" style={{ backgroundColor: `${STATUS_WARNING}80`, color: STATUS_WARNING }} />
            SpawnVFX
          </span>
        </div>
      </SurfaceCard>

      {/* Asset list */}
      <div className="space-y-2 pt-2">
        <div className="px-1"><SectionLabel label="Anim Architecture Modules" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ASSET_FEATURES.map((name, i) => (
            <motion.div key={name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FeatureCard name={name} featureMap={featureMap} defs={defs} expanded={expandedAsset} onToggle={toggleAsset} accent={ACCENT} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pipeline footer */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.02)] to-transparent" />
        <SectionLabel label="Retarget Pipeline" />
        <div className="mt-3 relative z-10">
          <PipelineFlow steps={['Mixamo FBX', 'Bone Prefix Strip', 'IK Retargeter', 'Root Motion Extract', 'Commandlet']} accent={ACCENT} />
        </div>
      </SurfaceCard>

      {/* ── 2.1 State Transition Heatmap ──────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="State Transition Heatmap" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Normalized transition frequency between animation states. Brighter cells indicate more frequent transitions.
        </p>
        <div className="relative z-10">
          <HeatmapGrid
            rows={HEATMAP_STATE_NAMES}
            cols={HEATMAP_STATE_NAMES}
            cells={HEATMAP_CELLS}
            accent={ACCENT}
          />
        </div>
      </SurfaceCard>

      {/* ── 2.2 Montage Frame Scrubber ────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Montage Frame Scrubber" />
        <div className="relative z-10 mt-3">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => {
                if (scrubberPlaying) { setScrubberPlaying(false); }
                else { if (scrubberFrame >= SCRUBBER_TOTAL_FRAMES) setScrubberFrame(0); setScrubberPlaying(true); }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{ backgroundColor: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}
            >
              <Play className="w-3 h-3" />
              {scrubberPlaying ? 'Pause' : 'Play'}
            </button>
            <span className="text-xs font-mono text-text">
              Frame <span className="font-bold" style={{ color: ACCENT }}>{scrubberFrame}</span>
              <span className="text-text-muted"> / {SCRUBBER_TOTAL_FRAMES}</span>
            </span>
          </div>

          {/* Scrubber bar */}
          <div className="relative mb-4">
            <input
              type="range"
              min={0}
              max={SCRUBBER_TOTAL_FRAMES}
              value={scrubberFrame}
              onChange={(e) => { setScrubberFrame(Number(e.target.value)); setScrubberPlaying(false); }}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: ACCENT, background: `linear-gradient(to right, ${ACCENT}40 ${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%, rgba(255,255,255,0.05) ${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%)` }}
            />
          </div>

          {/* Notify lanes */}
          <div className="space-y-1.5">
            {SCRUBBER_LANES.map((lane) => (
              <div key={lane.name} className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-text-muted w-20 truncate">{lane.name}</span>
                <div className="flex-1 relative h-5 rounded bg-surface-deep">
                  <div
                    className="absolute top-0 h-full rounded opacity-70"
                    style={{
                      left: `${(lane.startFrame / SCRUBBER_TOTAL_FRAMES) * 100}%`,
                      width: `${((lane.endFrame - lane.startFrame) / SCRUBBER_TOTAL_FRAMES) * 100}%`,
                      backgroundColor: `${lane.color}60`,
                      borderLeft: `2px solid ${lane.color}`,
                    }}
                  />
                  {/* Current frame marker */}
                  <div
                    className="absolute top-0 w-[2px] h-full bg-white/60 z-10"
                    style={{ left: `${(scrubberFrame / SCRUBBER_TOTAL_FRAMES) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── 2.3 Blend Space Visualizer ────────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Blend Space Visualizer" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          2D blend space mapping Direction vs Speed. Each dot is an animation clip; the pulsing dot shows the current sampled position.
        </p>
        <div className="relative z-10 flex justify-center">
          <svg width={320} height={240} viewBox="0 0 320 240" className="overflow-visible">
            {/* Grid */}
            <rect x={40} y={10} width={260} height={200} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Grid lines - horizontal */}
            {[0.25, 0.5, 0.75].map((t) => {
              const yy = 210 - t * 200;
              return <line key={t} x1={40} y1={yy} x2={300} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
            })}
            {/* Grid lines - vertical */}
            {[-90, 0, 90].map((deg) => {
              const xx = 40 + ((deg + 180) / 360) * 260;
              return <line key={deg} x1={xx} y1={10} x2={xx} y2={210} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
            })}
            {/* Axis labels */}
            <text x={170} y={232} textAnchor="middle" className="text-[9px] font-mono fill-[var(--text-muted)]">Direction (deg)</text>
            <text x={12} y={110} textAnchor="middle" className="text-[9px] font-mono fill-[var(--text-muted)]" transform="rotate(-90 12 110)">Speed</text>
            {/* Tick labels - X axis */}
            {[-180, -90, 0, 90, 180].map((deg) => {
              const xx = 40 + ((deg + 180) / 360) * 260;
              return <text key={deg} x={xx} y={223} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">{deg}</text>;
            })}
            {/* Tick labels - Y axis */}
            {[0, 0.5, 1].map((v) => {
              const yy = 210 - v * 200;
              return <text key={v} x={36} y={yy + 3} textAnchor="end" className="text-[8px] font-mono fill-[var(--text-muted)]">{v}</text>;
            })}
            {/* Animation clip dots */}
            {BLEND_CLIPS.map((clip) => {
              const cx = 40 + ((clip.x + 180) / 360) * 260;
              const cy = 210 - clip.y * 200;
              return (
                <g key={clip.name}>
                  <circle cx={cx} cy={cy} r={6} fill={`${ACCENT}40`} stroke={ACCENT} strokeWidth="1.5" />
                  <text x={cx} y={cy - 10} textAnchor="middle" className="text-[8px] font-mono font-bold fill-[var(--text-muted)]">{clip.name}</text>
                </g>
              );
            })}
            {/* Contributing weights - lines from current to nearby clips */}
            {BLEND_CLIPS.filter((c) => {
              const dx = Math.abs(c.x - BLEND_CURRENT.x);
              const dy = Math.abs(c.y - BLEND_CURRENT.y);
              return dx < 100 && dy < 0.4 && (dx + dy * 180) > 0;
            }).map((clip) => {
              const cx = 40 + ((clip.x + 180) / 360) * 260;
              const cy = 210 - clip.y * 200;
              const curX = 40 + ((BLEND_CURRENT.x + 180) / 360) * 260;
              const curY = 210 - BLEND_CURRENT.y * 200;
              return (
                <line key={clip.name} x1={curX} y1={curY} x2={cx} y2={cy}
                  stroke={`${ACCENT}40`} strokeWidth="1" strokeDasharray="3 2" />
              );
            })}
            {/* Current position (pulsing) */}
            {(() => {
              const curX = 40 + ((BLEND_CURRENT.x + 180) / 360) * 260;
              const curY = 210 - BLEND_CURRENT.y * 200;
              return (
                <>
                  <circle cx={curX} cy={curY} r={10} fill={`${ACCENT_CYAN}20`} stroke={ACCENT_CYAN} strokeWidth="1.5">
                    <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={curX} cy={curY} r={3} fill={ACCENT_CYAN} />
                  <text x={curX + 14} y={curY + 3} className="text-[8px] font-mono font-bold" fill={ACCENT_CYAN}>Current</text>
                </>
              );
            })()}
          </svg>
        </div>
      </SurfaceCard>

      {/* ── 2.4 Animation Budget Tracker ──────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Animation Budget Tracker" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Current animation system resource usage vs budget limits.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          {BUDGET_GAUGES.map((metric) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <LiveMetricGauge metric={metric} accent={ACCENT} size={80} />
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* ── 2.5 Combo Chain Graph Editor ──────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Combo Chain Graph" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Attack combo sequence with damage values and combo window timing between nodes.
        </p>
        <div className="relative z-10 flex justify-center overflow-x-auto">
          <svg width={450} height={140} viewBox="0 0 450 140" className="overflow-visible">
            {/* Edges (arrows) */}
            {COMBO_CHAIN_EDGES.map((edge) => {
              const from = COMBO_CHAIN_NODES.find((n) => n.id === edge.from)!;
              const to = COMBO_CHAIN_NODES.find((n) => n.id === edge.to)!;
              const x1 = from.x + 55;
              const x2 = to.x - 5;
              const y = from.y;
              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <defs>
                    <marker id={`arrow-${edge.from}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <path d="M0,0 L8,3 L0,6" fill={ACCENT} />
                    </marker>
                  </defs>
                  <line x1={x1} y1={y} x2={x2} y2={y} stroke={ACCENT} strokeWidth="2" markerEnd={`url(#arrow-${edge.from})`} />
                  <text x={(x1 + x2) / 2} y={y - 10} textAnchor="middle" className="text-[8px] font-mono" fill={ACCENT_CYAN}>{edge.window}</text>
                </g>
              );
            })}
            {/* Nodes */}
            {COMBO_CHAIN_NODES.map((node) => (
              <g key={node.id}>
                <rect x={node.x - 5} y={node.y - 30} width={110} height={60} rx={6} fill={`${ACCENT}15`} stroke={`${ACCENT}50`} strokeWidth="1.5" />
                <text x={node.x + 50} y={node.y - 12} textAnchor="middle" className="text-[10px] font-bold fill-[var(--text)]">{node.name}</text>
                <text x={node.x + 50} y={node.y + 2} textAnchor="middle" className="text-[8px] font-mono fill-[var(--text-muted)]">{node.montage}</text>
                <text x={node.x + 50} y={node.y + 17} textAnchor="middle" className="text-[9px] font-mono font-bold" fill={STATUS_ERROR}>
                  {node.damage} dmg
                </text>
              </g>
            ))}
          </svg>
        </div>
      </SurfaceCard>

      {/* ── 2.6 Root Motion Trajectory Preview ────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Root Motion Trajectory Preview" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Top-down view of root motion paths per montage. Line thickness indicates velocity.
        </p>
        <div className="relative z-10 flex items-center gap-6">
          <svg width={150} height={150} viewBox="0 0 150 150" className="overflow-visible flex-shrink-0">
            {/* Grid */}
            <circle cx={75} cy={75} r={65} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <circle cx={75} cy={75} r={35} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1={75} y1={10} x2={75} y2={140} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1={10} y1={75} x2={140} y2={75} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            {/* Character origin */}
            <circle cx={75} cy={130} r={4} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            <text x={75} y={146} textAnchor="middle" className="text-[7px] font-mono fill-[var(--text-muted)]">Origin</text>
            {/* Trajectories */}
            {ROOT_MOTION_PATHS.map((path) => {
              const pts = path.points.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <g key={path.name}>
                  <polyline points={pts} fill="none" stroke={path.color} strokeWidth="3" strokeLinecap="round" opacity={0.8} />
                  {/* End marker */}
                  <circle
                    cx={path.points[path.points.length - 1].x}
                    cy={path.points[path.points.length - 1].y}
                    r={3} fill={path.color}
                  />
                </g>
              );
            })}
          </svg>
          {/* Legend */}
          <div className="space-y-2">
            {ROOT_MOTION_PATHS.map((path) => (
              <div key={path.name} className="flex items-center gap-2">
                <span className="w-8 h-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: path.color }} />
                <span className="text-xs font-medium text-text">{path.name}</span>
                <span className="text-[10px] font-mono text-text-muted ml-auto">{path.distance}</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── 2.7 Animation Retarget Pipeline Status ────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Retarget Pipeline Status" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Detailed status of each retarget pipeline stage. Click a step to see details.
        </p>
        <div className="relative z-10 space-y-1.5">
          {RETARGET_PIPELINE_STEPS.map((step, i) => {
            const isExpanded = expandedRetargetStep === step.name;
            return (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setExpandedRetargetStep(isExpanded ? null : step.name)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover/30 transition-colors text-left"
                >
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RETARGET_STATUS_COLORS[step.status], boxShadow: `0 0 6px ${RETARGET_STATUS_COLORS[step.status]}` }} />
                    <span className="text-xs font-mono font-bold text-text w-16">{step.name}</span>
                  </span>
                  {i < RETARGET_PIPELINE_STEPS.length - 1 && (
                    <span className="text-text-muted opacity-40 text-xs">&rarr;</span>
                  )}
                  <span className="ml-auto flex-shrink-0">
                    <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                      <div className="px-3 pb-2 ml-8 text-xs text-text-muted leading-relaxed border-l-2" style={{ borderColor: RETARGET_STATUS_COLORS[step.status] }}>
                        {step.detail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* ── 2.8 Notify Coverage Analyzer ──────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Notify Coverage Analyzer" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Gaps in animation notify coverage. Errors must be resolved; warnings are advisory.
        </p>
        <div className="relative z-10 space-y-4">
          {/* Issue list */}
          <div className="space-y-1.5">
            {NOTIFY_ISSUES.map((issue, i) => (
              <motion.div
                key={`${issue.montage}-${i}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: issue.severity === 'error' ? `${STATUS_ERROR}10` : `${STATUS_WARNING}08`,
                  border: `1px solid ${issue.severity === 'error' ? `${STATUS_ERROR}30` : `${STATUS_WARNING}20`}`,
                }}
              >
                {issue.severity === 'error'
                  ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                  : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_WARNING }} />
                }
                <span className="font-mono font-bold text-text">{issue.montage}:</span>
                <span className="text-text-muted">{issue.message}</span>
                <span
                  className="ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: issue.severity === 'error' ? `${STATUS_ERROR}20` : `${STATUS_WARNING}15`,
                    color: issue.severity === 'error' ? STATUS_ERROR : STATUS_WARNING,
                  }}
                >
                  {issue.severity}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Coverage bars */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Coverage per Montage</div>
            {MONTAGE_COVERAGES.map((mc) => (
              <div key={mc.montage} className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-text-muted w-28 truncate">{mc.montage}</span>
                <div className="flex-1 h-3 rounded-full bg-surface-deep overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${mc.coverage * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: mc.coverage >= 0.8 ? STATUS_SUCCESS : mc.coverage >= 0.5 ? STATUS_WARNING : STATUS_ERROR }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-muted w-8 text-right">{Math.round(mc.coverage * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* ── 2.9 State Duration Statistics ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-40 h-40 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="State Duration Statistics" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          Box-and-whisker distribution of time spent in each animation state (seconds).
        </p>
        <div className="relative z-10 space-y-3">
          {STATE_DURATIONS.map((d) => {
            if (d.isInfinite) {
              return (
                <div key={d.state} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold text-text-muted w-20">{d.state}</span>
                  <div className="flex-1 h-6 rounded bg-surface-deep flex items-center justify-center">
                    <span className="text-[10px] font-mono text-text-muted italic">--- terminal state ---</span>
                  </div>
                </div>
              );
            }
            const toPercent = (v: number) => Math.min((v / DURATION_SCALE_MAX) * 100, 100);
            const whiskerLeft = toPercent(d.min);
            const boxLeft = toPercent(d.q1);
            const medianPos = toPercent(d.median);
            const boxRight = toPercent(d.q3);
            const whiskerRight = toPercent(d.max);
            return (
              <div key={d.state} className="flex items-center gap-3">
                <span className={`text-[10px] font-mono font-bold w-20 ${d.hasOutlier ? 'text-amber-400' : 'text-text-muted'}`}>{d.state}</span>
                <div className="flex-1 relative h-6 rounded bg-surface-deep">
                  {/* Whisker line (min to max) */}
                  <div
                    className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-text-muted/30"
                    style={{ left: `${whiskerLeft}%`, width: `${whiskerRight - whiskerLeft}%` }}
                  />
                  {/* Min/max caps */}
                  <div className="absolute top-1 w-[2px] h-4 bg-text-muted/40" style={{ left: `${whiskerLeft}%` }} />
                  <div className="absolute top-1 w-[2px] h-4 bg-text-muted/40" style={{ left: `${whiskerRight}%` }} />
                  {/* Box (Q1 to Q3) */}
                  <div
                    className="absolute top-0.5 h-5 rounded-sm"
                    style={{
                      left: `${boxLeft}%`,
                      width: `${boxRight - boxLeft}%`,
                      backgroundColor: d.hasOutlier ? `${STATUS_WARNING}30` : `${ACCENT}25`,
                      border: `1px solid ${d.hasOutlier ? STATUS_WARNING : ACCENT}50`,
                    }}
                  />
                  {/* Median line */}
                  <div
                    className="absolute top-0 w-[2px] h-6"
                    style={{ left: `${medianPos}%`, backgroundColor: d.hasOutlier ? STATUS_WARNING : ACCENT }}
                  />
                  {/* Outlier marker */}
                  {d.hasOutlier && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                      style={{ left: `${whiskerRight}%`, backgroundColor: STATUS_WARNING, boxShadow: `0 0 6px ${STATUS_WARNING}` }}
                      title={`Outlier: ${d.max}s`}
                    />
                  )}
                </div>
                <span className="text-[9px] font-mono text-text-muted w-14 text-right">
                  {d.median.toFixed(1)}s med
                </span>
              </div>
            );
          })}
          {/* Scale */}
          <div className="flex items-center gap-3 mt-1">
            <span className="w-20" />
            <div className="flex-1 flex justify-between text-[8px] font-mono text-text-muted/50">
              <span>0s</span>
              <span>8s</span>
              <span>16s</span>
              <span>24s</span>
              <span>32s</span>
            </div>
            <span className="w-14" />
          </div>
        </div>
      </SurfaceCard>

      {/* ── 2.10 Animation Event Timeline ─────────────────────────────────── */}
      <SurfaceCard level={2} className="p-4 relative overflow-hidden group">
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
        <SectionLabel label="Animation Event Timeline" />
        <p className="text-xs text-text-muted mt-1 mb-3">
          10-second event log showing state changes, montage plays, and notify fires.
        </p>
        <div className="relative z-10">
          <TimelineStrip events={ANIMATION_TIMELINE_EVENTS} accent={ACCENT} height={130} />
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-[10px] font-medium text-text-muted border-t border-border/40 pt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_INFO }} />
              State change
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
              Montage play
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_EMERALD }} />
              Notify fire
            </span>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
