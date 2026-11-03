/**
 * `GET /api/games/[gameId]/lanes/frame?lane=<id>&file=<name>` — one image from a lane's masters folder, served
 * ONLY when that lane's `frames.json` names it (`src/lib/games/runners/frames.ts`): a plain relative image name,
 * real path inside `<masters>/<group>/<lane>/`. Anything else is a 400/404 in the usual envelope. Binary on success.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { isGameId } from '@/lib/games/registry';
import { readFrameFile } from '@/lib/games/runners/frames';
import { runnersConfigFor } from '@/lib/games/runners/runnersConfig';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { gameId } = await ctx.params;
    if (!isGameId(gameId)) return apiError('Unknown game', 404);
    const lane = req.nextUrl.searchParams.get('lane') ?? '';
    const file = req.nextUrl.searchParams.get('file') ?? '';
    const r = readFrameFile(runnersConfigFor(gameId)?.masters, lane, file);
    if (!r.ok) return apiError(r.reason, r.status);
    return new NextResponse(new Uint8Array(r.bytes), { headers: { 'Content-Type': r.mime, 'Cache-Control': 'private, max-age=30', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'lane frame GET failed', 500);
  }
}
