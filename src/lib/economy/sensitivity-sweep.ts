import type { SimulationConfig, SimulationResult, EconomyFlow } from '@/types/economy-simulator';
import { runSimulation } from './simulation-engine';
import { getAllFlows } from './definitions';

export type SweepOutput = 'gini' | 'netFlow' | 'criticalAlerts';

export interface TornadoEntry {
  paramId: string;
  label: string;
  kind: EconomyFlow['type'];
  baseValue: number;
  lowValue: number;
  highValue: number;
  low: number;
  high: number;
  delta: number;
}

export interface SweepResult {
  output: SweepOutput;
  range: number;
  baseline: number;
  entries: TornadoEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function extractOutput(result: SimulationResult, output: SweepOutput): number {
  const last = result.metrics[result.metrics.length - 1];
  if (output === 'gini') return last?.giniCoefficient ?? 0;
  if (output === 'netFlow') return last?.netFlowPerHour ?? 0;
  return result.alerts.filter((a) => a.severity === 'critical').length;
}

function withOverride(config: SimulationConfig, id: string, baseAmount: number): SimulationConfig {
  const others = (config.flowOverrides ?? []).filter((o) => o.id !== id);
  return { ...config, flowOverrides: [...others, { id, baseAmount }] };
}

/**
 * Deterministic one-at-a-time sensitivity sweep over faucet/sink `baseAmount`.
 * For each parameter, re-runs the seeded economy engine at baseValue × (1 ± range),
 * measures how far the chosen output moves, and ranks parameters by that swing —
 * the data a tornado chart consumes. Pure given a fixed seed.
 */
export function runSensitivitySweep(
  config: SimulationConfig,
  opts: { output: SweepOutput; range?: number; params?: EconomyFlow[] },
): SweepResult {
  const range = opts.range ?? 0.5;
  const params = opts.params ?? getAllFlows();
  const baseline = extractOutput(runSimulation(config), opts.output);

  const entries: TornadoEntry[] = params.map((flow) => {
    const lowValue = round2(flow.baseAmount * (1 - range));
    const highValue = round2(flow.baseAmount * (1 + range));
    const low = extractOutput(runSimulation(withOverride(config, flow.id, lowValue)), opts.output);
    const high = extractOutput(runSimulation(withOverride(config, flow.id, highValue)), opts.output);
    return {
      paramId: flow.id,
      label: flow.name,
      kind: flow.type,
      baseValue: flow.baseAmount,
      lowValue,
      highValue,
      low,
      high,
      delta: Math.abs(high - low),
    };
  });

  entries.sort((a, b) => b.delta - a.delta);
  return { output: opts.output, range, baseline, entries };
}
