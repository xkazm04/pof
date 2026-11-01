/**
 * `POST /api/games/[gameId]/intake/run` — dispatch one pitch-intake CLI session (WP3).
 *
 * The lab's existing CLI seam (the one `CliProduce` live mode and the one-shot panel use): the
 * server reads the pitch, builds the prompt (`buildIntakePrompt`), spawns the session
 * (`startExecution`), awaits its `@@CALLBACK`, merges the run's static fields exactly as a
 * terminal settlement would (`mergeCallbackBody`), and stores the result through the SAME
 * validation as `POST ../intake`. The client sends no prompt — the pitch is server-side truth.
 *
 * A placeholder pitch is refused before any model is spent (409, the reason named).
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { authoringProfileOf, getGame, isGameId } from '@/lib/games/registry';
import { readPitch } from '@/lib/games/intake/files';
import { buildIntakePrompt, intakeCallbackDescriptor } from '@/lib/games/intake/prompt';
import { ingestIntakeCallback, intakeRefusalFor } from '@/lib/game-intake-db';
import { startExecution, awaitCallback } from '@/lib/claude-terminal/cli-service';
import { mergeCallbackBody } from '@/lib/cli-task';
import { resolveDispatchModelChoice } from '@/lib/model-policy';
import { UI_TIMEOUTS } from '@/lib/constants';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';

export async function POST(req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) {
  try {
    const denied = requireOperator(req);
    if (denied) return denied;
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const blocked = intakeRefusalFor(gameId);
    if (blocked) return apiError(blocked.message, blocked.status);
    const pitch = readPitch(gameId);
    if (pitch.placeholder) return apiError(`no pitch yet: games/${gameId}/pitch.md is a placeholder`, 409);

    const registered = allCatalogPipelines().map((p) => p.catalogId);
    const runId = `run-${Date.now().toString(36)}`;
    const prompt = buildIntakePrompt({ game: getGame(gameId), authoringProfile: authoringProfileOf(gameId), pitch: pitch.text, registered, runId });

    // Governed like the one-shot design dispatches (same task class); attributed as its own task.
    const { model, effort } = resolveDispatchModelChoice({ taskType: 'one-shot-propose' });
    const executionId = startExecution(process.cwd(), prompt, undefined, undefined, {
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      attribution: { moduleId: `game-${gameId}`, taskType: 'game-intake', taskLabel: `Pitch intake · ${gameId}` },
    });
    const payload = await awaitCallback(executionId, { timeoutMs: UI_TIMEOUTS.callbackAwaitTimeout });
    const merged = mergeCallbackBody(intakeCallbackDescriptor(gameId, runId).staticFields, JSON.stringify(payload ?? {}));
    if (!merged.ok) return apiError(merged.error, 502);
    const out = ingestIntakeCallback(gameId, merged.body, registered);
    return out.ok ? apiSuccess({ ...out.data, executionId }) : apiError(`intake reply refused: ${out.error.message}`, 422);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'intake run failed', 500);
  }
}
