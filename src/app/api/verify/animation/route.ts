/**
 * POST /api/verify/animation
 *
 * The aesthetic-truth half of the loop (sibling of /api/verify/visual, but for MOTION).
 * Given a captured filmstrip (a frame directory or explicit paths) plus the motion's intent,
 * run the multi-frame Gemini critique and return a scored, dimensional, actionable card.
 * Reads the PNGs on the same machine, like the visual route. Standard { success, data } envelope.
 */
import { NextRequest } from 'next/server';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { critiqueAnimation } from '@/lib/anim-critique/critique';
import { makeGeminiVision } from '@/lib/anim-critique/gemini';
import { makeQwenVision } from '@/lib/anim-critique/qwen';
import { resolveFilmstrip } from '@/lib/anim-critique/filmstrip';

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    intent?: string;
    frameDir?: string;
    framePaths?: string[];
    durationSeconds?: number;
    model?: string;
    provider?: string;
    cam?: string;
    maxFrames?: number;
  };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { name, intent, frameDir, framePaths, durationSeconds, model } = body;
  if (!name || !intent) {
    return apiError('Missing "name" or "intent"', 400);
  }

  // Resolve the ordered filmstrip from explicit paths or a directory.
  let frames: string[];
  if (Array.isArray(framePaths) && framePaths.length > 0) {
    frames = framePaths;
  } else if (frameDir) {
    if (!existsSync(frameDir)) return apiError(`frameDir not found: ${frameDir}`, 404);
    const cam = body.cam === 'side' ? 'side' : 'main';
    const maxFrames = typeof body.maxFrames === 'number' && body.maxFrames > 0 ? body.maxFrames : 10;
    frames = resolveFilmstrip(readdirSync(frameDir), { cam, maxFrames }).map((f) => join(frameDir, f));
  } else {
    return apiError('Provide "frameDir" or "framePaths"', 400);
  }
  if (frames.length === 0) {
    return apiError('No frames resolved from input (expected frame_NN.png / shot_NN.png)', 404);
  }
  const missing = frames.find((f) => !existsSync(f));
  if (missing) return apiError(`Frame not found: ${missing}`, 404);

  // Pick the vision provider: 'qwen' (DashScope, Gemini-free) or 'gemini' (default).
  const provider = body.provider === 'qwen' ? 'qwen' : 'gemini';
  const callVision =
    provider === 'qwen'
      ? makeQwenVision({ ...(model ? { model } : {}) })
      : makeGeminiVision({ ...(model ? { model } : {}) });

  const result = await critiqueAnimation(
    frames,
    { name, intent, frameCount: frames.length, ...(durationSeconds ? { durationSeconds } : {}) },
    { callVision },
  );

  if (!result.ok || !result.card) {
    return apiError(result.error ?? 'critique failed', 502);
  }
  return apiSuccess({ ...result.card, frames, provider });
}
