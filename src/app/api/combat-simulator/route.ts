import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import {
  ENEMY_ARCHETYPES,
  PLAYER_ABILITIES,
  GEAR_LOADOUTS,
  DEFAULT_TUNING,
  DEFAULT_CONFIG,
} from '@/lib/combat/definitions';
import type { CombatScenario, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';

export async function GET() {
  try {
    return apiSuccess({
      enemies: ENEMY_ARCHETYPES,
      abilities: PLAYER_ABILITIES,
      gearLoadouts: GEAR_LOADOUTS,
      defaultTuning: DEFAULT_TUNING,
      defaultConfig: DEFAULT_CONFIG,
    });
  } catch (err) {
    return apiError(`Failed to get combat defaults: ${err instanceof Error ? err.message : err}`, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'simulate') {
      const scenario = body.scenario as CombatScenario;
      const tuning: TuningOverrides = { ...DEFAULT_TUNING, ...(body.tuning ?? {}) };
      const config: CombatSimConfig = {
        iterations: Math.min(body.config?.iterations ?? 1000, 5000),
        seed: body.config?.seed ?? Math.floor(Math.random() * 999999),
        maxFightDurationSec: Math.min(body.config?.maxFightDurationSec ?? 120, 300),
      };

      if (!scenario || !scenario.enemies || scenario.enemies.length === 0) {
        return apiError('Scenario with at least one enemy group is required', 400);
      }

      const result = runCombatSimulation(scenario, tuning, config);

      // Strip individual fight results if too many (keep summary + alerts)
      const trimmedResult = {
        ...result,
        fights: result.fights.length > 100 ? result.fights.slice(0, 100) : result.fights,
      };

      return apiSuccess({ result: trimmedResult });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Simulation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
