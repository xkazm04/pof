/**
 * `GET /api/games/[gameId]/decisions/media?ask=<id>&opt=<key>&n=<index>` — one image or clip of a decision option,
 * served ONLY when that ask file lists it (`resolveMedia`): the path comes from the ask file, never from the query,
 * and must be an existing png/jpg/webp/gif/mp4/webm file. Honours byte ranges so a clip can be scrubbed.
 */
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { decisionsRootFor } from '@/lib/games/decisions/decisionsConfig';
import { resolveMedia } from '@/lib/games/decisions/readDecisions';
import { audioResponse } from '@/lib/voice/audioResponse';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const root = decisionsRootFor(gameId);
    if (!root) return apiError('no decision folder configured', 404);
    const q = req.nextUrl.searchParams;
    const r = resolveMedia(root, q.get('ask') ?? '', q.get('opt') ?? '', Number(q.get('n') ?? ''));
    if (!r.ok) return apiError(r.reason, r.status);
    const res = audioResponse(fs.readFileSync(r.file), r.mime, req.headers.get('range'), 'private, max-age=30');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'decisions media GET failed', 500);
  }
}
