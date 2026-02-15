import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { generateUE5Code } from '@/lib/economy/codegen';
import { getAllFlows, DEFAULT_ITEMS, DEFAULT_CONFIG, generateXPCurve } from '@/lib/economy/definitions';
import type { SimulationConfig, SimulationResult } from '@/types/economy-simulator';

export async function GET() {
  try {
    const flows = getAllFlows();
    const items = DEFAULT_ITEMS;
    const xpCurve = generateXPCurve(DEFAULT_CONFIG.maxLevel);
    return apiSuccess({ flows, items, xpCurve, defaultConfig: DEFAULT_CONFIG });
  } catch (err) {
    return apiError(`Failed to get economy defaults: ${err instanceof Error ? err.message : err}`, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'simulate') {
      const config: SimulationConfig = {
        agentCount: Math.min(body.config?.agentCount ?? 100, 500),
        maxLevel: Math.min(body.config?.maxLevel ?? 25, 100),
        maxPlayHours: Math.min(body.config?.maxPlayHours ?? 80, 200),
        philosophy: body.config?.philosophy ?? 'loot-driven',
        seed: body.config?.seed ?? Math.floor(Math.random() * 999999),
        flowOverrides: body.config?.flowOverrides,
        itemOverrides: body.config?.itemOverrides,
      };

      const result = runSimulation(config);
      return apiSuccess({ result });
    }

    if (action === 'generate-code') {
      // Accept either a full simulation result or a config to re-simulate
      let simResult: SimulationResult;

      if (body.result) {
        simResult = body.result;
      } else {
        const config: SimulationConfig = {
          agentCount: Math.min(body.config?.agentCount ?? 100, 500),
          maxLevel: Math.min(body.config?.maxLevel ?? 25, 100),
          maxPlayHours: Math.min(body.config?.maxPlayHours ?? 80, 200),
          philosophy: body.config?.philosophy ?? 'loot-driven',
          seed: body.config?.seed ?? Math.floor(Math.random() * 999999),
          flowOverrides: body.config?.flowOverrides,
          itemOverrides: body.config?.itemOverrides,
        };
        simResult = runSimulation(config);
      }

      const codeResult = generateUE5Code(simResult);
      return apiSuccess(codeResult);
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Simulation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
