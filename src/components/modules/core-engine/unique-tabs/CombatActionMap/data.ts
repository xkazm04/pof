import { Swords, Shield, Zap } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_WARNING, STATUS_INFO,
  ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET, ACCENT_RED,
} from '@/lib/chart-colors';

/* Re-export metrics data so consumers can import everything from './data' */
export * from './data-metrics';

export const ACCENT = ACCENT_RED;

/* ── Lane definitions ──────────────────────────────────────────────────── */

export interface LaneConfig {
  id: string;
  label: string;
  icon: typeof Swords;
  color: string;
  featureNames: string[];
}

export const LANES: LaneConfig[] = [
  {
    id: 'offensive',
    label: 'Offensive',
    icon: Swords,
    color: STATUS_ERROR,
    featureNames: ['Melee attack ability', 'Combo system', 'Dodge ability (GAS)'],
  },
  {
    id: 'pipeline',
    label: 'Damage Pipeline',
    icon: Zap,
    color: STATUS_WARNING,
    featureNames: ['Hit detection', 'GAS damage application', 'Death flow'],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: Shield,
    color: STATUS_INFO,
    featureNames: ['Hit reaction system', 'Combat feedback'],
  },
];

/* ── Flow arrows between features ──────────────────────────────────────── */

export interface FlowArrow {
  from: string;
  to: string;
  label?: string;
}

export const FLOW_ARROWS: FlowArrow[] = [
  { from: 'Melee attack ability', to: 'Combo system', label: 'chains' },
  { from: 'Melee attack ability', to: 'Hit detection', label: 'triggers' },
  { from: 'Combo system', to: 'Hit detection', label: 'per section' },
  { from: 'Hit detection', to: 'GAS damage application', label: 'on hit' },
  { from: 'GAS damage application', to: 'Hit reaction system', label: 'applies' },
  { from: 'GAS damage application', to: 'Combat feedback', label: 'triggers' },
  { from: 'GAS damage application', to: 'Death flow', label: 'HP <= 0' },
];

/* ── Combat Event Sequence Diagram data ────────────────────────────────── */

export interface SequenceLane {
  id: string;
  label: string;
  color: string;
}

export interface SequenceEvent {
  label: string;
  fromLane: string;
  toLane: string;
  color: string;
}

export const SEQ_LANES: SequenceLane[] = [
  { id: 'player', label: 'Player', color: ACCENT_EMERALD },
  { id: 'anim', label: 'AnimSystem', color: ACCENT_CYAN },
  { id: 'gas', label: 'GAS', color: ACCENT_ORANGE },
  { id: 'feedback', label: 'FeedbackSystem', color: ACCENT_VIOLET },
];

export const SEQ_EVENTS: SequenceEvent[] = [
  { label: 'InputPressed', fromLane: 'player', toLane: 'player', color: ACCENT_EMERALD },
  { label: 'AbilityActivated', fromLane: 'player', toLane: 'gas', color: ACCENT_ORANGE },
  { label: 'MontageStarted', fromLane: 'gas', toLane: 'anim', color: ACCENT_CYAN },
  { label: 'HitDetectionBegin', fromLane: 'anim', toLane: 'anim', color: ACCENT_CYAN },
  { label: 'DamageApplied', fromLane: 'anim', toLane: 'gas', color: ACCENT_ORANGE },
  { label: 'FeedbackTriggered', fromLane: 'gas', toLane: 'feedback', color: ACCENT_VIOLET },
];

/* ── Hit Detection Debug data ──────────────────────────────────────────── */

export interface TraceFrame {
  cx: number;
  cy: number;
  r: number;
  hit: boolean;
}

export const TRACE_FRAMES: TraceFrame[] = [
  { cx: 30, cy: 80, r: 12, hit: false },
  { cx: 55, cy: 60, r: 14, hit: false },
  { cx: 85, cy: 42, r: 15, hit: true },
  { cx: 115, cy: 35, r: 14, hit: true },
  { cx: 145, cy: 40, r: 12, hit: false },
];

export const HIT_STATS = [
  { label: 'Hit Rate', value: '67%', color: ACCENT_EMERALD },
  { label: 'Avg Hits/Swing', value: '2.3', color: ACCENT_CYAN },
  { label: 'Trace Coverage', value: '85%', color: ACCENT_ORANGE },
];

/* ── Feedback Intensity Tuner data ─────────────────────────────────────── */

export interface FeedbackParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

export const FEEDBACK_PARAMS: FeedbackParam[] = [
  { id: 'shakeScale', label: 'ShakeScale', min: 0, max: 2, step: 0.05, defaultValue: 0.8, unit: 'x' },
  { id: 'hitstopDuration', label: 'HitstopDuration', min: 0, max: 0.2, step: 0.005, defaultValue: 0.05, unit: 's' },
  { id: 'vfxScale', label: 'VFXScale', min: 0, max: 3, step: 0.1, defaultValue: 1.5, unit: 'x' },
  { id: 'sfxVolume', label: 'SFXVolume', min: 0, max: 1, step: 0.05, defaultValue: 0.7, unit: '' },
  { id: 'screenFlashAlpha', label: 'ScreenFlashAlpha', min: 0, max: 0.5, step: 0.01, defaultValue: 0.15, unit: '' },
];

export interface FeedbackPreset {
  name: string;
  values: Record<string, number>;
  color: string;
}

export const FEEDBACK_PRESETS: FeedbackPreset[] = [
  { name: 'Subtle', values: { shakeScale: 0.3, hitstopDuration: 0.02, vfxScale: 0.8, sfxVolume: 0.4, screenFlashAlpha: 0.05 }, color: ACCENT_CYAN },
  { name: 'Normal', values: { shakeScale: 0.8, hitstopDuration: 0.05, vfxScale: 1.5, sfxVolume: 0.7, screenFlashAlpha: 0.15 }, color: ACCENT_EMERALD },
  { name: 'Juicy', values: { shakeScale: 1.6, hitstopDuration: 0.12, vfxScale: 2.5, sfxVolume: 0.95, screenFlashAlpha: 0.35 }, color: ACCENT_ORANGE },
];

/* ── Projectile Trajectory data ────────────────────────────────────────── */

export interface ProjectilePath {
  label: string;
  color: string;
  speed: number;
  flightTime: string;
  maxRange: string;
  points: { x: number; y: number }[];
}

export const PROJECTILE_PATHS: ProjectilePath[] = [
  {
    label: 'Straight',
    color: STATUS_INFO,
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
