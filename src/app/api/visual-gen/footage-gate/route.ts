import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { gateFootage, type FootagePurpose } from '@/lib/visual-gen/footage-gate';

const PURPOSES: readonly string[] = ['body', 'body+face'] satisfies FootagePurpose[];
/** Every sampled frame goes to the paid vision call; the default is 8. */
const MAX_FRAME_COUNT = 32;

/**
 * POST /api/visual-gen/footage-gate
 *
 * Tier-0 gate: judge a video clip as markerless-mocap INPUT (feet stay two distinct
 * shapes, limbs don't morph, full body in frame) BEFORE a MetaHuman Animator solve is
 * dispatched — the instrument that says when AI-GENERATED footage is good enough to
 * feed the text→video→animation chain. Warn-first — callers decide what a warn/fail
 * means; a gate that cannot run (no ffmpeg, no QWEN_API_KEY, unreadable clip) is an
 * error with the reason, never a silent pass.
 *
 * Body: { videoPath: string, purpose?: 'body'|'body+face', frameCount?: number }
 * Data: { verdict: 'pass'|'warn'|'fail', score: 0-100, reasons: string[], raw, frames }
 */
export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const body = parsed as { videoPath?: string; purpose?: FootagePurpose; frameCount?: number };
    if (!body.videoPath) return apiError('Missing required field: videoPath', 400);
    if (typeof body.videoPath !== 'string') return apiError('videoPath must be a string', 400);
    if (body.purpose != null && !PURPOSES.includes(body.purpose)) {
      return apiError(`unknown purpose "${String(body.purpose)}" — expected ${PURPOSES.join(' or ')}`, 400);
    }
    const n = body.frameCount;
    if (n != null && !(Number.isInteger(n) && n >= 1 && n <= MAX_FRAME_COUNT)) {
      return apiError(`frameCount must be a whole number from 1 to ${MAX_FRAME_COUNT}`, 400);
    }

    const card = await gateFootage(body.videoPath, { purpose: body.purpose, frameCount: body.frameCount });
    if (!card.ok) return apiError(`footage gate could not run: ${card.error}`, 502);
    return apiSuccess(card);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'footage gate failed', 500);
  }
}
