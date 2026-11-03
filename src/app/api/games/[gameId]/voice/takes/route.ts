/**
 * `POST /api/games/[gameId]/voice/takes` `{ questId, lineId, n, direction, voiceId?, settings? }` — generate
 * k takes (ElevenLabs text-to-speech). Not gated: it only adds `pending` takes for the owner to judge.
 */
import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { getVoiceDb, questRoot, VOICE_GAMES } from '@/lib/voice/conn';
import { syncQueue } from '@/lib/voice/lineQueue';
import { takeView } from '@/lib/voice/room';
import { generateTakes } from '@/lib/voice/takes';
import type { TakeSettings } from '@/lib/voice/types';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!VOICE_GAMES.includes(gameId)) return apiError(`No voice room for ${gameId}`, 404);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b.questId !== 'string' || typeof b.lineId !== 'string') return apiError('questId and lineId are required', 400);
    if (!process.env.ELEVENLABS_API_KEY) return apiError('ELEVENLABS_API_KEY not configured; nothing generated', 503);
    const db = getVoiceDb();
    syncQueue(db, gameId, questRoot());
    const r = await generateTakes(db, {
      gameId, questId: b.questId, lineId: b.lineId, n: Number(b.n ?? 1),
      direction: typeof b.direction === 'string' ? b.direction : '',
      voiceId: typeof b.voiceId === 'string' ? b.voiceId : undefined,
      settings: (b.settings && typeof b.settings === 'object' ? b.settings : {}) as Partial<TakeSettings>,
    });
    if (!r.ok) return apiError(r.error, 422);
    return apiSuccess({ takes: r.data.map((t) => takeView(t, false)), chars: r.data.reduce((n, t) => n + t.chars, 0) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'voice takes POST failed', 500);
  }
}
