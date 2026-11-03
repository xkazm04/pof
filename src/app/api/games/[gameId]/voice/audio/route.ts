/**
 * `GET /api/games/[gameId]/voice/audio?takeId=` | `?voiceId=` — streams a take or a voice's design preview.
 * `&as=game` (takes): the take mastered the way export renders it (`asGame.ts`: the game's voice level and
 * the speaker's device treatment), so the room judges what the player hears, at matched loudness.
 */
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { getVoiceDb, VOICE_GAMES } from '@/lib/voice/conn';
import { isInVoiceDir } from '@/lib/voice/storage';
import { getTake, getVoice } from '@/lib/voice/voice-db';
import { asGameFile } from '@/lib/voice/asGame';
import { gameRootFor } from '@/lib/games/gameRoot';
import type { GameId } from '@/lib/games/types';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const db = getVoiceDb();
    const takeId = req.nextUrl.searchParams.get('takeId');
    const voiceId = req.nextUrl.searchParams.get('voiceId');
    if (takeId && req.nextUrl.searchParams.get('as') === 'game') {
      const r = await asGameFile(db, takeId, gameRootFor(gameId as GameId));
      if (!r.ok) return apiError(`could not master the take as the game plays it: ${r.error}`, 422);
      return new Response(new Uint8Array(fs.readFileSync(r.data.file)), {
        headers: { 'Content-Type': 'audio/ogg', 'Cache-Control': 'private, no-cache' },
      });
    }
    const file = takeId ? getTake(db, takeId)?.file : voiceId ? getVoice(db, voiceId)?.previews[0]?.file : undefined;
    if (!file || !isInVoiceDir(file) || !fs.existsSync(file)) return apiError('no such audio', 404);
    return new Response(new Uint8Array(fs.readFileSync(file)), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice audio GET failed', 500);
  }
}
