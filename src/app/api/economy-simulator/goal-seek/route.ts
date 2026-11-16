import { NextRequest } from 'next/server';
import { solveEconomyFlowForTarget } from '@/lib/economy/goal-seek';
import type { SweepOutput } from '@/lib/economy/sensitivity-sweep';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => undefined);
    // A body that is not a JSON object is the caller's error (400), not a server fault.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return apiError('Request body must be a JSON object', 400);
    }
    const { config, flowId, target, output } = body;
    if (!config || typeof config.seed !== 'number') {
      return apiError('a SimulationConfig (with a numeric seed) is required', 400);
    }
    if (typeof flowId !== 'string' || !flowId) {
      return apiError('a flowId is required', 400);
    }
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      return apiError('a numeric target is required', 400);
    }
    const out: SweepOutput = output === 'gini' || output === 'criticalAlerts' ? output : 'netFlow';
    // Each iteration is a full seeded simulation; cap the bisection so an unclamped
    // request can't amplify CPU on this single-process server (mirrors the sweep guard).
    const result = solveEconomyFlowForTarget(
      normalizeSimulationConfig(config),
      flowId,
      target,
      out,
      { maxIterations: 40 },
    );
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Goal-seek failed');
  }
}
