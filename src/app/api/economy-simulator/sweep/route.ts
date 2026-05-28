import { NextRequest } from 'next/server';
import { runSensitivitySweep, type SweepOutput } from '@/lib/economy/sensitivity-sweep';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, output, range } = body;
    if (!config || typeof config.seed !== 'number') {
      return apiError('a SimulationConfig (with a numeric seed) is required', 400);
    }
    const out: SweepOutput = output === 'gini' || output === 'criticalAlerts' ? output : 'netFlow';
    const result = runSensitivitySweep(config, {
      output: out,
      range: typeof range === 'number' ? range : 0.5,
    });
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Sensitivity sweep failed');
  }
}
