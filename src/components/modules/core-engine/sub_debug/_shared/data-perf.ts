'use client';

import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import type { RiskLevel } from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';

/* -- 12.9 Crash Prediction Engine (factors are derived: debugSnapshot.ts) --- */

export const RISK_COLORS: Record<RiskLevel, string> = { GREEN: STATUS_SUCCESS, AMBER: STATUS_WARNING, RED: STATUS_ERROR };

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
