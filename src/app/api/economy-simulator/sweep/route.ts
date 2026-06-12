import { NextRequest } from 'next/server';
import { runSensitivitySweep, type SweepOutput } from '@/lib/economy/sensitivity-sweep';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, output, range } = body;
    if (!config || typeof config.seed !== 'number') {
      return apiError('a SimulationConfig (with a numeric seed) is required', 400);
    }
    const out: SweepOutput = output === 'gini' || output === 'criticalAlerts' ? output : 'netFlow';
    // The sweep runs 31 full simulations per request — an unclamped config is
    // a 31×-amplified CPU DoS on this single-process server.
    const rawRange = typeof range === 'number' && Number.isFinite(range) ? range : 0.5;
    const result = runSensitivitySweep(normalizeSimulationConfig(config), {
      output: out,
      range: Math.min(Math.max(rawRange, 0.05), 0.9),
    });
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sensitivity sweep failed');
  }
}
