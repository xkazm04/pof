/**
 * `GET  /api/games/[gameId]/decisions` — the design-decision board (open asks newest first, then answered), read from
 * the game's decision folder (`decisionsConfig.ts`). Read-only.
 * `POST /api/games/[gameId]/decisions` `{ id, choice, note? }` — HUMAN GATED: records the owner's answer. Refused 403
 * unless it is a browser fetch from the Decisions room carrying its page token (`@/lib/voice/gate`, the same gate the
 * Voice room uses; the agents the lanes run never hold one). The write itself is `writeAnswer.ts`.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { decisionsRootFor } from '@/lib/games/decisions/decisionsConfig';
import { readDecisionsBoard } from '@/lib/games/decisions/readDecisions';
import { writeAnswer } from '@/lib/games/decisions/writeAnswer';
import type { DecisionsBoard } from '@/lib/games/decisions/decisionTypes';
import { gateRefusal } from '@/lib/voice/gate';
import fs from 'node:fs';

type Ctx = { params: Promise<{ gameId: string }> };

const base = (gameId: string) => `/api/games/${gameId}/decisions`;

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const root = decisionsRootFor(gameId);
    const none = (reason: string): DecisionsBoard => ({ gameId, readAt: new Date().toISOString(), configured: false, reason, open: [], answered: [], problems: [] });
    if (!root) return apiSuccess(none(`${gameId} declares no decision folder (GameDef.decisions, or POF_GAME_DECISIONS_${gameId.toUpperCase()})`));
    if (!fs.existsSync(root)) return apiSuccess({ ...none(`the decision folder ${root} is not on disk`), root });
    return apiSuccess(readDecisionsBoard(root, gameId, base(gameId)));
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'decisions GET failed', 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const refusal = gateRefusal(req.headers);
    if (refusal) return apiError(refusal.replace(/Voice room/g, 'Decisions room'), 403);
    const root = decisionsRootFor(gameId);
    if (!root || !fs.existsSync(root)) return apiError('no decision folder is configured or on disk for this game', 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.id !== 'string' || typeof b.choice !== 'string') return apiError('id and choice are required', 400);
    const r = await writeAnswer(root, { id: b.id, choice: b.choice, note: typeof b.note === 'string' ? b.note : '' });
    if (!r.ok) return apiError(r.reason, r.status);
    return apiSuccess({ answer: { id: r.answer.id, choice: r.answer.choice, note: r.answer.note, at: r.answer.at }, replaced: r.replaced });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'decisions POST failed', 500);
  }
}
