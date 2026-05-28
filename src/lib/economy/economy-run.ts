/**
 * Persistent named economy simulation runs + drift model (sibling to
 * src/lib/balance/baseline.ts). A "run" is a captured snapshot of one
 * simulation's config + key headline metrics. One run can be marked the
 * baseline; subsequent runs are compared against it via the existing
 * computeStatDrift engine (re-used here for shape consistency).
 *
 * Pure: model + extraction + drift only. Persistence lives in economy-run-db.ts.
 */

import type { SimulationResult } from '@/types/economy-simulator';
import type { SimulationConfig } from '@/types/economy-simulator';
import { computeStatDrift, type StatDrift } from '@/lib/balance/baseline';
import type { StatRow } from '@/lib/balance/threat-score';

/** Compact, comparable headline metrics — what we keep when a run is saved. */
export interface EconomyRunMetrics {
  avgGold: number;
  medianGold: number;
  gini: number;
  netFlowPerHour: number;
  inflowPerHour: number;
  outflowPerHour: number;
  criticalAlerts: number;
  warningAlerts: number;
  durationMs: number;
}

export interface EconomyRun {
  id: string;
  name: string;
  config: SimulationConfig;
  metrics: EconomyRunMetrics;
  /** Exactly one stored run may be the baseline at any time. */
  isBaseline: boolean;
  capturedAt?: string;
}

/** Per-metric drift between a candidate and the baseline run. */
export interface EconomyRunDrift {
  baselineId: string;
  baselineName: string;
  stats: StatDrift[];
}

const METRIC_LABELS = {
  avgGold: 'Avg Gold',
  medianGold: 'Median Gold',
  gini: 'Gini',
  netFlowPerHour: 'Net Flow/hr',
  inflowPerHour: 'Inflow/hr',
  outflowPerHour: 'Outflow/hr',
  criticalAlerts: 'Critical Alerts',
  warningAlerts: 'Warning Alerts',
} as const;

/** Reduce a full SimulationResult to the headline metrics we persist + diff. */
export function extractRunMetrics(result: SimulationResult): EconomyRunMetrics {
  const last = result.metrics[result.metrics.length - 1];
  const critical = result.alerts.filter((a) => a.severity === 'critical').length;
  const warning = result.alerts.filter((a) => a.severity === 'warning').length;
  return {
    avgGold: last?.avgGold ?? 0,
    medianGold: last?.medianGold ?? 0,
    gini: last?.giniCoefficient ?? 0,
    netFlowPerHour: last?.netFlowPerHour ?? 0,
    inflowPerHour: last?.inflowPerHour ?? 0,
    outflowPerHour: last?.outflowPerHour ?? 0,
    criticalAlerts: critical,
    warningAlerts: warning,
    durationMs: result.durationMs,
  };
}

/** Project headline metrics into the StatRow shape so we can reuse computeStatDrift. */
export function metricsToStatRows(m: EconomyRunMetrics): StatRow[] {
  return [
    { label: METRIC_LABELS.avgGold, value: m.avgGold },
    { label: METRIC_LABELS.medianGold, value: m.medianGold },
    // Gini is a small float; scale so the shared FLAT_TOLERANCE (0.5) registers a meaningful change.
    { label: METRIC_LABELS.gini, value: m.gini * 100 },
    { label: METRIC_LABELS.netFlowPerHour, value: m.netFlowPerHour },
    { label: METRIC_LABELS.inflowPerHour, value: m.inflowPerHour },
    { label: METRIC_LABELS.outflowPerHour, value: m.outflowPerHour },
    { label: METRIC_LABELS.criticalAlerts, value: m.criticalAlerts },
    { label: METRIC_LABELS.warningAlerts, value: m.warningAlerts },
  ];
}

/** Per-metric drift between a current run's metrics and a baseline run. */
export function economyDrift(
  current: EconomyRunMetrics,
  baseline: EconomyRun,
): EconomyRunDrift {
  return {
    baselineId: baseline.id,
    baselineName: baseline.name,
    stats: computeStatDrift(metricsToStatRows(current), metricsToStatRows(baseline.metrics)),
  };
}
