/** `GET /api/games/[gameId]/voice/audio?takeId=` | `?voiceId=` — streams a take or a voice's design preview. */
import fs from 'node:fs';
import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { getVoiceDb, VOICE_GAMES } from '@/lib/voice/conn';
import { isInVoiceDir } from '@/lib/voice/storage';
import { getTake, getVoice } from '@/lib/voice/voice-db';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const db = getVoiceDb();
    const takeId = req.nextUrl.searchParams.get('takeId');
    const voiceId = req.nextUrl.searchParams.get('voiceId');
    const file = takeId ? getTake(db, takeId)?.file : voiceId ? getVoice(db, voiceId)?.previews[0]?.file : undefined;
    if (!file || !isInVoiceDir(file) || !fs.existsSync(file)) return apiError('no such audio', 404);
    return new Response(new Uint8Array(fs.readFileSync(file)), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice audio GET failed', 500);
  }
}
