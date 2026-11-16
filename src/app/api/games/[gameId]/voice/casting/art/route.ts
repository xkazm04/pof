/**
 * `GET /api/games/[gameId]/voice/casting/art?character=<id>&n=<index>` — one image of a character being cast,
 * served ONLY when `games/gtai/voice/casting/art.json` lists it (`resolveArt`): the path comes from the map,
 * never from the query, and must be an existing png/jpg/webp under `games/gtai/`.
 */
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { resolveArt } from '@/lib/voice/castingView';

type Ctx = { params: Promise<{ gameId: string }> };
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const q = req.nextUrl.searchParams;
    const file = resolveArt(questRoot(), q.get('character') ?? '', Number(q.get('n') ?? '0'));
    if (!file) return apiError('no such casting art', 404);
    const ext = file.split('.').pop()!.toLowerCase();
    return new Response(new Uint8Array(fs.readFileSync(file)), {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice casting art GET failed', 500);
  }
}
