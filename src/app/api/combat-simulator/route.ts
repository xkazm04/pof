import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { runCombatSimulationBatched } from '@/lib/combat/simulation-engine';
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

      if (!scenario || !Array.isArray(scenario.enemies) || scenario.enemies.length === 0) {
        return apiError('Scenario with at least one enemy group is required', 400);
      }

      // The trust boundary: the UI clamps count to 1–10, but a direct API /
      // MCP / scripted caller can send an unbounded `count` (the build loop
      // and every tick iterate it, blocking the event loop), a `level: NaN`
      // (poisons the summary), or a stale `archetypeId` (silently skipped by
      // the engine → a fight against zero enemies that reports 100% survival).
      const validIds = new Set(ENEMY_ARCHETYPES.map((a) => a.id));
      const unknown: string[] = [];
      const enemies = scenario.enemies.map((e) => {
        if (!validIds.has(e?.archetypeId)) unknown.push(String(e?.archetypeId));
        return {
          archetypeId: e?.archetypeId,
          count: clampInt(e?.count, 1, 1, 10),
          level: clampInt(e?.level, 1, 1, 50),
        };
      });
      if (unknown.length > 0) {
        return apiError(`Unknown enemy archetype id(s): ${unknown.join(', ')}`, 400);
      }
      scenario.enemies = enemies;

      // Strip individual fight results if too many (keep summary + alerts).
      const trim = (result: Awaited<ReturnType<typeof runCombatSimulationBatched>>) => ({
        ...result,
        fights: result.fights.length > 100 ? result.fights.slice(0, 100) : result.fights,
      });

      // Opt-in progressive streaming (Server-Sent Events): emit a `progress`
      // event per completed batch and a final `result` event, so the client can
      // surface intermediate progress instead of staring at a spinner for the
      // whole run. Default (no stream flag) keeps the plain JSON contract.
      if (body.stream === true) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            try {
              const result = await runCombatSimulationBatched(scenario, tuning, config, {
                onProgress: (completed, total) => { send({ type: 'progress', completed, total }); },
              });
              send({ type: 'result', result: trim(result) });
            } catch (err) {
              send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      }

      // Batched + event-loop-yielding so a 5000-iteration run doesn't block the
      // Node process (and starve concurrent requests) for its whole duration.
      const result = await runCombatSimulationBatched(scenario, tuning, config);
      return apiSuccess({ result: trim(result) });
    }

    return apiError('Unknown action', 400);
  } catch (err) {
    return apiError(`Simulation failed: ${err instanceof Error ? err.message : err}`, 500);
  }
}
