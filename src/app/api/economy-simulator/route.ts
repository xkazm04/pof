import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { generateUE5Code } from '@/lib/economy/codegen';
import { getAllFlows, DEFAULT_ITEMS, DEFAULT_CONFIG, generateXPCurve } from '@/lib/economy/definitions';
import {
  deleteRun,
  getBaselineRun,
  getRun,
  listRuns,
  saveRun,
  setBaseline,
} from '@/lib/economy/economy-run-db';
import { extractRunMetrics } from '@/lib/economy/economy-run';
import { normalizeSimulationConfig } from '@/lib/economy/normalize-config';
import type { SimulationResult } from '@/types/economy-simulator';

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action');
    if (action === 'list-runs') {
      return apiSuccess({ runs: listRuns(), baseline: getBaselineRun() });
    }
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
      const result = runSimulation(normalizeSimulationConfig(body.config));
      return apiSuccess({ result });
    }

    if (action === 'generate-code') {
      // Accept either a full simulation result or a config to re-simulate
      let simResult: SimulationResult;

      if (body.result) {
        simResult = body.result;
      } else {
        // Same trust boundary as 'simulate' — an unclamped re-simulate here
        // emits NaN/undefined into "calibrated" UE5 C++.
        simResult = runSimulation(normalizeSimulationConfig(body.config));
      }

      const codeResult = generateUE5Code(simResult);
      return apiSuccess(codeResult);
    }

    if (action === 'save-run') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return apiError('name (non-empty string) is required', 400);
      const result = body.result as SimulationResult | undefined;
      if (!result || !Array.isArray(result.metrics)) {
        return apiError('result (SimulationResult) is required', 400);
      }
      const run = saveRun({
        name,
        config: result.config,
        metrics: extractRunMetrics(result),
      });
      return apiSuccess({ run });
    }

    if (action === 'load-run') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return apiError('id is required', 400);
      const run = getRun(id);
      if (!run) return apiError('Run not found', 404);
      return apiSuccess({ run });
    }

    if (action === 'delete-run') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return apiError('id is required', 400);
      const deleted = deleteRun(id);
      if (!deleted) return apiError('Run not found', 404);
      return apiSuccess({ deleted: true });
    }

    if (action === 'set-baseline') {
      const id = body.id === null ? null : typeof body.id === 'string' ? body.id : '';
      if (id === '') return apiError('id (string or null) is required', 400);
      const baseline = setBaseline(id);
      return apiSuccess({ baseline });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Simulation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
