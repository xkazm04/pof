'use client';

import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_ORANGE, ACCENT_EMERALD, ACCENT_VIOLET,
} from '@/lib/chart-colors';

/* -- 12.6 GC Timeline ----------------------------------------------------- */

export const GC_EVENTS = [
  { id: 'gc-1', time: 12.4, duration: 2.1, heapBefore: 340, heapAfter: 280 },
  { id: 'gc-2', time: 58.2, duration: 3.8, heapBefore: 385, heapAfter: 290 },
  { id: 'gc-3', time: 102.6, duration: 1.5, heapBefore: 350, heapAfter: 295 },
  { id: 'gc-4', time: 148.1, duration: 4.2, heapBefore: 410, heapAfter: 305 },
  { id: 'gc-5', time: 192.8, duration: 2.8, heapBefore: 380, heapAfter: 285 },
  { id: 'gc-6', time: 237.5, duration: 1.9, heapBefore: 355, heapAfter: 290 },
  { id: 'gc-7', time: 283.0, duration: 5.6, heapBefore: 440, heapAfter: 310 },
  { id: 'gc-8', time: 328.4, duration: 2.4, heapBefore: 370, heapAfter: 288 },
  { id: 'gc-9', time: 372.9, duration: 3.1, heapBefore: 395, heapAfter: 298 },
  { id: 'gc-10', time: 418.3, duration: 1.7, heapBefore: 345, heapAfter: 282 },
];
export const GC_AVG_INTERVAL = 45;
export const GC_WARNING_THRESHOLD_MS = 5;

/* -- 12.7 Draw Call Analyzer ----------------------------------------------- */

export const DRAW_CALL_CATEGORIES = [
  { category: 'StaticMesh', count: 420, color: ACCENT_ORANGE },
  { category: 'SkeletalMesh', count: 180, color: ACCENT_VIOLET },
  { category: 'Particles', count: 95, color: ACCENT_CYAN },
  { category: 'UI', count: 45, color: STATUS_WARNING },
  { category: 'Decals', count: 30, color: ACCENT_EMERALD },
  { category: 'Translucent', count: 20, color: STATUS_ERROR },
];
export const DRAW_CALL_TOTAL = DRAW_CALL_CATEGORIES.reduce((s, c) => s + c.count, 0);
export const DRAW_CALL_BUDGET = 2000;
export const EXPENSIVE_MATERIALS = [
  { name: 'M_Hero_Body', drawCalls: 42, shader: 'Complex PBR + SSS', cost: 'High' },
  { name: 'M_Water_Ocean', drawCalls: 28, shader: 'Translucent + Refraction', cost: 'High' },
  { name: 'M_Foliage_Wind', drawCalls: 65, shader: 'Two-Sided + WPO', cost: 'Medium' },
  { name: 'M_VFX_Fire', drawCalls: 38, shader: 'Additive + Distortion', cost: 'Medium' },
];

/* -- 12.8 Stat Command Dashboard ------------------------------------------- */

export interface StatEntry { label: string; value: string; sparkline: number[]; unit?: string }
export interface StatGroup { group: string; stats: StatEntry[] }

export const STAT_GROUPS: StatGroup[] = [
  {
    group: 'FPS Stats',
    stats: [
      { label: 'FPS', value: '62.4', sparkline: [58, 60, 61, 59, 63, 62, 64, 61, 60, 62], unit: 'fps' },
      { label: 'Frame Time', value: '16.02', sparkline: [17.2, 16.6, 16.4, 16.9, 15.8, 16.1, 15.6, 16.4, 16.6, 16.0], unit: 'ms' },
      { label: '1% Low', value: '45.2', sparkline: [42, 44, 43, 46, 45, 44, 47, 45, 44, 45], unit: 'fps' },
    ],
  },
  {
    group: 'Game Thread',
    stats: [
      { label: 'Tick Time', value: '4.2', sparkline: [4.5, 4.3, 4.1, 4.4, 4.2, 4.0, 4.3, 4.1, 4.2, 4.2], unit: 'ms' },
      { label: 'Actor Count', value: '720', sparkline: [710, 715, 718, 722, 720, 725, 718, 720, 722, 720] },
      { label: 'Blueprint Time', value: '1.8', sparkline: [2.0, 1.9, 1.7, 1.8, 2.1, 1.8, 1.7, 1.9, 1.8, 1.8], unit: 'ms' },
    ],
  },
  {
    group: 'Render Thread',
    stats: [
      { label: 'Draw Calls', value: '790', sparkline: [780, 785, 792, 788, 790, 795, 782, 790, 788, 790] },
      { label: 'Triangles', value: '1.2M', sparkline: [1.1, 1.15, 1.2, 1.18, 1.22, 1.2, 1.19, 1.21, 1.2, 1.2] },
      { label: 'Render Time', value: '6.1', sparkline: [6.3, 6.0, 6.2, 6.1, 5.9, 6.1, 6.3, 6.0, 6.1, 6.1], unit: 'ms' },
    ],
  },
  {
    group: 'GPU',
    stats: [
      { label: 'GPU Time', value: '8.3', sparkline: [8.5, 8.2, 8.4, 8.3, 8.1, 8.3, 8.5, 8.2, 8.3, 8.3], unit: 'ms' },
      { label: 'VRAM Used', value: '380', sparkline: [375, 378, 380, 382, 380, 379, 381, 380, 380, 380], unit: 'MB' },
      { label: 'GPU Util', value: '78', sparkline: [75, 77, 79, 78, 76, 78, 80, 77, 78, 78], unit: '%' },
    ],
  },
  {
    group: 'Memory',
    stats: [
      { label: 'Physical', value: '2.1', sparkline: [2.0, 2.05, 2.1, 2.08, 2.1, 2.12, 2.1, 2.09, 2.1, 2.1], unit: 'GB' },
      { label: 'Virtual', value: '4.8', sparkline: [4.7, 4.75, 4.8, 4.78, 4.8, 4.82, 4.8, 4.79, 4.8, 4.8], unit: 'GB' },
      { label: 'Pool Allocs', value: '12.4K', sparkline: [12.1, 12.2, 12.3, 12.4, 12.3, 12.4, 12.5, 12.3, 12.4, 12.4] },
    ],
  },
];

/* -- 12.9 Crash Prediction Engine ------------------------------------------ */

export type RiskLevel = 'GREEN' | 'AMBER' | 'RED';
export const RISK_COLORS: Record<RiskLevel, string> = { GREEN: STATUS_SUCCESS, AMBER: STATUS_WARNING, RED: STATUS_ERROR };

export const CRASH_RISK_OVERALL = 'LOW' as const;
export const CRASH_RISK_FACTORS: { factor: string; risk: RiskLevel; detail: string }[] = [
  { factor: 'Memory Headroom', risk: 'GREEN', detail: '132MB free of 512MB budget' },
  { factor: 'GC Frequency', risk: 'GREEN', detail: 'Stable ~45s interval, no spikes' },
  { factor: 'Frame Time Trend', risk: 'AMBER', detail: 'Slight upward trend +0.3ms over 5min' },
  { factor: 'Null Access Checks', risk: 'GREEN', detail: '0 null access warnings in last hour' },
  { factor: 'Thread Contention', risk: 'GREEN', detail: 'No deadlocks detected, mutex waits <0.1ms' },
  { factor: 'Asset Load Failures', risk: 'GREEN', detail: '0 failed async loads in session' },
];
export const CRASH_RECOMMENDATIONS = [
  'Monitor frame time trend — investigate if delta exceeds +1ms over 10min',
  'Consider pre-warming object pools before high-intensity zones',
  'Enable crash reporter telemetry for automated regression tracking',
];

/* -- 12.10 Performance Regression Detector --------------------------------- */

export type RegressionStatus = 'PASS' | 'AMBER' | 'FAIL';
export const REGRESSION_STATUS_COLORS: Record<RegressionStatus, string> = {
  PASS: STATUS_SUCCESS,
  AMBER: STATUS_WARNING,
  FAIL: STATUS_ERROR,
};
export const REGRESSION_METRICS: { metric: string; status: RegressionStatus; detail: string; delta?: string }[] = [
  { metric: 'FPS (Avg)', status: 'PASS', detail: '62.4 fps vs 63.1 baseline', delta: '-1.1%' },
  { metric: 'Frame Time (P99)', status: 'PASS', detail: '18.2ms vs 18.0ms baseline', delta: '+1.1%' },
  { metric: 'Memory (Peak)', status: 'AMBER', detail: '412MB vs 381MB baseline', delta: '+8.1%' },
  { metric: 'Draw Calls', status: 'PASS', detail: '790 vs 785 baseline', delta: '+0.6%' },
  { metric: 'Load Time', status: 'PASS', detail: '3.2s vs 3.1s baseline', delta: '+3.2%' },
  { metric: 'GC Pause (Max)', status: 'PASS', detail: '5.6ms vs 5.2ms baseline', delta: '+7.7%' },
];
export const REGRESSION_BUILDS = [
  { build: 'v0.8.1', fps: 65, memory: 360, drawCalls: 750 },
  { build: 'v0.8.2', fps: 64, memory: 368, drawCalls: 770 },
  { build: 'v0.8.3', fps: 63, memory: 375, drawCalls: 780 },
  { build: 'v0.9.0', fps: 63, memory: 381, drawCalls: 785 },
  { build: 'v0.9.1', fps: 62, memory: 412, drawCalls: 790 },
];
