import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_CYAN, ACCENT_EMERALD,
} from '@/lib/chart-colors';
import type { HeatmapCell, GaugeMetric, TimelineEvent } from '@/types/unique-tab-improvements';

export const ACCENT = ACCENT_VIOLET;

/* ── State machine nodes ───────────────────────────────────────────────────── */

export interface StateNode {
  name: string;
  featureName: string;
  ref: string;
  transitions: { to: string; label: string }[];
}

export type StateGroup = 'Movement' | 'Combat' | 'Reaction';

export interface StateGroupDef {
  group: StateGroup;
  states: string[];
}

export const STATE_GROUPS: StateGroupDef[] = [
  { group: 'Movement', states: ['Locomotion', 'Dodging'] },
  { group: 'Combat', states: ['Attacking'] },
  { group: 'Reaction', states: ['HitReact', 'Death'] },
];

export const STATE_NODES: StateNode[] = [
  {
    name: 'Locomotion',
    featureName: 'Locomotion Blend Space',
    ref: 'BS_Locomotion1D',
    transitions: [
      { to: 'Attacking', label: 'Input.Attack' },
      { to: 'Dodging', label: 'Input.Dodge' },
      { to: 'HitReact', label: 'State.Hit' },
      { to: 'Death', label: 'bIsDead' },
    ],
  },
  {
    name: 'Attacking',
    featureName: 'Attack montages',
    ref: 'AM_Melee_Combo',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
      { to: 'Dodging', label: 'Input.Dodge' },
      { to: 'HitReact', label: 'State.Hit' },
    ],
  },
  {
    name: 'Dodging',
    featureName: 'Root motion toggle',
    ref: 'AM_Dodge',
    transitions: [
      { to: 'Locomotion', label: 'Montage ends' },
      { to: 'Attacking', label: 'Cancel window' },
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

export interface NotifyWindow {
  name: string;
  color: string;
  start: number;
  width: number;
}

export interface ComboSection {
  label: string;
  duration: string;
  windows: NotifyWindow[];
}

export const COMBO_SECTIONS: ComboSection[] = [
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

export interface ComboDef {
  id: string;
  label: string;
  sectionIds: number[];
}

export const COMBO_DEFS: ComboDef[] = [
  { id: 'basic', label: 'Basic 3-Hit', sectionIds: [0, 1, 2] },
];

/* ── Asset list ────────────────────────────────────────────────────────────── */

export const ASSET_FEATURES = [
  'UARPGAnimInstance',
  'Locomotion Blend Space',
  'Attack montages',
  'Anim Notify classes',
  'Motion Warping',
  'Mixamo import & retarget pipeline',
  'Asset automation commandlet',
];

/* ── State Transition Heatmap data ─────────────────────────────────────────── */

export const HEATMAP_STATE_NAMES = ['Locomotion', 'Attacking', 'Dodging', 'HitReact', 'Death'];

export const HEATMAP_CELLS: HeatmapCell[] = [
  { row: 0, col: 1, value: 0.85, label: '.85', tooltip: 'Locomotion \u2192 Attacking: 85%' },
  { row: 0, col: 2, value: 0.6, label: '.60', tooltip: 'Locomotion \u2192 Dodging: 60%' },
  { row: 0, col: 3, value: 0.15, label: '.15', tooltip: 'Locomotion \u2192 HitReact: 15%' },
  { row: 0, col: 4, value: 0.02, label: '.02', tooltip: 'Locomotion \u2192 Death: 2%' },
  { row: 1, col: 0, value: 0.9, label: '.90', tooltip: 'Attacking \u2192 Locomotion: 90%' },
  { row: 1, col: 2, value: 0.25, label: '.25', tooltip: 'Attacking \u2192 Dodging: 25%' },
  { row: 1, col: 3, value: 0.3, label: '.30', tooltip: 'Attacking \u2192 HitReact: 30%' },
  { row: 2, col: 0, value: 0.95, label: '.95', tooltip: 'Dodging \u2192 Locomotion: 95%' },
  { row: 2, col: 1, value: 0.1, label: '.10', tooltip: 'Dodging \u2192 Attacking: 10%' },
  { row: 3, col: 0, value: 0.7, label: '.70', tooltip: 'HitReact \u2192 Locomotion: 70%' },
  { row: 3, col: 4, value: 0.05, label: '.05', tooltip: 'HitReact \u2192 Death: 5%' },
];

/* ── Montage Frame Scrubber data ───────────────────────────────────────────── */

export interface NotifyLane {
  name: string;
  color: string;
  startFrame: number;
  endFrame: number;
}

export const SCRUBBER_LANES: NotifyLane[] = [
  { name: 'HitDetection', color: STATUS_ERROR, startFrame: 6, endFrame: 14 },
  { name: 'ComboWindow', color: ACCENT_CYAN, startFrame: 16, endFrame: 24 },
  { name: 'SpawnVFX', color: STATUS_WARNING, startFrame: 6, endFrame: 10 },
  { name: 'Sound', color: STATUS_INFO, startFrame: 3, endFrame: 5 },
];

export const SCRUBBER_TOTAL_FRAMES = 30;

/* ── Blend Space Visualizer data ───────────────────────────────────────────── */

export interface BlendClip {
  name: string;
  x: number;
  y: number;
}

export const BLEND_CLIPS: BlendClip[] = [
  { name: 'Idle', x: 0, y: 0 },
  { name: 'WalkFwd', x: 0, y: 0.3 },
  { name: 'RunFwd', x: 0, y: 0.7 },
  { name: 'WalkLeft', x: -90, y: 0.3 },
  { name: 'WalkRight', x: 90, y: 0.3 },
  { name: 'WalkBack', x: 180, y: 0.3 },
];

export const BLEND_CURRENT = { x: 15, y: 0.5 };

/* ── Animation Budget Tracker data ─────────────────────────────────────────── */

export const BUDGET_GAUGES: GaugeMetric[] = [
  { label: 'Montage Slots', current: 2, target: 4, unit: '' },
  { label: 'Blend Depth', current: 3, target: 8, unit: '' },
  { label: 'Active IK', current: 1, target: 4, unit: '' },
  { label: 'Bone Count', current: 65, target: 120, unit: '' },
];

/* ── Combo Chain Graph Editor data ─────────────────────────────────────────── */

export interface ComboNode {
  id: string;
  name: string;
  montage: string;
  damage: number;
  x: number;
  y: number;
}

export const COMBO_CHAIN_NODES: ComboNode[] = [
  { id: 'atk1', name: 'Light Slash', montage: 'AM_Combo1', damage: 25, x: 44, y: 47 },
  { id: 'atk2', name: 'Cross Cut', montage: 'AM_Combo2', damage: 35, x: 178, y: 47 },
  { id: 'atk3', name: 'Heavy Finisher', montage: 'AM_Combo3', damage: 60, x: 311, y: 47 },
];

export const COMBO_CHAIN_EDGES = [
  { from: 'atk1', to: 'atk2', window: '0.4-0.6s' },
  { from: 'atk2', to: 'atk3', window: '0.35-0.55s' },
];

/* ── Root Motion Trajectory data ───────────────────────────────────────────── */

export interface TrajectoryPath {
  name: string;
  color: string;
  points: { x: number; y: number }[];
  distance: string;
}

export const ROOT_MOTION_PATHS: TrajectoryPath[] = [
  {
    name: 'LightAttack',
    color: STATUS_INFO,
    points: [{ x: 60, y: 104 }, { x: 60, y: 92 }, { x: 60, y: 80 }, { x: 60, y: 72 }],
    distance: '40 cm',
  },
  {
    name: 'HeavyAttack',
    color: STATUS_ERROR,
    points: [{ x: 60, y: 104 }, { x: 61, y: 88 }, { x: 62, y: 68 }, { x: 62, y: 48 }, { x: 62, y: 36 }],
    distance: '85 cm',
  },
  {
    name: 'Dodge',
    color: ACCENT_EMERALD,
    points: [{ x: 60, y: 104 }, { x: 58, y: 108 }, { x: 54, y: 112 }, { x: 50, y: 114 }, { x: 44, y: 112 }],
    distance: '55 cm',
  },
];

/* ── Retarget Pipeline data ────────────────────────────────────────────────── */

export interface RetargetStep {
  name: string;
  color: string;
  detail: string;
}

export const RETARGET_PIPELINE_STEPS: RetargetStep[] = [
  { name: 'Import', color: STATUS_SUCCESS, detail: 'Mixamo FBX files imported. 24 animations loaded.' },
  { name: 'Strip', color: STATUS_SUCCESS, detail: 'Bone prefix "mixamorig:" stripped from all bones.' },
  { name: 'Retarget', color: STATUS_WARNING, detail: 'IK Retargeter shows minor foot drift on RunFwd. Acceptable for now.' },
  { name: 'RootMotion', color: STATUS_SUCCESS, detail: 'Root motion extracted and validated for all locomotion clips.' },
  { name: 'Commandlet', color: STATUS_SUCCESS, detail: 'Asset automation ran successfully. All assets cooked.' },
];

/* ── Notify Coverage data ──────────────────────────────────────────────────── */

export interface NotifyCoverageIssue {
  montage: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MontageCoverage {
  montage: string;
  coverage: number;
}

export const NOTIFY_ISSUES: NotifyCoverageIssue[] = [
  { montage: 'AM_HeavyAttack', message: 'Missing HitDetection notify', severity: 'error' },
  { montage: 'AM_Dodge', message: 'No sound notify', severity: 'warning' },
  { montage: 'AM_Combo3', message: 'ComboWindow has no follow-up', severity: 'warning' },
  { montage: 'AM_Death', message: 'No VFX notify', severity: 'warning' },
];

export const MONTAGE_COVERAGES: MontageCoverage[] = [
  { montage: 'AM_Combo1', coverage: 1.0 },
  { montage: 'AM_Combo2', coverage: 1.0 },
  { montage: 'AM_Combo3', coverage: 0.6 },
  { montage: 'AM_HeavyAttack', coverage: 0.3 },
  { montage: 'AM_Dodge', coverage: 0.5 },
  { montage: 'AM_Death', coverage: 0.4 },
];

/* ── State Duration Statistics data ────────────────────────────────────────── */

export interface BoxWhiskerData {
  state: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  hasOutlier?: boolean;
  isInfinite?: boolean;
}

export const STATE_DURATIONS: BoxWhiskerData[] = [
  { state: 'Locomotion', min: 0.5, q1: 2.0, median: 5.0, q3: 10.0, max: 30.0 },
  { state: 'Attacking', min: 0.3, q1: 0.4, median: 0.5, q3: 0.6, max: 1.2 },
  { state: 'Dodging', min: 0.2, q1: 0.3, median: 0.3, q3: 0.35, max: 0.4 },
  { state: 'HitReact', min: 0.1, q1: 0.2, median: 0.3, q3: 0.5, max: 5.0, hasOutlier: true },
  { state: 'Death', min: 0, q1: 0, median: 0, q3: 0, max: 0, isInfinite: true },
];

export const DURATION_SCALE_MAX = 32;

/* ── Animation Event Timeline data ─────────────────────────────────────────── */

export const ANIMATION_TIMELINE_EVENTS: TimelineEvent[] = [
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

/* ── Predictive Responsiveness Analyzer data ───────────────────────────────── */

export type AnimStateName = 'Locomotion' | 'Attacking' | 'Dodging' | 'HitReact' | 'Death';

export interface MontageTiming {
  name: string;
  state: AnimStateName;
  totalFrames: number;
  fps: number;
  cancelWindowStart?: number;
  cancelWindowEnd?: number;
  blendInTime: number;
}

export const MONTAGE_TIMINGS: MontageTiming[] = [
  { name: 'AM_Combo1', state: 'Attacking', totalFrames: 30, fps: 30, cancelWindowStart: 20, cancelWindowEnd: 30, blendInTime: 0.05 },
  { name: 'AM_Combo2', state: 'Attacking', totalFrames: 36, fps: 30, cancelWindowStart: 24, cancelWindowEnd: 36, blendInTime: 0.05 },
  { name: 'AM_Combo3', state: 'Attacking', totalFrames: 45, fps: 30, cancelWindowStart: 30, cancelWindowEnd: 45, blendInTime: 0.08 },
  { name: 'AM_HeavyAttack', state: 'Attacking', totalFrames: 50, fps: 30, cancelWindowStart: 35, cancelWindowEnd: 50, blendInTime: 0.08 },
  { name: 'AM_Dodge', state: 'Dodging', totalFrames: 15, fps: 30, cancelWindowStart: 10, cancelWindowEnd: 15, blendInTime: 0.03 },
  { name: 'AM_HitReact', state: 'HitReact', totalFrames: 12, fps: 30, blendInTime: 0.0 },
];

export interface TransitionRule {
  from: AnimStateName;
  to: AnimStateName;
  condition: string;
  useCancelWindow: boolean;
  gateBool: string;
}

export const TRANSITION_RULES: TransitionRule[] = [
  { from: 'Locomotion', to: 'Attacking', condition: 'bIsAttacking', useCancelWindow: false, gateBool: 'bIsAttacking' },
  { from: 'Locomotion', to: 'Dodging', condition: 'bIsDodging', useCancelWindow: false, gateBool: 'bIsDodging' },
  { from: 'Locomotion', to: 'HitReact', condition: 'bIsHitReacting', useCancelWindow: false, gateBool: 'bIsHitReacting' },
  { from: 'Locomotion', to: 'Death', condition: 'bIsDead', useCancelWindow: false, gateBool: 'bIsDead' },
  { from: 'Attacking', to: 'Locomotion', condition: '!bIsAttacking && !bIsFullBodyMontage', useCancelWindow: false, gateBool: 'bIsAttackRecovery' },
  { from: 'Attacking', to: 'Dodging', condition: 'bDodgeCancelsAttack', useCancelWindow: true, gateBool: 'bDodgeCancelsAttack' },
  { from: 'Attacking', to: 'HitReact', condition: 'bHitReactInterrupt', useCancelWindow: false, gateBool: 'bHitReactInterrupt' },
  { from: 'Dodging', to: 'Locomotion', condition: '!bIsDodging', useCancelWindow: false, gateBool: 'bIsDodging' },
  { from: 'Dodging', to: 'Attacking', condition: 'bCanInterruptDodge && bIsAttacking', useCancelWindow: true, gateBool: 'bCanInterruptDodge' },
  { from: 'HitReact', to: 'Locomotion', condition: '!bIsHitReacting', useCancelWindow: false, gateBool: 'bIsHitReacting' },
  { from: 'HitReact', to: 'Death', condition: 'bIsDead', useCancelWindow: false, gateBool: 'bIsDead' },
];

export const GENRE_NORMS: Record<string, number> = {
  'Locomotion': 0.05,
  'Attacking': 0.20,
  'Dodging': 0.15,
  'HitReact': 0.10,
};

export interface ResponsivenessResult {
  from: AnimStateName;
  to: AnimStateName;
  action: string;
  bestCase: number;
  worstCase: number;
  avgCase: number;
  frameRange: string;
  cancelPct: string;
  exceedsNorm: boolean;
  normThreshold: number;
  gateBool: string;
}

function computeResponsiveness(): ResponsivenessResult[] {
  const results: ResponsivenessResult[] = [];

  for (const rule of TRANSITION_RULES) {
    const sourceMontages = MONTAGE_TIMINGS.filter(m => m.state === rule.from);

    if (rule.from === 'Locomotion') {
      const blendIn = 0.05;
      const inputLag = 1 / 60;
      const total = blendIn + inputLag;
      results.push({
        from: rule.from, to: rule.to,
        action: `${rule.to} from idle`,
        bestCase: inputLag, worstCase: total, avgCase: (inputLag + total) / 2,
        frameRange: 'frame 0-1', cancelPct: 'immediate',
        exceedsNorm: total > (GENRE_NORMS[rule.from] ?? 0.2),
        normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
        gateBool: rule.gateBool,
      });
      continue;
    }

    if (sourceMontages.length === 0) {
      const montage = MONTAGE_TIMINGS.find(m => m.state === rule.from);
      const dur = montage ? montage.totalFrames / montage.fps : 0.3;
      results.push({
        from: rule.from, to: rule.to,
        action: `${rule.to} from ${rule.from}`,
        bestCase: 0, worstCase: dur, avgCase: dur / 2,
        frameRange: `0-${montage?.totalFrames ?? '?'}`,
        cancelPct: 'on completion',
        exceedsNorm: dur > (GENRE_NORMS[rule.from] ?? 0.2),
        normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
        gateBool: rule.gateBool,
      });
      continue;
    }

    for (const montage of sourceMontages) {
      const frameDur = 1 / montage.fps;
      const totalDur = montage.totalFrames * frameDur;

      if (rule.useCancelWindow && montage.cancelWindowStart !== undefined && montage.cancelWindowEnd !== undefined) {
        const cancelStart = montage.cancelWindowStart * frameDur;
        const cancelEnd = montage.cancelWindowEnd * frameDur;
        const blendIn = montage.blendInTime;
        const best = cancelStart + blendIn;
        const worst = cancelEnd + blendIn;
        const pctStart = Math.round((montage.cancelWindowStart / montage.totalFrames) * 100);
        const pctEnd = Math.round((montage.cancelWindowEnd / montage.totalFrames) * 100);

        results.push({
          from: rule.from, to: rule.to,
          action: `${rule.to} from ${montage.name}`,
          bestCase: best, worstCase: worst, avgCase: (best + worst) / 2,
          frameRange: `frames ${montage.cancelWindowStart}-${montage.cancelWindowEnd} of ${montage.totalFrames}`,
          cancelPct: `${pctStart}-${pctEnd}%`,
          exceedsNorm: best > (GENRE_NORMS[rule.from] ?? 0.2),
          normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
          gateBool: rule.gateBool,
        });
      } else {
        const blendIn = montage.blendInTime;
        results.push({
          from: rule.from, to: rule.to,
          action: `${rule.to} from ${montage.name}`,
          bestCase: totalDur + blendIn, worstCase: totalDur + blendIn, avgCase: totalDur + blendIn,
          frameRange: `after frame ${montage.totalFrames}`,
          cancelPct: 'on completion',
          exceedsNorm: (totalDur + blendIn) > (GENRE_NORMS[rule.from] ?? 0.2),
          normThreshold: GENRE_NORMS[rule.from] ?? 0.2,
          gateBool: rule.gateBool,
        });
      }
    }
  }

  return results;
}

export const RESPONSIVENESS_RESULTS = computeResponsiveness();

export const RESPONSIVENESS_GRADE_THRESHOLDS = [
  { max: 0.05, label: 'Instant', color: STATUS_SUCCESS },
  { max: 0.10, label: 'Excellent', color: STATUS_SUCCESS },
  { max: 0.15, label: 'Good', color: ACCENT_EMERALD },
  { max: 0.25, label: 'Acceptable', color: STATUS_WARNING },
  { max: 0.50, label: 'Sluggish', color: ACCENT_VIOLET },
  { max: Infinity, label: 'Unresponsive', color: STATUS_ERROR },
];

export function getGrade(seconds: number) {
  return RESPONSIVENESS_GRADE_THRESHOLDS.find(t => seconds <= t.max) ?? RESPONSIVENESS_GRADE_THRESHOLDS[RESPONSIVENESS_GRADE_THRESHOLDS.length - 1];
}
