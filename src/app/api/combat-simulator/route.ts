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

/**
 * Coerce an untrusted numeric field to a finite integer within [min, max].
 * Guards the sim engine against `0`, negatives, and non-numeric input (NaN),
 * any of which previously flowed straight into runCombatSimulation and produced
 * a NaN summary / undefined median.
 */
function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

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
        iterations: clampInt(body.config?.iterations, 1000, 1, 5000),
        seed: clampInt(body.config?.seed, Math.floor(Math.random() * 999999), 0, 0xffffffff),
        maxFightDurationSec: clampInt(body.config?.maxFightDurationSec, 120, 1, 300),
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
